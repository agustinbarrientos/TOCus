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
	type SitePermissionGrantSnapshot,
} from './types';

/**
 * Shared domain rule used by permission manager tests.
 * @since 1.0.0 Initial implementation.
 */
const DOMAIN_RULE = {
	host: 'example.com',
	includeSubdomains: true,
	scopeId: DefaultProtectionScopeId,
} as const;
/**
 * Independent domain rule used by permission manager tests.
 * @since 1.0.0 Initial implementation.
 */
const INDEPENDENT_RULE = {
	host: 'independent.test',
	includeSubdomains: false,
	scopeId: ProtectionScopeIdSchema.parse( 'scope_independent' ),
} as const;

/**
 * Configuration containing shared and independent site rules.
 * @since 1.0.0 Initial implementation.
 */
const MULTI_SITE_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [
		{ identityHost: 'example.com', rule: DOMAIN_RULE },
		{ identityHost: 'independent.test', rule: INDEPENDENT_RULE },
	],
	schedule: { mode: 'always' },
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		scope_independent: ProtectionMeasurementRevisionSchema.parse( 'revision_independent' ),
	},
};

/**
 * Creates a controllable browser permissions API.
 * @return Browser permissions test double.
 * @since 1.0.0 Initial implementation.
 */
function createPermissionsApi(): SitePermissionApi {
	return {
		contains: vi.fn().mockResolvedValue( false ),
		getAll: vi.fn().mockResolvedValue( { origins: [], permissions: [] } ),
		request: vi.fn().mockResolvedValue( true ),
		remove: vi.fn().mockResolvedValue( true ),
	};
}

/**
 * Models Firefox's successful removal of exact origin grants while broader grants remain.
 * @param initialGrant - Browser permissions present before removal.
 * @return Browser API backed by the remaining grants.
 */
function createExactRemovalPermissionsApi( initialGrant: SitePermissionGrantSnapshot ): SitePermissionApi {
	let grant = structuredClone( initialGrant );
	const permissions = createPermissionsApi();
	vi.mocked( permissions.getAll ).mockImplementation( () => Promise.resolve( structuredClone( grant ) ) );
	vi.mocked( permissions.remove ).mockImplementation( ( descriptor ) => {
		grant = {
			origins: ( grant.origins ?? [] ).filter( ( origin ) => ! descriptor.origins.includes( origin ) ),
			permissions: ( grant.permissions ?? [] ).filter( ( permission ) =>
				! descriptor.permissions?.includes( permission ),
			),
		};
		return Promise.resolve( true );
	} );
	return permissions;
}

