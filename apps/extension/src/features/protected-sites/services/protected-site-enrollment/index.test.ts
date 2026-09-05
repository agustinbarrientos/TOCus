import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionConfigurationEditRejectionReason,
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
	type ProtectionConfigurationMutationCoordinator,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	TestEmptyProtectionConfiguration,
	createTestProtectionMeasurementRevision,
} from '../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';
import { DefaultProtectionSchedule } from '../../../../domains/protection/types/protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
	type ProtectionMeasurementRevisionFactory,
} from '../../../../domains/protection/types/protection-value';
import {
	createSitePermissionManager,
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionApi,
	type SitePermissionBatchRequestResult,
	type SitePermissionDescriptor,
	type SitePermissionManager,
	type SitePermissionRequestResult,
} from '../site-permission-manager';
import { createProtectedSiteEnrollmentService } from './index';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentService,
} from './types';

/**
 * Empty protection configuration used by enrollment service tests.
 * @since 0.1.0 Initial implementation.
 */
const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };

/**
 * Empty configuration after one measurement-affecting membership edit.
 * @since 0.1.0 Initial implementation.
 */
const UPDATED_EMPTY_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...TestEmptyProtectionConfiguration,
	measurementRevisionsByScope: {
		[ DefaultProtectionScopeId ]: createTestProtectionMeasurementRevision(),
	},
} );
/**
 * Example shared site used by enrollment service tests.
 * @since 0.1.0 Initial implementation.
 */
const EXAMPLE_SITE: ProtectedSiteConfiguration = {
	identityHost: 'example.com',
	rule: {
		host: 'example.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
/**
 * Complete configuration containing the example shared site.
 * @since 0.1.0 Initial implementation.
 */
const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ EXAMPLE_SITE ],
};

/**
 * Scope returned by authoritative configuration removal.
 * @since 0.1.0 Initial implementation.
 */
const AUTHORITATIVE_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_authoritative' );

/**
 * Site returned by authoritative configuration removal.
 * @since 0.1.0 Initial implementation.
 */
const AUTHORITATIVE_SITE: ProtectedSiteConfiguration = {
	...EXAMPLE_SITE,
	rule: {
		...EXAMPLE_SITE.rule,
		scopeId: AUTHORITATIVE_SCOPE_ID,
	},
};

/**
 * Configuration containing the authoritative independent site.
 * @since 0.1.0 Initial implementation.
 */
const AUTHORITATIVE_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...TestEmptyProtectionConfiguration,
	sites: [ AUTHORITATIVE_SITE ],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ AUTHORITATIVE_SCOPE_ID ]: DefaultProtectionSchedule,
	},
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		[ AUTHORITATIVE_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse(
			'revision_authoritative',
		),
	},
} );

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
	 * Returns configured consent for a group of canonical rules.
	 * @param rules - Canonical rules whose browser access is requested.
	 * @return Batch permission result with a known original grant snapshot.
	 * @since 0.1.0 Initial implementation.
	 */
	requestMany( rules: readonly ProtectedSiteRule[] ): Promise<SitePermissionBatchRequestResult> {
		this.requestedRules.push( ...rules );

		return Promise.resolve( this.requestResult.status === SitePermissionRequestStatus.GRANTED
			? { status: SitePermissionRequestStatus.GRANTED, previousGrant: { origins: [], permissions: [] } }
			: this.requestResult );
	}

	/**
	 * Returns the configured batch permission compensation outcome.
	 * @return Configured permission release result.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseNewAccess(): Promise<SitePermissionReleaseStatus> {
		return Promise.resolve( this.releaseResult );
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
 * @param createMeasurementRevision - Measurement revision factory shared by coordinated editors.
 * @return Protected-site enrollment service.
 * @since 0.1.0 Initial implementation.
 */
