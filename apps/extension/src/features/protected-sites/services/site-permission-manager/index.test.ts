import { describe, expect, it, vi } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { createSitePermissionManager } from './index';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionApi,
} from './types';

/**
 * Shared domain rule used by permission manager tests.
 * @since 0.1.0 Initial implementation.
 */
const DOMAIN_RULE = {
	host: 'example.com',
	includeSubdomains: true,
	scopeId: DefaultProtectionScopeId,
} as const;
/**
 * Independent domain rule used by permission manager tests.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_RULE = {
	host: 'independent.test',
	includeSubdomains: false,
	scopeId: ProtectionScopeIdSchema.parse( 'scope_independent' ),
} as const;

/**
 * Configuration containing shared and independent site rules.
 * @since 0.1.0 Initial implementation.
 */
const MULTI_SITE_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [
		{ identityHost: 'example.com', rule: DOMAIN_RULE },
		{ identityHost: 'independent.test', rule: INDEPENDENT_RULE },
	],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		scope_independent: { mode: 'always' },
	},
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		scope_independent: ProtectionMeasurementRevisionSchema.parse( 'revision_independent' ),
	},
};

/**
 * Creates a controllable browser permissions API.
 * @return Browser permissions test double.
 * @since 0.1.0 Initial implementation.
 */
function createPermissionsApi(): SitePermissionApi {
	return {
		contains: vi.fn().mockResolvedValue( false ),
		getAll: vi.fn().mockResolvedValue( { origins: [], permissions: [] } ),
		request: vi.fn().mockResolvedValue( true ),
		remove: vi.fn().mockResolvedValue( true ),
	};
}

