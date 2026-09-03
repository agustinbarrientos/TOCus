import { describe, expect, it } from 'vitest';
import {
	ProtectionConfigurationEditRejectionReason,
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
	type ProtectionConfigurationMutationCoordinator,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	createSitePermissionManager,
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionApi,
	type SitePermissionDescriptor,
	type SitePermissionManager,
	type SitePermissionRequestResult,
} from '../site-permission-manager';
import { createProtectedSiteEnrollmentService } from './index';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentService,
} from './types';

const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };
const EXAMPLE_SITE: ProtectedSiteConfiguration = {
	identityHost: 'example.com',
	rule: {
		host: 'example.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ EXAMPLE_SITE ],
};

/**
 * In-memory configuration storage used by enrollment service tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryEnrollmentStorage implements ProtectionConfigurationStorageService {
	rejectLoads = false;

	rejectSaves = false;

	returnMalformedConfiguration = false;

	writes = 0;

	/**
	 * Creates storage with one initial configuration.
	 * @param configuration - Configuration returned by reads.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public configuration: ProtectionConfigurationDocument ) {}

	/**
	 * Loads the current configuration.
	 * @return Current protected-site configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		if ( this.rejectLoads ) {
			return Promise.reject( new Error( 'Local read unavailable.' ) );
		}

		return Promise.resolve( this.returnMalformedConfiguration ? null : this.configuration );
	}

	/**
	 * Stores one configuration unless the test requests a failure.
	 * @param input - Configuration candidate to store.
	 * @return Promise resolved after persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		this.writes += 1;
		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * Controllable permission manager used by enrollment service tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryEnrollmentPermissionManager implements SitePermissionManager {
	requestResult: SitePermissionRequestResult = {
		status: SitePermissionRequestStatus.GRANTED,
		provenance: SitePermissionGrantProvenance.EXISTING,
	};

	hasAccessResult = true;

	releaseResult: SitePermissionReleaseStatus = SitePermissionReleaseStatus.RELEASED;

	requestedRules: ProtectedSiteRule[] = [];

	releasedRules: ProtectedSiteRule[] = [];

	releaseRemainingSites: boolean[] = [];

	releaseStarted: Promise<void> | null = null;

	private completeReleaseStart: ( () => void ) | null = null;

	private releaseBarrier: Promise<void> | null = null;

	private completeReleaseBarrier: ( () => void ) | null = null;

	/**
	 * Returns the supplied configuration unchanged for enrollment-only fixtures.
	 * @param configuration - Validated persisted configuration.
	 * @return Unchanged configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	filterConfiguration(
		configuration: ProtectionConfigurationDocument,
	): Promise<ProtectionConfigurationDocument> {
		return Promise.resolve( configuration );
	}

	/**
	 * Reports complete access for the default enrollment fixture.
	 * @return True for the default granted-access fixture.
	 * @since 0.1.0 Initial implementation.
	 */
	hasAccess(): Promise<boolean> {
		return Promise.resolve( this.hasAccessResult );
	}

	/**
	 * Defers the next permission release until the test explicitly completes it.
	 * @since 0.1.0 Initial implementation.
	 */
	deferNextRelease(): void {
		this.releaseStarted = new Promise<void>( ( resolve ) => {
			this.completeReleaseStart = resolve;
		} );
		this.releaseBarrier = new Promise<void>( ( resolve ) => {
			this.completeReleaseBarrier = resolve;
		} );
	}

	/**
	 * Completes one deferred permission release.
	 * @since 0.1.0 Initial implementation.
	 */
	completeDeferredRelease(): void {
		if ( this.completeReleaseBarrier === null ) {
			throw new Error( 'Expected one deferred permission release.' );
		}

		this.completeReleaseBarrier();
		this.completeReleaseBarrier = null;
	}

	/**
	 * Records and returns one configured permission request result.
	 * @param rule - Canonical rule whose browser access is requested.
	 * @return Configured permission result.
	 * @since 0.1.0 Initial implementation.
	 */
	request( rule: ProtectedSiteRule ): Promise<SitePermissionRequestResult> {
		this.requestedRules.push( rule );

		return Promise.resolve( this.requestResult );
	}

	/**
	 * Records and returns one configured permission release result.
	 * @param rule - Canonical rule whose browser access is released.
	 * @param hasRemainingSites - Whether another protected site remains.
	 * @return Configured release result.
	 * @since 0.1.0 Initial implementation.
	 */
	async release(
		rule: ProtectedSiteRule,
		hasRemainingSites: boolean,
	): Promise<SitePermissionReleaseStatus> {
		this.releasedRules.push( rule );
		this.releaseRemainingSites.push( hasRemainingSites );
		this.completeReleaseStart?.();
		this.completeReleaseStart = null;

		if ( this.releaseBarrier !== null ) {
			await this.releaseBarrier;
			this.releaseBarrier = null;
		}

		return this.releaseResult;
	}
}