function createService(
	storage: MemoryEnrollmentStorage,
	permissionManager: SitePermissionManager,
	coordinateMutation: ProtectionConfigurationMutationCoordinator = coordinateMutationDirectly,
	createMeasurementRevision: ProtectionMeasurementRevisionFactory = createTestProtectionMeasurementRevision,
): ProtectedSiteEnrollmentService {
	return createProtectedSiteEnrollmentService( {
		editor: createProtectionConfigurationEditor( {
			storage,
			createIndependentScopeId,
			createMeasurementRevision,
			coordinateMutation,
		} ),
		permissionManager,
	} );
}

describe( 'createProtectedSiteEnrollmentService', () => {
	it( 'requests selected batch origins once in the caller stack and saves their unique rules atomically', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		const request = vi.spyOn( permissions, 'request' );
		const service = createService( storage, createSitePermissionManager( { permissions } ) );
		const resultPromise = service.addMany( [ 'www.youtube.com', 'reddit.com', 'm.youtube.com' ] );

		expect( request ).toHaveBeenCalledExactlyOnceWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.youtube.com/*', '*://*.reddit.com/*' ],
		} );
		const result = await resultPromise;
		expect( result.status ).toBe( ProtectedSiteEnrollmentStatus.ADDED );
		expect( storage.configuration.sites.map( ( site ) => site.identityHost ) ).toEqual( [
			'www.youtube.com', 'reddit.com',
		] );
		expect( storage.writes ).toBe( 1 );
	} );

	it( 'rejects an invalid batch before any permission request or persistence', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		const request = vi.spyOn( permissions, 'request' );
		const service = createService( storage, createSitePermissionManager( { permissions } ) );

		await expect( service.addMany( [ 'youtube.com', 'chrome://settings' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
		} );
		expect( request ).not.toHaveBeenCalled();
		expect( storage.writes ).toBe( 0 );
	} );

	it( 'rejects malformed batch input before requesting permissions', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		const request = vi.spyOn( permissions, 'request' );

		await expect( createService( storage, createSitePermissionManager( { permissions } ) )
			.addMany( null as unknown as string[] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
		} );
		expect( request ).not.toHaveBeenCalled();
	} );

	it( 'removes only new batch access after an atomic save failure', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		storage.rejectSaves = true;
		const permissions = new SharedPermissionStateApi();
		const service = createService( storage, createSitePermissionManager( { permissions } ) );

		await expect( service.addMany( [ 'youtube.com', 'reddit.com' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		} );
		expect( storage.configuration ).toEqual( POPULATED_CONFIGURATION );
		expect( permissions.origins ).toEqual( new Set( [ '*://*.example.com/*' ] ) );
		expect( permissions.permissions ).toEqual( new Set( [ 'webNavigation' ] ) );
	} );

	it( 'finishes an empty batch without requesting access or changing the configuration', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		const request = vi.spyOn( permissions, 'request' );
		const service = createService( storage, createSitePermissionManager( { permissions } ) );

		await expect( service.addMany( [] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			configuration: POPULATED_CONFIGURATION,
			sites: [],
		} );
		expect( request ).not.toHaveBeenCalled();
		expect( storage.writes ).toBe( 0 );
	} );

	it.each( [
		[ SitePermissionRequestStatus.DENIED, ProtectedSiteEnrollmentStatus.PERMISSION_DENIED ],
		[ SitePermissionRequestStatus.ERROR, ProtectedSiteEnrollmentStatus.PERMISSION_ERROR ],
	] as const )( 'does not persist a batch when permission is %s', async ( permissionStatus, enrollmentStatus ) => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const manager = new MemoryEnrollmentPermissionManager();
		manager.requestResult = { status: permissionStatus };

		await expect( createService( storage, manager ).addMany( [ 'youtube.com', 'reddit.com' ] ) )
			.resolves.toEqual( { status: enrollmentStatus } );
		expect( storage.writes ).toBe( 0 );
	} );

	it( 'rejects the entire batch when another context already added one selected rule', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		const service = createService( storage, createSitePermissionManager( { permissions } ) );

		await expect( service.addMany( [ 'youtube.com', 'www.example.com' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} );
		expect( storage.writes ).toBe( 0 );
		expect( storage.configuration ).toEqual( POPULATED_CONFIGURATION );
		expect( permissions.origins ).toEqual( new Set( [ '*://*.example.com/*' ] ) );
	} );

	it( 'does not save any batch site when its access is revoked before coordinated persistence', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		const manager = createSitePermissionManager( { permissions } );
		vi.spyOn( manager, 'hasAccess' ).mockResolvedValue( false );

		await expect( createService( storage, manager ).addMany( [ 'youtube.com', 'reddit.com' ] ) )
			.resolves.toEqual( { status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR } );
		expect( storage.writes ).toBe( 0 );
		expect( permissions.origins ).toEqual( new Set( [ '*://*.example.com/*' ] ) );
	} );

	it( 'rejects the whole batch when only its second rule loses access before persistence', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		const permissions = new SharedPermissionStateApi();
		let firstRuleAccessible = false;

		/**
		 * Revokes only the second rule after browser consent and before the batch mutation.
		 * @param mutation - Deferred protected-site configuration mutation.
		 * @return Coordinated configuration edit result.
		 * @since 0.1.0 Initial implementation.
		 */
		async function coordinateMutation(
			mutation: ProtectionConfigurationMutation,
		): Promise<ProtectionConfigurationEditResult> {
			permissions.origins.delete( '*://*.reddit.com/*' );
			firstRuleAccessible = await permissions.contains( {
				origins: [ '*://*.youtube.com/*' ], permissions: [ 'webNavigation' ],
			} );

			return mutation();
		}

		const service = createService(
			storage, createSitePermissionManager( { permissions } ), coordinateMutation,
		);

		await expect( service.addMany( [ 'youtube.com', 'reddit.com' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
		} );
		expect( firstRuleAccessible ).toBe( true );
		expect( storage.writes ).toBe( 0 );
		expect( storage.configuration ).toEqual( EMPTY_CONFIGURATION );
		expect( permissions.origins ).toEqual( new Set( [ '*://*.example.com/*' ] ) );
		expect( permissions.permissions ).toEqual( new Set( [ 'webNavigation' ] ) );
	} );

	it( 'reports retained batch access when storage cannot be read for compensation', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.rejectLoads = true;
		const permissions = new SharedPermissionStateApi();

		await expect( createService( storage, createSitePermissionManager( { permissions } ) )
			.addMany( [ 'youtube.com' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
		expect( storage.writes ).toBe( 0 );
		expect( permissions.origins.has( '*://*.youtube.com/*' ) ).toBe( true );
	} );

	it( 'keeps malformed stored configuration intact and reports retained batch access', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.returnMalformedConfiguration = true;
		const permissions = new SharedPermissionStateApi();

		await expect( createService( storage, createSitePermissionManager( { permissions } ) )
			.addMany( [ 'youtube.com' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
		expect( storage.writes ).toBe( 0 );
		expect( permissions.origins.has( '*://*.youtube.com/*' ) ).toBe( true );
	} );

	it( 'retains uncertain batch grants after failed persistence and reports the cleanup limitation', async () => {
		const storage = new MemoryEnrollmentStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const permissions = new SharedPermissionStateApi();
		vi.spyOn( permissions, 'getAll' ).mockRejectedValue( new Error( 'Browser snapshot unavailable.' ) );

		await expect( createService( storage, createSitePermissionManager( { permissions } ) )
			.addMany( [ 'youtube.com' ] ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} );
		expect( storage.writes ).toBe( 0 );
		expect( permissions.origins.has( '*://*.youtube.com/*' ) ).toBe( true );
	} );

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
				measurementRevisionsByScope: UPDATED_EMPTY_CONFIGURATION.measurementRevisionsByScope,
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
			configuration: UPDATED_EMPTY_CONFIGURATION,
			permissionReleaseStatus: SitePermissionReleaseStatus.RETAINED,
			site: EXAMPLE_SITE,
		} );
		expect( permissionManager.releasedRules ).toEqual( [ EXAMPLE_SITE.rule ] );
		expect( permissionManager.releaseRemainingSites ).toEqual( [ false ] );
	} );

	it( 'uses the authoritative removed site for permission cleanup and its result', async () => {
		const storage = new MemoryEnrollmentStorage( AUTHORITATIVE_CONFIGURATION );
		const permissionManager = new MemoryEnrollmentPermissionManager();
		const service = createService( storage, permissionManager );

		await expect( service.remove( EXAMPLE_SITE ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: EMPTY_CONFIGURATION,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
			site: AUTHORITATIVE_SITE,
		} );
		expect( permissionManager.releasedRules ).toEqual( [ AUTHORITATIVE_SITE.rule ] );
		expect( storage.writes ).toBe( 1 );
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
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( createTestProtectionMeasurementRevision() )
			.mockReturnValueOnce( 'revision_after_removal_cleanup' );
		const removalPermissionManager = new MemoryEnrollmentPermissionManager();
		removalPermissionManager.deferNextRelease();
		const enrollmentPermissionManager = new MemoryEnrollmentPermissionManager();
		const removalService = createService(
			storage,
			removalPermissionManager,
			coordinateMutation,
			createMeasurementRevision,
		);
		const enrollmentService = createService(
			storage,
			enrollmentPermissionManager,
			coordinateMutation,
			createMeasurementRevision,
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
			configuration: UPDATED_EMPTY_CONFIGURATION,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
			site: EXAMPLE_SITE,
		} );
		await expect( enrollment ).resolves.toMatchObject( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
		} );
		expect( storage.configuration.sites ).toEqual( [ EXAMPLE_SITE ] );
	} );

	it( 'does not persist an enrollment whose complete grant is revoked while it waits for coordination', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const coordinateMutation = createSharedMutationCoordinator();
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( createTestProtectionMeasurementRevision() )
			.mockReturnValueOnce( 'revision_after_permission_cleanup' );
		const permissions = new SharedPermissionStateApi();
		permissions.deferNextRemoval();
		const permissionManager = createSitePermissionManager( { permissions } );
		const removalService = createService(
			storage,
			permissionManager,
			coordinateMutation,
			createMeasurementRevision,
		);
		const enrollmentService = createService(
			storage,
			permissionManager,
			coordinateMutation,
			createMeasurementRevision,
		);
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
		expect( storage.configuration ).toEqual( UPDATED_EMPTY_CONFIGURATION );
		expect( storage.writes ).toBe( 1 );
	} );

	it( 'preserves existing batch grants while cleaning up new access after deferred removal revokes navigation', async () => {
		const storage = new MemoryEnrollmentStorage( POPULATED_CONFIGURATION );
		const coordinateMutation = createSharedMutationCoordinator();
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( createTestProtectionMeasurementRevision() )
			.mockReturnValueOnce( 'revision_after_batch_permission_cleanup' );
		const permissions = new SharedPermissionStateApi();
		permissions.origins.add( '*://*.youtube.com/*' );
		permissions.deferNextRemoval();
		const permissionManager = createSitePermissionManager( { permissions } );
		const removalService = createService(
			storage, permissionManager, coordinateMutation, createMeasurementRevision,
		);
		const enrollmentService = createService(
			storage, permissionManager, coordinateMutation, createMeasurementRevision,
		);
		const removal = removalService.remove( EXAMPLE_SITE );

		await permissions.removalStarted;
		const enrollment = enrollmentService.addMany( [ 'youtube.com', 'another.test' ] );
		expect( permissions.origins ).toEqual( new Set( [
			'*://*.example.com/*', '*://*.youtube.com/*', '*://another.test/*',
		] ) );
		permissions.completeDeferredRemoval();

		await expect( removal ).resolves.toMatchObject( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
		} );
		await expect( enrollment ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
		} );
		expect( storage.configuration ).toEqual( UPDATED_EMPTY_CONFIGURATION );
		expect( storage.writes ).toBe( 1 );
		expect( permissions.origins ).toEqual( new Set( [ '*://*.youtube.com/*' ] ) );
		expect( permissions.permissions.size ).toBe( 0 );
	} );
} );