describe( 'createSitePermissionManager', () => {
	it( 'checks the complete navigation and origin grant for one configured rule', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.contains ).mockResolvedValue( true );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.hasAccess( DOMAIN_RULE ) ).resolves.toBe( true );
		expect( permissions.contains ).toHaveBeenCalledWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.example.com/*' ],
		} );
	} );

	it( 'treats a rejected permission check as unavailable access', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.contains ).mockRejectedValue( new Error( 'Unavailable.' ) );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.hasAccess( DOMAIN_RULE ) ).resolves.toBe( false );
	} );

	it( 'filters runtime configuration to sites with complete current access', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockResolvedValue( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.example.com/*' ],
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.filterConfiguration( MULTI_SITE_CONFIGURATION ) ).resolves.toEqual( {
			...TestEmptyProtectionConfiguration,
			sites: [ { identityHost: 'example.com', rule: DOMAIN_RULE } ],
		} );
		expect( permissions.getAll ).toHaveBeenCalledOnce();
		expect( permissions.contains ).not.toHaveBeenCalled();
	} );

	it( 'keeps sites covered by a broader origin grant', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockResolvedValue( {
			permissions: [ 'webNavigation' ],
			origins: [ '<all_urls>' ],
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.filterConfiguration( MULTI_SITE_CONFIGURATION ) ).resolves.toEqual(
			MULTI_SITE_CONFIGURATION,
		);
	} );

	it( 'uses one permission snapshot regardless of the configured site count', async () => {
		const sites = Array.from( { length: 250 }, ( _value, index ) => ( {
			identityHost: `site-${ String( index ) }.test`,
			rule: {
				host: `site-${ String( index ) }.test`,
				includeSubdomains: false,
				scopeId: DefaultProtectionScopeId,
			},
		} ) );
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			sites,
		} );
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockResolvedValue( {
			permissions: [ 'webNavigation' ],
			origins: sites.map( ( site ) => `*://${ site.rule.host }/*` ),
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.filterConfiguration( configuration ) ).resolves.toEqual( configuration );
		expect( permissions.getAll ).toHaveBeenCalledOnce();
		expect( permissions.contains ).not.toHaveBeenCalled();
	} );

	it( 'filters every site when the permission snapshot is unavailable', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockRejectedValue( new Error( 'Unavailable.' ) );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.filterConfiguration( MULTI_SITE_CONFIGURATION ) ).resolves.toEqual(
			TestEmptyProtectionConfiguration,
		);
	} );

	it( 'requests only navigation observation and the selected domain origins', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.request( DOMAIN_RULE ) ).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		} );
		expect( permissions.contains ).toHaveBeenCalledWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.example.com/*' ],
		} );
		expect( permissions.request ).toHaveBeenCalledWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.example.com/*' ],
		} );
	} );

	it( 'reports an already granted rule as existing access', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.contains ).mockResolvedValue( true );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.request( DOMAIN_RULE ) ).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.EXISTING,
		} );
		expect( permissions.request ).toHaveBeenCalledOnce();
	} );

	it( 'starts the browser prompt before awaiting existing-permission lookup', async () => {
		let resolveExistingGrant: ( ( granted: boolean ) => void ) | undefined;
		const existingGrant = new Promise<boolean>(
			/**
			 * Captures control of the pending existing-grant lookup.
			 * @param resolve - Promise settlement operation.
			 */
			( resolve ) => {
				resolveExistingGrant = resolve;
			},
		);
		const permissions = createPermissionsApi();

		vi.mocked( permissions.contains ).mockReturnValue( existingGrant );
		const request = createSitePermissionManager( { permissions } ).request( DOMAIN_RULE );

		expect( permissions.request ).toHaveBeenCalledOnce();
		if ( resolveExistingGrant === undefined ) {
			throw new Error( 'Expected the existing-permission resolver to be captured.' );
		}

		resolveExistingGrant( false );
		await expect( request ).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		} );
	} );

	it( 'returns explicit denial and browser-error outcomes', async () => {
		const deniedPermissions = createPermissionsApi();
		vi.mocked( deniedPermissions.request ).mockResolvedValue( false );
		const rejectedPermissions = createPermissionsApi();
		vi.mocked( rejectedPermissions.request ).mockRejectedValue( new Error( 'Unavailable.' ) );

		await expect(
			createSitePermissionManager( { permissions: deniedPermissions } ).request( DOMAIN_RULE ),
		).resolves.toEqual( { status: SitePermissionRequestStatus.DENIED } );
		await expect(
			createSitePermissionManager( { permissions: rejectedPermissions } ).request( DOMAIN_RULE ),
		).resolves.toEqual( { status: SitePermissionRequestStatus.ERROR } );
	} );

	it( 'contains a synchronous browser permission failure', async () => {
		const permissions = createPermissionsApi();

		vi.mocked( permissions.request ).mockImplementation( () => {
			throw new Error( 'Unavailable.' );
		} );

		await expect(
			createSitePermissionManager( { permissions } ).request( DOMAIN_RULE ),
		).resolves.toEqual( { status: SitePermissionRequestStatus.ERROR } );
	} );

	it( 'keeps a granted permission when its prior status cannot be determined', async () => {
		const permissions = createPermissionsApi();

		vi.mocked( permissions.contains ).mockRejectedValue( new Error( 'Unavailable.' ) );

		await expect(
			createSitePermissionManager( { permissions } ).request( DOMAIN_RULE ),
		).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.UNKNOWN,
		} );
	} );

	it( 'starts the browser prompt when the existing-permission lookup fails synchronously', async () => {
		const permissions = createPermissionsApi();

		vi.mocked( permissions.contains ).mockImplementation( () => {
			throw new Error( 'Unavailable.' );
		} );

		await expect(
			createSitePermissionManager( { permissions } ).request( DOMAIN_RULE ),
		).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.UNKNOWN,
		} );
		expect( permissions.request ).toHaveBeenCalledOnce();
	} );

	it( 'releases a removed rule while retaining shared navigation access for remaining sites', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.release( DOMAIN_RULE, true ) ).resolves.toBe(
			SitePermissionReleaseStatus.RELEASED,
		);
		expect( permissions.remove ).toHaveBeenCalledWith( {
			origins: [ '*://*.example.com/*' ],
		} );
	} );

	it( 'releases shared navigation access with the final protected site', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.release( DOMAIN_RULE, false ) ).resolves.toBe(
			SitePermissionReleaseStatus.RELEASED,
		);
		expect( permissions.remove ).toHaveBeenCalledWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.example.com/*' ],
		} );
	} );

	it( 'reports retained permissions and browser errors without throwing', async () => {
		const retainedPermissions = createPermissionsApi();
		vi.mocked( retainedPermissions.remove ).mockResolvedValue( false );
		const rejectedPermissions = createPermissionsApi();
		vi.mocked( rejectedPermissions.remove ).mockRejectedValue( new Error( 'Unavailable.' ) );

		await expect(
			createSitePermissionManager( { permissions: retainedPermissions } ).release( DOMAIN_RULE, false ),
		).resolves.toBe( SitePermissionReleaseStatus.RETAINED );
		await expect(
			createSitePermissionManager( { permissions: rejectedPermissions } ).release( DOMAIN_RULE, false ),
		).resolves.toBe( SitePermissionReleaseStatus.ERROR );
	} );
} );