/**
 * Browser permission state shared by concurrent enrollment and removal operations.
 * @since 0.1.0 Initial implementation.
 */
class SharedPermissionStateApi implements SitePermissionApi {
	readonly origins = new Set( [
		'*://*.example.com/*',
	] );

	readonly permissions = new Set<NonNullable<SitePermissionDescriptor[ 'permissions' ]>[ number ]>( [
		'webNavigation',
	] );

	removalStarted: Promise<void> | null = null;

	private completeRemovalStart: ( () => void ) | null = null;

	private removalBarrier: Promise<void> | null = null;

	private completeRemovalBarrier: ( () => void ) | null = null;

	/**
	 * Reports whether every requested named and origin permission is currently granted.
	 * @param descriptor - Complete permission descriptor to inspect.
	 * @return Whether every descriptor entry exists in shared state.
	 * @since 0.1.0 Initial implementation.
	 */
	contains( descriptor: SitePermissionDescriptor ): Promise<boolean> {
		return Promise.resolve(
			( descriptor.permissions ?? [] ).every( ( permission ) => this.permissions.has( permission ) ) &&
			descriptor.origins.every( ( origin ) => this.origins.has( origin ) ),
		);
	}

	/**
	 * Returns one copy of the complete shared permission state.
	 * @return Current named and origin grants.
	 * @since 0.1.0 Initial implementation.
	 */
	getAll(): Promise<{ origins: string[]; permissions: NonNullable<SitePermissionDescriptor[ 'permissions' ]> }> {
		return Promise.resolve( {
			origins: [ ...this.origins ],
			permissions: [ ...this.permissions ],
		} );
	}

	/**
	 * Grants every requested entry synchronously before returning browser completion.
	 * @param descriptor - Permission descriptor granted by the user gesture.
	 * @return Successful browser permission request.
	 * @since 0.1.0 Initial implementation.
	 */
	request( descriptor: SitePermissionDescriptor ): Promise<boolean> {
		for ( const permission of descriptor.permissions ?? [] ) {
			this.permissions.add( permission );
		}

		for ( const origin of descriptor.origins ) {
			this.origins.add( origin );
		}

		return Promise.resolve( true );
	}

	/**
	 * Removes every requested entry after any configured concurrency barrier.
	 * @param descriptor - Permission descriptor being released.
	 * @return Successful browser permission removal.
	 * @since 0.1.0 Initial implementation.
	 */
	async remove( descriptor: SitePermissionDescriptor ): Promise<boolean> {
		this.completeRemovalStart?.();
		this.completeRemovalStart = null;

		if ( this.removalBarrier !== null ) {
			await this.removalBarrier;
			this.removalBarrier = null;
		}

		for ( const permission of descriptor.permissions ?? [] ) {
			this.permissions.delete( permission );
		}

		for ( const origin of descriptor.origins ) {
			this.origins.delete( origin );
		}

		return true;
	}

	/**
	 * Defers the next permission removal until the test explicitly releases it.
	 * @since 0.1.0 Initial implementation.
	 */
	deferNextRemoval(): void {
		this.removalStarted = new Promise<void>( ( resolve ) => {
			this.completeRemovalStart = resolve;
		} );
		this.removalBarrier = new Promise<void>( ( resolve ) => {
			this.completeRemovalBarrier = resolve;
		} );
	}

	/**
	 * Completes one deferred permission removal.
	 * @since 0.1.0 Initial implementation.
	 */
	completeDeferredRemoval(): void {
		if ( this.completeRemovalBarrier === null ) {
			throw new Error( 'Expected one deferred shared permission removal.' );
		}

		this.completeRemovalBarrier();
		this.completeRemovalBarrier = null;
	}
}

/**
 * Runs one configuration mutation immediately.
 * @param mutation - Deferred configuration edit.
 * @return Exact mutation result.
 * @since 0.1.0 Initial implementation.
 */
function coordinateMutationDirectly(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return mutation();
}

/**
 * Resolves a coordinated test queue after either mutation outcome.
 * @return Undefined queue settlement value.
 * @since 0.1.0 Initial implementation.
 */
function releaseMutationQueue(): undefined {
	return undefined;
}

/**
 * Creates one shared cross-editor mutation coordinator.
 * @return Coordinator that serializes every supplied mutation.
 * @since 0.1.0 Initial implementation.
 */