describe( 'createSitePermissionManager', () => {
	it( 'does not request navigation access for an empty batch of rules', async () => {
		const permissions = createPermissionsApi();

		await expect( createSitePermissionManager( { permissions } ).requestMany( [] ) ).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			previousGrant: { origins: [], permissions: [] },
		} );
		expect( permissions.request ).not.toHaveBeenCalled();
	} );

	it( 'requests unique batch origins immediately and preserves the original grant snapshot', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockResolvedValue( {
			origins: [ '*://*.example.com/*' ], permissions: [ 'webNavigation' ],
		} );
		const request = createSitePermissionManager( { permissions } )
			.requestMany( [ DOMAIN_RULE, INDEPENDENT_RULE, DOMAIN_RULE ] );

		expect( permissions.request ).toHaveBeenCalledExactlyOnceWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.example.com/*', '*://independent.test/*' ],
		} );
		await expect( request ).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED,
			previousGrant: { origins: [ '*://*.example.com/*' ], permissions: [ 'webNavigation' ] },
		} );
	} );

	it( 'still requests batch access in the gesture when the snapshot throws synchronously', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockImplementation( () => {
			throw new Error( 'Unavailable.' );
		} );
		const request = createSitePermissionManager( { permissions } ).requestMany( [ DOMAIN_RULE ] );

		expect( permissions.request ).toHaveBeenCalledOnce();
		await expect( request ).resolves.toEqual( {
			status: SitePermissionRequestStatus.GRANTED, previousGrant: null,
		} );
	} );

	it( 'reports batch denial and browser request rejection without throwing', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.request ).mockResolvedValueOnce( false ).mockRejectedValueOnce( new Error( 'Unavailable.' ) );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.requestMany( [ DOMAIN_RULE ] ) ).resolves.toEqual( {
			status: SitePermissionRequestStatus.DENIED,
		} );
		await expect( manager.requestMany( [ DOMAIN_RULE ] ) ).resolves.toEqual( {
			status: SitePermissionRequestStatus.ERROR,
		} );
	} );

	it( 'releases fresh origins and navigation together when a batch leaves no persisted sites', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, TestEmptyProtectionConfiguration ) )
			.resolves.toBe( SitePermissionReleaseStatus.RELEASED );
		expect( permissions.remove ).toHaveBeenCalledExactlyOnceWith( {
			origins: [ '*://*.example.com/*' ], permissions: [ 'webNavigation' ],
		} );
	} );

	it( 'does not release batch origins now owned by another persisted site', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, MULTI_SITE_CONFIGURATION ) )
			.resolves.toBe( SitePermissionReleaseStatus.RELEASED );
		expect( permissions.remove ).not.toHaveBeenCalled();
	} );

	it.each( [ '*://*/*', 'https://*/*', 'https://www.example.com/*' ] )(
		'reports access retained after successful batch removal leaves %s granted',
		async ( retainedOrigin ) => {
			const permissions = createExactRemovalPermissionsApi( {
				origins: [ '*://*.example.com/*', retainedOrigin ],
				permissions: [ 'webNavigation' ],
			} );
			const manager = createSitePermissionManager( { permissions } );

			await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, TestEmptyProtectionConfiguration ) )
				.resolves.toBe( SitePermissionReleaseStatus.RETAINED );
			await expect( permissions.getAll() ).resolves.toEqual( { origins: [ retainedOrigin ], permissions: [] } );
		},
	);

	it( 'reports successful batch compensation after restoring a preexisting HTTPS-wide grant', async () => {
		const previousGrant: SitePermissionGrantSnapshot = {
			origins: [ 'https://*/*' ], permissions: [ 'webNavigation' ],
		};
		const permissions = createExactRemovalPermissionsApi( {
			origins: [ 'https://*/*', '*://*.example.com/*' ], permissions: [ 'webNavigation' ],
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], previousGrant, TestEmptyProtectionConfiguration ) )
			.resolves.toBe( SitePermissionReleaseStatus.RELEASED );
		await expect( permissions.getAll() ).resolves.toEqual( previousGrant );
	} );

	it( 'reports new HTTP access retained when batch compensation preserves a preexisting HTTPS-wide grant', async () => {
		const previousGrant: SitePermissionGrantSnapshot = {
			origins: [ 'https://*/*' ], permissions: [ 'webNavigation' ],
		};
		const permissions = createExactRemovalPermissionsApi( {
			origins: [ 'https://*/*', 'http://*/*', '*://*.example.com/*' ], permissions: [ 'webNavigation' ],
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], previousGrant, TestEmptyProtectionConfiguration ) )
			.resolves.toBe( SitePermissionReleaseStatus.RETAINED );
		await expect( permissions.getAll() ).resolves.toEqual( {
			origins: [ 'https://*/*', 'http://*/*' ], permissions: [ 'webNavigation' ],
		} );
	} );

	it( 'releases a batch site without removing another configured site or its shared navigation grant', async () => {
		const permissions = createExactRemovalPermissionsApi( {
			origins: [ '*://*.example.com/*', '*://independent.test/*' ],
			permissions: [ 'webNavigation' ],
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, {
			...TestEmptyProtectionConfiguration,
			sites: [ { identityHost: 'independent.test', rule: INDEPENDENT_RULE } ],
		} ) ).resolves.toBe( SitePermissionReleaseStatus.RELEASED );
		await expect( permissions.getAll() ).resolves.toEqual( {
			origins: [ '*://independent.test/*' ], permissions: [ 'webNavigation' ],
		} );
	} );

	it( 'reports an error when remaining batch access cannot be verified after removal', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockRejectedValue( new Error( 'Unavailable.' ) );

		await expect( createSitePermissionManager( { permissions } ).releaseNewAccess(
			[ DOMAIN_RULE ], {}, TestEmptyProtectionConfiguration,
		) ).resolves.toBe( SitePermissionReleaseStatus.ERROR );
	} );

	it( 'retains batch access when configuration ownership cannot be read', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, null ) )
			.resolves.toBe( SitePermissionReleaseStatus.RETAINED );
		expect( permissions.remove ).not.toHaveBeenCalled();
	} );

	it( 'reports unsuccessful batch cleanup when the browser retains access or throws', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.remove ).mockResolvedValueOnce( false ).mockRejectedValueOnce( new Error( 'Unavailable.' ) );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, TestEmptyProtectionConfiguration ) )
			.resolves.toBe( SitePermissionReleaseStatus.RETAINED );
		await expect( manager.releaseNewAccess( [ DOMAIN_RULE ], {}, TestEmptyProtectionConfiguration ) )
			.resolves.toBe( SitePermissionReleaseStatus.ERROR );
	} );

	it( 'preserves narrower existing origin grants when batch cleanup cannot safely separate them', async () => {
		const permissions = createPermissionsApi();
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.releaseNewAccess(
			[ DOMAIN_RULE ],
			{ origins: [ 'https://www.example.com/*' ], permissions: [ 'webNavigation' ] },
			TestEmptyProtectionConfiguration,
		) ).resolves.toBe( SitePermissionReleaseStatus.RETAINED );
		expect( permissions.remove ).not.toHaveBeenCalled();
	} );

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
		const permissions = createExactRemovalPermissionsApi( {
			origins: [ '*://*.example.com/*', '*://independent.test/*' ],
			permissions: [ 'webNavigation' ],
		} );
		const manager = createSitePermissionManager( { permissions } );

		await expect( manager.release( DOMAIN_RULE, true ) ).resolves.toBe(
			SitePermissionReleaseStatus.RELEASED,
		);
		expect( permissions.remove ).toHaveBeenCalledWith( {
			origins: [ '*://*.example.com/*' ],
		} );
		await expect( permissions.getAll() ).resolves.toEqual( {
			origins: [ '*://independent.test/*' ], permissions: [ 'webNavigation' ],
		} );
	} );

	it.each( [ '*://*/*', 'https://*/*', 'https://www.example.com/*' ] )(
		'reports access retained after successful final-site removal leaves %s granted',
		async ( retainedOrigin ) => {
			const permissions = createExactRemovalPermissionsApi( {
				origins: [ '*://*.example.com/*', retainedOrigin ],
				permissions: [ 'webNavigation' ],
			} );
			const manager = createSitePermissionManager( { permissions } );

			await expect( manager.release( DOMAIN_RULE, false ) ).resolves.toBe( SitePermissionReleaseStatus.RETAINED );
			await expect( permissions.getAll() ).resolves.toEqual( { origins: [ retainedOrigin ], permissions: [] } );
		},
	);

	it( 'reports navigation retained even when all removed-site origins are gone', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockResolvedValue( { origins: [], permissions: [ 'webNavigation' ] } );

		await expect( createSitePermissionManager( { permissions } ).release( DOMAIN_RULE, false ) )
			.resolves.toBe( SitePermissionReleaseStatus.RETAINED );
	} );

	it( 'reports an error when remaining site access cannot be verified after removal', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockRejectedValue( new Error( 'Unavailable.' ) );

		await expect( createSitePermissionManager( { permissions } ).release( DOMAIN_RULE, false ) )
			.resolves.toBe( SitePermissionReleaseStatus.ERROR );
	} );

	it( 'releases shared navigation access with the final protected site', async () => {
		const permissions = createPermissionsApi();
		vi.mocked( permissions.getAll ).mockResolvedValue( {} );
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