function createSharedMutationCoordinator(): ProtectionConfigurationMutationCoordinator {
	let queue: Promise<void> = Promise.resolve();

	/**
	 * Runs one mutation after every earlier coordinated mutation settles.
	 * @param mutation - Deferred protected-site configuration mutation.
	 * @return Exact mutation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function coordinateMutation(
		mutation: ProtectionConfigurationMutation,
	): Promise<ProtectionConfigurationEditResult> {
		const result = queue.then( mutation );
		queue = result.then( releaseMutationQueue, releaseMutationQueue );

		return result;
	}

	return coordinateMutation;
}

/**
 * Creates one deterministic independent scope identifier.
 * @return Stable independent scope identifier.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_enrollment_test';
}

/**
 * Creates one enrollment service backed by real configuration editing.
 * @param storage - In-memory configuration storage.
 * @param permissionManager - Controllable browser permission manager.
 * @param coordinateMutation - Shared cross-editor mutation coordinator.
 * @return Protected-site enrollment service.
 * @since 0.1.0 Initial implementation.
 */
function createService(
	storage: MemoryEnrollmentStorage,
	permissionManager: SitePermissionManager,
	coordinateMutation: ProtectionConfigurationMutationCoordinator = coordinateMutationDirectly,
): ProtectedSiteEnrollmentService {
	return createProtectedSiteEnrollmentService( {
		editor: createProtectionConfigurationEditor( {
			storage,
			createIndependentScopeId,
			coordinateMutation,
		} ),
		permissionManager,
	} );
}

describe( 'createProtectedSiteEnrollmentService', () => {
	it( 'rejects invalid input before requesting browser access', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		const service = createService( storage, permissionManager );

		await expect( service.add( 'chrome://settings', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
		} );
		expect( permissionManager.requestedRules ).toEqual( [] );
		expect( storage.writes ).toBe( 0 );
	} );

	it( 'reports a denied browser permission without persisting the site', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = { status: SitePermissionRequestStatus.DENIED };
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED,
		} );
		expect( storage.writes ).toBe( 0 );
	} );

	it( 'reports a browser permission error without persisting the site', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = { status: SitePermissionRequestStatus.ERROR };
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
		} );
		expect( storage.writes ).toBe( 0 );
	} );

	it( 'persists and returns the canonical protected site after access is granted', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		const service = createService( storage, permissionManager );

		const result = await service.add( 'https://www.example.com/path', false );

		expect( result ).toEqual( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			configuration: {
				...TestEmptyProtectionConfiguration,
				sites: [ {
					identityHost: 'www.example.com',
					rule: {
						host: 'example.com',
						includeSubdomains: true,
						scopeId: DefaultProtectionScopeId,
					},
				} ],
			},
			site: {
				identityHost: 'www.example.com',
				rule: {
					host: 'example.com',
					includeSubdomains: true,
					scopeId: DefaultProtectionScopeId,
				},
			},
		} );
		expect( permissionManager.requestedRules ).toEqual( [ {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		} ] );
		expect( storage.writes ).toBe( 1 );
	} );

	it( 'keeps a new grant when the authoritative configuration still requires it', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		};
		const service = createService( storage, permissionManager );

		await expect( service.add( 'shop.example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
		expect( permissionManager.releaseRemainingSites ).toEqual( [] );
	} );

	it( 'releases a new grant when persistence fails', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		};
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		} );
		expect( permissionManager.releasedRules ).toEqual( [ EXAMPLE_SITE.rule ] );
		expect( permissionManager.releaseRemainingSites ).toEqual( [ false ] );
	} );

	it( 'retains access with unknown provenance when persistence fails', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.UNKNOWN,
		};
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
	} );

	it( 'retains access with unknown provenance when coordinated verification fails', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.UNKNOWN,
		};
		permissionManager.hasAccessResult = false;
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
		expect( storage.writes ).toBe( 0 );
	} );

	it( 'reports retained access when rollback errors after persistence fails', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		};
		permissionManager.releaseResult = SitePermissionReleaseStatus.ERROR;
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
	} );

	it( 'uses fresh remaining-site state when rolling back a failed write', async () => {
		const otherSite: ProtectedSiteConfiguration = {
			identityHost: 'other.test',
			rule: {
				host: 'other.test',
				includeSubdomains: false,
				scopeId: DefaultProtectionScopeId,
			},
		};
		const storage = new MemoryEnrollmentStorage( {
			...TestEmptyProtectionConfiguration,
			sites: [ otherSite ],
		} );
		storage.rejectSaves = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		};
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		} );
		expect( permissionManager.releaseRemainingSites ).toEqual( [ true ] );
	} );

	it.each( [
		{
			label: 'newly granted access',
			provenance: SitePermissionGrantProvenance.NEW,
			expectedStatus: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		},
		{
			label: 'existing access',
			provenance: SitePermissionGrantProvenance.EXISTING,
			expectedStatus: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		},
		{
			label: 'access with unknown provenance',
			provenance: SitePermissionGrantProvenance.UNKNOWN,
			expectedStatus: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		},
	] )( 'handles an authoritative read failure with $label safely', async ( {
		provenance,
		expectedStatus,
	} ) => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.rejectLoads = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance,
		};
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: expectedStatus,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
	} );

	it( 'retains a new grant when malformed storage prevents an authoritative release decision', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.returnMalformedConfiguration = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.requestResult = {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		};
		const service = createService( storage, permissionManager );

		await expect( service.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
	} );

	it( 'preserves a rejected edit when no new permission was granted', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		const service = createService( storage, permissionManager );

		await expect( service.add( 'shop.example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
	} );

	it( 'releases access for a removed site through the permission lifecycle', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		permissionManager.releaseResult = SitePermissionReleaseStatus.RETAINED;
		const service = createService( storage, permissionManager );

		await expect( service.remove( EXAMPLE_SITE ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: EMPTY_CONFIGURATION,
			permissionReleaseStatus: SitePermissionReleaseStatus.RETAINED,
		} );
		expect( permissionManager.releasedRules ).toEqual( [ EXAMPLE_SITE.rule ] );
		expect( permissionManager.releaseRemainingSites ).toEqual( [ false ] );
	} );

	it( 'does not release browser access when removal persistence fails', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		storage.rejectSaves = true;
		const permissionManager = new MemoryEnrollmentPermissionManager();
		const service = createService( storage, permissionManager );

		await expect( service.remove( EXAMPLE_SITE ) ).rejects.toThrow( 'Local write unavailable.' );
		expect( permissionManager.releasedRules ).toEqual( [] );
	} );

	it( 'preserves a rejected removal without releasing browser access', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		const service = createService( storage, permissionManager );

		await expect( service.remove( EXAMPLE_SITE ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
		} );
		expect( permissionManager.releasedRules ).toEqual( [] );
	} );

	it( 'keeps removal cleanup ahead of an interleaving enrollment mutation', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const coordinateMutation = createSharedMutationCoordinator();
		const removalPermissionManager = new MemoryEnrollmentPermissionManager();
		removalPermissionManager.deferNextRelease();
		const enrollmentPermissionManager = new MemoryEnrollmentPermissionManager();
		const removalService = createService(
			storage,
			removalPermissionManager,
			coordinateMutation,
		);
		const enrollmentService = createService(
			storage,
			enrollmentPermissionManager,
			coordinateMutation,
		);
		const removal = removalService.remove( EXAMPLE_SITE );

		await removalPermissionManager.releaseStarted;

		let enrollmentSettled = false;
		const enrollment = enrollmentService.add( 'example.com', false )
			.finally( () => {
				enrollmentSettled = true;
			} );
		await Promise.resolve();

		expect( storage.configuration.sites ).toEqual( [] );
		expect( enrollmentSettled ).toBe( false );

		removalPermissionManager.completeDeferredRelease();

		await expect( removal ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: EMPTY_CONFIGURATION,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
		} );
		await expect( enrollment ).resolves.toMatchObject( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
		} );
		expect( storage.configuration.sites ).toEqual( [ EXAMPLE_SITE ] );
	} );

	it( 'does not persist an enrollment whose complete grant is revoked while it waits for coordination', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const coordinateMutation = createSharedMutationCoordinator();
		const permissions = new SharedPermissionStateApi();
		permissions.deferNextRemoval();
		const permissionManager = createSitePermissionManager( { permissions } );
		const removalService = createService( storage, permissionManager, coordinateMutation );
		const enrollmentService = createService( storage, permissionManager, coordinateMutation );
		const removal = removalService.remove( EXAMPLE_SITE );

		await permissions.removalStarted;
		const enrollment = enrollmentService.add( 'another.test', false );
		expect( permissions.origins ).toContain( '*://another.test/*' );
		permissions.completeDeferredRemoval();

		await expect( removal ).resolves.toMatchObject( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
		} );
		await expect( enrollment ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
		} );
		expect( storage.configuration ).toEqual( EMPTY_CONFIGURATION );
		expect( storage.writes ).toBe( 1 );
	} );
} );
