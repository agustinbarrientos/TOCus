import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from './index';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
} from '../../types/protection-value';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__';
import {
	DefaultProtectionSchedule,
	ScheduleMode,
	Weekday,
} from '../../types/protection-schedule';
import { CompletionAction } from '../../types/completion-action';
import { ProtectionScopeIdSchema } from '../../types/protection-value';
import type { ProtectionConfigurationStorageService } from '../protection-configuration-storage';

/**
 * Primary protected-site fixture used by editor tests.
 * @since 1.0.0 Initial implementation.
 */
const CONFIGURED_SITE: ProtectedSiteConfiguration = {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
/**
 * Secondary protected-site fixture used by multi-site editor tests.
 * @since 1.0.0 Initial implementation.
 */
const CONFIGURED_SECOND_SITE: ProtectedSiteConfiguration = {
	identityHost: 'www.youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
/**
 * Protection configuration containing the primary site fixture.
 * @since 1.0.0 Initial implementation.
 */
const CONFIGURATION_WITH_SITE: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ CONFIGURED_SITE ],
};

/**
 * Configuration whose default-scope membership revision has changed.
 * @since 1.0.0 Initial implementation.
 */
const CONFIGURATION_WITH_SITE_AFTER_MEMBERSHIP_CHANGE: ProtectionConfigurationDocument = {
	...CONFIGURATION_WITH_SITE,
	measurementRevisionsByScope: {
		scope_default: ProtectionMeasurementRevisionSchema.parse( 'revision_test_next' ),
	},
};

/**
 * Empty configuration whose default-scope membership revision has changed.
 * @since 1.0.0 Initial implementation.
 */
const CONFIGURATION_WITHOUT_SITE_AFTER_MEMBERSHIP_CHANGE: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	measurementRevisionsByScope: {
		scope_default: ProtectionMeasurementRevisionSchema.parse( 'revision_test_next' ),
	},
};

/**
 * In-memory configuration storage used to verify complete editor behavior.
 * @since 1.0.0 Initial implementation.
 */
class MemoryProtectionConfigurationEditorStorage implements ProtectionConfigurationStorageService {
	readonly writes: unknown[] = [];

	/**
	 * Creates in-memory storage with one initial load result.
	 * @param configuration - Configuration returned before the first write.
	 * @since 1.0.0 Initial implementation.
	 */
	constructor( private configuration: ProtectionConfigurationDocument | null ) {}

	/**
	 * Loads the latest in-memory configuration.
	 * @return Current configuration or malformed-data marker.
	 * @since 1.0.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores one configuration and records the exact write.
	 * @param input - Configuration to persist.
	 * @return Promise resolved after the in-memory write.
	 * @since 1.0.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.writes.push( input );
		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * In-memory storage that holds its first write until a concurrency test releases it.
 * @since 1.0.0 Initial implementation.
 */
class DeferredFirstWriteStorage implements ProtectionConfigurationStorageService {
	configuration: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };

	loads = 0;

	readonly writes: ProtectionConfigurationDocument[] = [];

	private pendingConfiguration: ProtectionConfigurationDocument | null = null;

	private resolvePendingSave: ( () => void ) | null = null;

	/**
	 * Loads the configuration that has fully completed persistence.
	 * @return Current persisted configuration.
	 * @since 1.0.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		this.loads += 1;

		return Promise.resolve( this.configuration );
	}

	/**
	 * Defers the first write and completes every later write immediately.
	 * @param input - Complete configuration candidate.
	 * @return Promise resolved when the write completes.
	 * @since 1.0.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		const configuration = input as ProtectionConfigurationDocument;
		this.writes.push( configuration );

		if ( this.writes.length > 1 ) {
			this.configuration = configuration;

			return Promise.resolve();
		}

		this.pendingConfiguration = configuration;

		return new Promise<void>( ( resolve ) => {
			this.resolvePendingSave = resolve;
		} );
	}

	/**
	 * Completes the deferred first write.
	 * @since 1.0.0 Initial implementation.
	 */
	completeFirstSave(): void {
		if ( this.pendingConfiguration === null || this.resolvePendingSave === null ) {
			throw new Error( 'Expected one deferred editor write.' );
		}

		this.configuration = this.pendingConfiguration;
		this.resolvePendingSave();
		this.pendingConfiguration = null;
		this.resolvePendingSave = null;
	}
}

/**
 * In-memory storage that rejects its first write and accepts later writes.
 * @since 1.0.0 Initial implementation.
 */
class RejectingFirstWriteStorage implements ProtectionConfigurationStorageService {
	configuration: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };

	writes = 0;

	/**
	 * Loads the latest successfully persisted configuration.
	 * @return Current persisted configuration.
	 * @since 1.0.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Rejects the first write and persists each later write.
	 * @param input - Complete configuration candidate.
	 * @return Promise resolved after a successful write.
	 * @since 1.0.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.writes += 1;

		if ( this.writes === 1 ) {
			return Promise.reject( new Error( 'First write rejected.' ) );
		}

		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * Creates one deterministic valid measurement revision.
 * @return Stable measurement revision.
 * @since 1.0.0 Initial implementation.
 */
function createValidMeasurementRevision(): string {
	return 'revision_test_next';
}

/**
 * Runs one mutation immediately when cross-context coordination is irrelevant to a test.
 * @param mutation - Deferred protected-site configuration mutation.
 * @return Exact mutation result.
 * @since 1.0.0 Initial implementation.
 */
function coordinateMutationDirectly(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return mutation();
}

/**
 * Resolves a test mutation queue after either mutation outcome.
 * @return Undefined queue settlement value.
 * @since 1.0.0 Initial implementation.
 */
function releaseTestMutationQueue(): undefined {
	return undefined;
}

/**
 * Creates one shared coordinator that serializes mutations across editor instances.
 * @return Cross-instance mutation coordinator.
 * @since 1.0.0 Initial implementation.
 */
function createSharedMutationCoordinator(): (
	mutation: ProtectionConfigurationMutation,
) => Promise<ProtectionConfigurationEditResult> {
	let mutationQueue: Promise<void> = Promise.resolve();

	/**
	 * Runs one mutation after all earlier coordinated mutations settle.
	 * @param mutation - Deferred protected-site configuration mutation.
	 * @return Exact mutation result.
	 * @since 1.0.0 Initial implementation.
	 */
	function coordinateMutation(
		mutation: ProtectionConfigurationMutation,
	): Promise<ProtectionConfigurationEditResult> {
		const result = mutationQueue.then( mutation );
		mutationQueue = result.then( releaseTestMutationQueue, releaseTestMutationQueue );

		return result;
	}

	return coordinateMutation;
}

/**
 * Attempts to remove one absent site through the supplied editor.
 * @param editor - Protected-site configuration editor under test.
 * @return Rejected removal result.
 * @since 1.0.0 Initial implementation.
 */
function removeMissingSite(
	editor: ReturnType<typeof createProtectionConfigurationEditor>,
) {
	return editor.remove( 'missing.example' );
}

/**
 * Attempts to update one absent site through the supplied editor.
 * @param editor - Protected-site configuration editor under test.
 * @return Rejected update result.
 * @since 1.0.0 Initial implementation.
 */
function updateMissingSite(
	editor: ReturnType<typeof createProtectionConfigurationEditor>,
) {
	return editor.update( 'missing.example', 'Name' );
}

/**
 * Attempts to remove an invalid site identity through the supplied editor.
 * @param editor - Protected-site configuration editor under test.
 * @return Rejected removal result.
 * @since 1.0.0 Initial implementation.
 */
function removeInvalidSite(
	editor: ReturnType<typeof createProtectionConfigurationEditor>,
) {
	return editor.remove( 'not a host' );
}

/**
 * Attempts to update an invalid site identity through the supplied editor.
 * @param editor - Protected-site configuration editor under test.
 * @return Rejected update result.
 * @since 1.0.0 Initial implementation.
 */
function updateInvalidSite(
	editor: ReturnType<typeof createProtectionConfigurationEditor>,
) {
	return editor.update( 'not a host', 'Name' );
}

/**
 * Creates an editor backed by deterministic in-memory dependencies.
 * @param configuration - Initial configuration or malformed-data marker.
 * @param createMeasurementRevision - Measurement revision factory used by edits.
 * @return Editor and observable in-memory storage.
 * @since 1.0.0 Initial implementation.
 */
function createEditor(
	configuration: ProtectionConfigurationDocument | null = CONFIGURATION_WITH_SITE,
	createMeasurementRevision: () => unknown = createValidMeasurementRevision,
) {
	const storage = new MemoryProtectionConfigurationEditorStorage( configuration );
	const editor = createProtectionConfigurationEditor( {
		storage,
		createMeasurementRevision,
		coordinateMutation: coordinateMutationDirectly,
	} );

	return { editor, storage };
}

describe( 'createProtectionConfigurationEditor', () => {
	it( 'rejects incomplete custom site hours without changing the saved name or site', async () => {
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE );
		await expect( editor.update( CONFIGURED_SITE.identityHost, 'New name', {
			mode: ScheduleMode.CUSTOM, windows: [],
		} ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE,
		} );
		expect( storage.writes ).toEqual( [] );
		expect( await editor.load() ).toEqual( CONFIGURATION_WITH_SITE );
	} );
	it( 'saves a site schedule and automatic name in one write without separating its timer', async () => {
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE );
		const schedule = { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 540,
			endMinute: 1020 } ] };

		const result = await editor.update( CONFIGURED_SITE.identityHost, '', schedule );

		expect( result.status ).toBe( ProtectionConfigurationEditStatus.UPDATED );
		expect( storage.writes ).toHaveLength( 1 );
		expect( await editor.load() ).toEqual( {
			...CONFIGURATION_WITH_SITE,
			sites: [ { ...CONFIGURED_SITE, schedule } ],
		} );
	} );
	it( 'keeps the saved site set when a draft cannot allocate its membership revision', async () => {
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE, () => 'invalid revision' );
		const result = await editor.replaceSites( [ CONFIGURED_SITE ], [] );
		expect( result ).toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toHaveLength( 0 );
		expect( ( await editor.load() )?.sites ).toEqual( [ CONFIGURED_SITE ] );
	} );
	it( 'keeps measurement revisions for a name-only draft and performs no write for an unchanged draft', async () => {
		const factory = vi.fn().mockReturnValue( 'revision_unexpected' );
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE, factory );
		await editor.replaceSites( [ CONFIGURED_SITE ], [ CONFIGURED_SITE ] );
		expect( storage.writes ).toHaveLength( 0 );
		await editor.replaceSites( [ CONFIGURED_SITE ], [ { ...CONFIGURED_SITE, displayNameOverride: 'My photos' } ] );
		expect( storage.writes ).toHaveLength( 1 );
		expect( ( await editor.load() )?.measurementRevisionsByScope )
			.toEqual( CONFIGURATION_WITH_SITE.measurementRevisionsByScope );
		expect( factory ).not.toHaveBeenCalled();
	} );

	it( 'reconciles scopes once for a combined addition edit and removal', async () => {
		const revisionFactory = vi.fn().mockReturnValueOnce( 'revision_shared_next' ).mockReturnValueOnce( 'revision_independent_next' );
		const { editor, storage } = createEditor(
			{ ...CONFIGURATION_WITH_SITE, sites: [ CONFIGURED_SITE, CONFIGURED_SECOND_SITE ] }, revisionFactory,
		);
		const schedule = { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 540,
			endMinute: 600 } ] };
		const nextSites = [ { ...CONFIGURED_SITE, displayNameOverride: 'Photos', schedule }, {
			identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId },
		} ];
		await editor.replaceSites( [ CONFIGURED_SITE, CONFIGURED_SECOND_SITE ], nextSites );
		expect( storage.writes ).toHaveLength( 1 );
		expect( ( await editor.load() )?.sites ).toEqual( nextSites );
		expect( ( await editor.load() )?.schedule ).toEqual( DefaultProtectionSchedule );
		expect( revisionFactory ).toHaveBeenCalledOnce();
	} );
	it( 'replaces a complete draft with one write and preserves unrelated latest timing', async () => {
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE );
		const nextTiming = { ...CONFIGURATION_WITH_SITE.timingConfiguration, initialWaitMilliseconds: 20_000 };
		await editor.updateTiming( nextTiming );
		storage.writes.length = 0;
		const result = await editor.replaceSites( [ CONFIGURED_SITE ], [ CONFIGURED_SECOND_SITE ] );
		expect( result.status ).toBe( ProtectionConfigurationEditStatus.UPDATED );
		expect( storage.writes ).toHaveLength( 1 );
		expect( await editor.load() ).toMatchObject( {
			sites: [ CONFIGURED_SECOND_SITE ], timingConfiguration: nextTiming,
		} );
	} );

	it( 'rejects a stale website baseline without overwriting a concurrent site edit', async () => {
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE );
		await editor.update( CONFIGURED_SITE.identityHost, 'A newer name' );
		storage.writes.length = 0;
		const result = await editor.replaceSites( [ CONFIGURED_SITE ], [] );
		expect( result.status ).toBe( ProtectionConfigurationEditStatus.REJECTED );
		expect( storage.writes ).toHaveLength( 0 );
		expect( ( await editor.load() )?.sites[ 0 ]?.displayNameOverride ).toBe( 'A newer name' );
	} );

	it( 'rejects overlapping complete drafts without writes', async () => {
		const { editor, storage } = createEditor( CONFIGURATION_WITH_SITE );
		expect( ( await editor.replaceSites( [ CONFIGURED_SITE ], [ CONFIGURED_SITE, CONFIGURED_SITE ] ) ).status )
			.toBe( ProtectionConfigurationEditStatus.REJECTED );
		expect( storage.writes ).toHaveLength( 0 );
	} );
	it( 'deduplicates a shared batch and rotates its measurement revision once for the atomic write', async () => {
		const revisionFactory = vi.fn().mockReturnValue( 'revision_batch' );
		const { editor, storage } = createEditor( { ...TestEmptyProtectionConfiguration }, revisionFactory );
		const result = await editor.addMany( [ 'www.youtube.com', 'reddit.com', 'm.youtube.com' ] );

		expect( result.status ).toBe( ProtectionConfigurationEditStatus.UPDATED );
		expect( storage.writes ).toHaveLength( 1 );
		expect( ProtectionConfigurationDocumentSchema.parse( storage.writes[ 0 ] ).sites.map(
			( site ) => site.identityHost,
		) ).toEqual( [
			'www.youtube.com', 'reddit.com',
		] );
		expect( revisionFactory ).toHaveBeenCalledOnce();
	} );

	it( 'loads current configuration without altering it', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.load() ).resolves.toEqual( CONFIGURATION_WITH_SITE );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'rotates only the shared scope revision when shared membership changes', async () => {
		const createMeasurementRevision = vi.fn().mockReturnValue( 'revision_shared_add' );
		const { editor } = createEditor(
			{ ...TestEmptyProtectionConfiguration },
			createMeasurementRevision,
		);

		await expect( editor.add( 'instagram.com' ) ).resolves.toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				measurementRevisionsByScope: {
					scope_default: 'revision_shared_add',
				},
			},
		} );
		expect( createMeasurementRevision ).toHaveBeenCalledOnce();
	} );



	it( 'keeps shared measurement identity when only a site schedule changes', async () => {
		const factory = vi.fn();
		const { editor } = createEditor( CONFIGURATION_WITH_SITE, factory );
		await editor.update( CONFIGURED_SITE.identityHost, '', {
			mode: ScheduleMode.CUSTOM,
			windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 600 } ],
		} );
		expect( ( await editor.load() )?.measurementRevisionsByScope )
			.toEqual( CONFIGURATION_WITH_SITE.measurementRevisionsByScope );
		expect( factory ).not.toHaveBeenCalled();
	} );

	it( 'rotates the shared revision once when global allowance duration changes', async () => {
		const configuration = { ...CONFIGURATION_WITH_SITE, sites: [ CONFIGURED_SITE, CONFIGURED_SECOND_SITE ] };
		const factory = vi.fn().mockReturnValue( 'revision_shared_after_allowance_change' );
		const { editor } = createEditor( configuration, factory );
		await expect( editor.updateTiming( {
			...configuration.timingConfiguration, allowanceMilliseconds: 10 * 60_000,
		} ) ).resolves.toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: { measurementRevisionsByScope: { scope_default: 'revision_shared_after_allowance_change' } },
		} );
		expect( factory ).toHaveBeenCalledOnce();
	} );

	it( 'does not rotate revisions for display, schedule, wait, step, action, or unchanged edits', async () => {
		const createMeasurementRevision = vi.fn().mockReturnValue( 'revision_unexpected' );
		const { editor } = createEditor( CONFIGURATION_WITH_SITE, createMeasurementRevision );

		await editor.update( 'www.instagram.com', 'Instagram' );
		await editor.updateSchedule( { mode: ScheduleMode.ALWAYS } );
		await editor.updateTiming( {
			...CONFIGURATION_WITH_SITE.timingConfiguration,
			initialWaitMilliseconds: 15_000,
			ladderIncreaseMilliseconds: 3_000,
			maximumWaitMilliseconds: 60_000,
			completionAction: CompletionAction.OPEN_AUTOMATICALLY,
		} );
		await editor.updateTiming( {
			...CONFIGURATION_WITH_SITE.timingConfiguration,
			initialWaitMilliseconds: 15_000,
			ladderIncreaseMilliseconds: 3_000,
			maximumWaitMilliseconds: 60_000,
			completionAction: CompletionAction.OPEN_AUTOMATICALLY,
		} );

		expect( createMeasurementRevision ).not.toHaveBeenCalled();
		expect( await editor.load() ).toMatchObject( {
			measurementRevisionsByScope: CONFIGURATION_WITH_SITE.measurementRevisionsByScope,
		} );
	} );

	it( 'uses another revision when a scope membership change is reverted', async () => {
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( 'revision_default_without_site' )
			.mockReturnValueOnce( 'revision_default_with_site_again' );
		const { editor } = createEditor( CONFIGURATION_WITH_SITE, createMeasurementRevision );

		await editor.remove( 'www.instagram.com' );
		await expect( editor.add( 'www.instagram.com' ) ).resolves.toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				measurementRevisionsByScope: {
					scope_default: 'revision_default_with_site_again',
				},
			},
		} );
		expect( createMeasurementRevision ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'rejects a membership change when the revision factory returns an invalid value', async () => {
		const createMeasurementRevision = vi.fn().mockReturnValue( 'not a valid revision' );
		const { editor, storage } = createEditor(
			{ ...TestEmptyProtectionConfiguration },
			createMeasurementRevision,
		);

		await expect( editor.add( 'instagram.com' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'rejects removal when the revision factory returns an invalid value', async () => {
		const createMeasurementRevision = vi.fn().mockReturnValue( 'not a valid revision' );
		const { editor, storage } = createEditor(
			CONFIGURATION_WITH_SITE,
			createMeasurementRevision,
		);

		await expect( editor.remove( 'www.instagram.com' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );



	it( 'rejects an allowance change when the revision factory returns an invalid value', async () => {
		const createMeasurementRevision = vi.fn().mockReturnValue( 'not a valid revision' );
		const { editor, storage } = createEditor(
			CONFIGURATION_WITH_SITE,
			createMeasurementRevision,
		);

		await expect( editor.updateTiming( {
			...CONFIGURATION_WITH_SITE.timingConfiguration,
			allowanceMilliseconds: 10 * 60_000,
		} ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'adds a URL as one whole-domain site in the default shared scope', async () => {
		const { editor, storage } = createEditor( { ...TestEmptyProtectionConfiguration } );

		await expect( editor.add( 'https://www.instagram.com/reels' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: CONFIGURATION_WITH_SITE_AFTER_MEMBERSHIP_CHANGE,
		} );
		expect( storage.writes ).toEqual( [ CONFIGURATION_WITH_SITE_AFTER_MEMBERSHIP_CHANGE ] );
	} );

	it( 'runs an add pre-persist check after validation and before storage', async () => {
		const { editor, storage } = createEditor( { ...TestEmptyProtectionConfiguration } );
		const beforePersist = vi.fn().mockImplementation(
			( configuration: ProtectionConfigurationDocument ): Promise<void> => {
				expect( configuration ).toEqual( CONFIGURATION_WITH_SITE_AFTER_MEMBERSHIP_CHANGE );
				expect( storage.writes ).toEqual( [] );

				return Promise.resolve();
			},
		);

		await expect(
			editor.add( 'https://www.instagram.com/reels', beforePersist ),
		).resolves.toMatchObject( { status: ProtectionConfigurationEditStatus.UPDATED } );
		expect( beforePersist ).toHaveBeenCalledOnce();
		expect( storage.writes ).toEqual( [ CONFIGURATION_WITH_SITE_AFTER_MEMBERSHIP_CHANGE ] );
	} );



	it( 'rejects a draft that attempts to create a separate countdown', async () => {
		const { editor, storage } = createEditor();
		await expect( editor.replaceSites( [ CONFIGURED_SITE ], [ {
			...CONFIGURED_SITE,
			rule: { ...CONFIGURED_SITE.rule, scopeId: ProtectionScopeIdSchema.parse( 'scope_separate' ) },
		} ] ) ).resolves.toMatchObject( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'serializes concurrent mutations so later writes include earlier changes', async () => {
		const storage = new DeferredFirstWriteStorage();
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( 'revision_concurrent_first' )
			.mockReturnValueOnce( 'revision_concurrent_second' );
		const editor = createProtectionConfigurationEditor( {
			storage,
			createMeasurementRevision,
			coordinateMutation: coordinateMutationDirectly,
		} );
		const firstEdit = editor.add( 'instagram.com' );
		const secondEdit = editor.add( 'youtube.com' );

		await vi.waitFor( () => {
			expect( storage.writes ).toHaveLength( 1 );
		} );
		expect( storage.loads ).toBe( 1 );

		storage.completeFirstSave();
		await expect( Promise.all( [ firstEdit, secondEdit ] ) ).resolves.toHaveLength( 2 );
		expect( storage.configuration.sites.map( ( site ) => site.rule.host ) ).toEqual( [
			'instagram.com',
			'youtube.com',
		] );
		expect( storage.loads ).toBe( 2 );
		expect( storage.writes ).toHaveLength( 2 );
	} );

	it( 'coordinates mutations across separate editor instances before either reads storage', async () => {
		const storage = new DeferredFirstWriteStorage();
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( 'revision_coordinated_first' )
			.mockReturnValueOnce( 'revision_coordinated_second' );
		const editorOptions = {
			storage,
			createMeasurementRevision,
			coordinateMutation: createSharedMutationCoordinator(),
		};
		const firstEditor = createProtectionConfigurationEditor( editorOptions );
		const secondEditor = createProtectionConfigurationEditor( editorOptions );
		const firstEdit = firstEditor.add( 'instagram.com' );
		const secondEdit = secondEditor.add( 'youtube.com' );

		await vi.waitFor( () => {
			expect( storage.writes ).toHaveLength( 1 );
		} );
		expect( storage.loads ).toBe( 1 );

		storage.completeFirstSave();
		await expect( Promise.all( [ firstEdit, secondEdit ] ) ).resolves.toHaveLength( 2 );
		expect( storage.configuration.sites.map( ( site ) => site.rule.host ) ).toEqual( [
			'instagram.com',
			'youtube.com',
		] );
		expect( storage.loads ).toBe( 2 );
		expect( storage.writes ).toHaveLength( 2 );
	} );

	it( 'continues queued mutations after an earlier persistence rejection', async () => {
		const storage = new RejectingFirstWriteStorage();
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( 'revision_rejected_write' )
			.mockReturnValueOnce( 'revision_recovered_write' );
		const editor = createProtectionConfigurationEditor( {
			storage,
			createMeasurementRevision,
			coordinateMutation: coordinateMutationDirectly,
		} );
		const firstEdit = editor.add( 'instagram.com' );
		const secondEdit = editor.add( 'youtube.com' );

		await expect( firstEdit ).rejects.toThrow( 'First write rejected.' );
		await expect( secondEdit ).resolves.toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				sites: [ { rule: { host: 'youtube.com' } } ],
			},
		} );
		expect( storage.writes ).toBe( 2 );
	} );

	it( 'rejects another identity whose whole-domain rule is already protected', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.add( 'https://business.instagram.com/' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it.each( [
		'chrome://settings',
		'https://',
		'com',
		'',
	] )( 'rejects the unprotectable site input %j', async ( siteInput ) => {
		const { editor, storage } = createEditor();

		await expect( editor.add( siteInput ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'rejects malformed stored configuration without replacing it', async () => {
		const { editor, storage } = createEditor( null );

		await expect( editor.add( 'example.com' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it.each( [
		{
			label: 'remove',
			edit: removeMissingSite,
		},
		{
			label: 'update',
			edit: updateMissingSite,
		},
	] )( 'rejects a $label when the stored configuration is malformed', async ( { edit } ) => {
		const { editor, storage } = createEditor( null );

		await expect( edit( editor ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'stores a trimmed editable display name in one write', async () => {
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( 'revision_updated_shared' )
			.mockReturnValueOnce( 'revision_updated_independent' );
		const { editor, storage } = createEditor(
			{
				...TestEmptyProtectionConfiguration,
				sites: [ CONFIGURED_SITE, CONFIGURED_SECOND_SITE ],
			},
			createMeasurementRevision,
		);

		const result = await editor.update( 'www.instagram.com', '  My Instagram  ' );

		expect( result ).toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				sites: [
					{
						displayNameOverride: 'My Instagram',
						rule: { scopeId: DefaultProtectionScopeId },
					},
					CONFIGURED_SECOND_SITE,
				],
			},
		} );
		expect( storage.writes ).toHaveLength( 1 );
		expect( CONFIGURATION_WITH_SITE.sites[ 0 ] ).not.toHaveProperty( 'displayNameOverride' );
	} );

	it( 'clears an editable name so local automatic naming is used again', async () => {
		const { editor } = createEditor( {
			...CONFIGURATION_WITH_SITE,
			sites: [ {
				...CONFIGURED_SITE,
				displayNameOverride: 'Social pause',
			} ],
		} );

		await expect( editor.update( 'www.instagram.com', '   ' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: CONFIGURATION_WITH_SITE,
		} );
	} );

	it( 'rejects an overlong editable display name', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.update( 'www.instagram.com', 'a'.repeat( 81 ) ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_DISPLAY_NAME,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'removes only the requested exact site identity', async () => {
		const { editor, storage } = createEditor( {
			...TestEmptyProtectionConfiguration,
			sites: [ CONFIGURED_SITE, CONFIGURED_SECOND_SITE ],
		} );

		await expect( editor.remove( 'www.instagram.com' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				...TestEmptyProtectionConfiguration,
				sites: [ CONFIGURED_SECOND_SITE ],
				measurementRevisionsByScope: {
					scope_default: 'revision_test_next',
				},
			},
		} );
		expect( storage.writes ).toHaveLength( 1 );
		expect( CONFIGURATION_WITH_SITE.sites ).toHaveLength( 1 );
	} );

	it( 'supplies the authoritative removed site in the final settlement', async () => {
		const { editor, storage } = createEditor();
		const finalize = vi.fn();

		const result = await editor.remove( 'www.instagram.com', finalize );

		expect( finalize ).toHaveBeenCalledWith( {
			configuration: CONFIGURATION_WITHOUT_SITE_AFTER_MEMBERSHIP_CHANGE,
			result,
			removedSite: CONFIGURED_SITE,
		} );
		expect( storage.writes ).toEqual( [
			CONFIGURATION_WITHOUT_SITE_AFTER_MEMBERSHIP_CHANGE,
		] );
	} );

	it( 'finalizes a failed removal write with the authoritative site', async () => {
		const storage = new RejectingFirstWriteStorage();
		storage.configuration = CONFIGURATION_WITH_SITE;
		const editor = createProtectionConfigurationEditor( {
			storage,
			createMeasurementRevision: createValidMeasurementRevision,
			coordinateMutation: coordinateMutationDirectly,
		} );
		const finalize = vi.fn();

		await expect( editor.remove( 'www.instagram.com', finalize ) ).rejects.toThrow(
			'First write rejected.',
		);
		expect( finalize ).toHaveBeenCalledWith( {
			configuration: CONFIGURATION_WITH_SITE,
			result: null,
			removedSite: CONFIGURED_SITE,
		} );
		expect( storage.writes ).toBe( 1 );
	} );

	it( 'clears a custom schedule without changing the shared countdown identity', async () => {
		const { editor } = createEditor( {
			...CONFIGURATION_WITH_SITE,
			sites: [ { ...CONFIGURED_SITE, schedule: {
				mode: ScheduleMode.CUSTOM,
				windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 600 } ],
			} } ],
		} );
		await expect( editor.update( CONFIGURED_SITE.identityHost, '' ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED, configuration: CONFIGURATION_WITH_SITE,
		} );
	} );

	it.each( [
		{
			label: 'remove',
			edit: removeMissingSite,
		},
		{
			label: 'update',
			edit: updateMissingSite,
		},
	] )( 'rejects a $label for an unknown exact site identity', async ( { edit } ) => {
		const { editor, storage } = createEditor();

		await expect( edit( editor ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it.each( [
		{
			label: 'remove',
			edit: removeInvalidSite,
		},
		{
			label: 'update',
			edit: updateInvalidSite,
		},
	] )( 'rejects a $label for an invalid exact site identity', async ( { edit } ) => {
		const { editor, storage } = createEditor();

		await expect( edit( editor ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'updates the global timing configuration without changing sites or schedules', async () => {
		const { editor, storage } = createEditor();
		const timingConfiguration = {
			initialWaitMilliseconds: 20_000,
			ladderIncreaseMilliseconds: 3_000,
			maximumWaitMilliseconds: 60_000,
			allowanceMilliseconds: 12 * 60_000,
			completionAction: CompletionAction.OPEN_AUTOMATICALLY,
		};

		await expect( editor.updateTiming( timingConfiguration ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				...CONFIGURATION_WITH_SITE,
				timingConfiguration,
				measurementRevisionsByScope: {
					scope_default: 'revision_test_next',
				},
			},
		} );
		expect( storage.writes ).toHaveLength( 1 );
	} );

	it( 'rejects an invalid timing configuration without writing', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.updateTiming( {
			...CONFIGURATION_WITH_SITE.timingConfiguration,
			maximumWaitMilliseconds: 5_000,
		} ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_TIMING_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'normalizes and updates the global schedule', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.updateSchedule( {
			mode: ScheduleMode.CUSTOM,
			windows: [
				{ weekday: Weekday.MONDAY, startMinute: 540, endMinute: 720 },
				{ weekday: Weekday.MONDAY, startMinute: 720, endMinute: 1_020 },
			],
		} ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				...CONFIGURATION_WITH_SITE,
				schedule: {
					mode: ScheduleMode.CUSTOM,
					windows: [ {
						weekday: Weekday.MONDAY,
						startMinute: 540,
						endMinute: 1_020,
					} ],
				},
			},
		} );
		expect( storage.writes ).toHaveLength( 1 );
	} );

	it.each( [
		{
			label: 'invalid schedule',
			schedule: {
				mode: ScheduleMode.CUSTOM,
				windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 540 } ],
			},
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE,
		},
	] )( 'rejects an $label without writing', async ( { schedule, reason } ) => {
		const { editor, storage } = createEditor();

		await expect( editor.updateSchedule( schedule ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'rejects schedule and timing edits when the stored configuration is malformed', async () => {
		const { editor, storage } = createEditor( null );

		await expect( editor.updateSchedule( { mode: ScheduleMode.ALWAYS } ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		await expect( editor.updateTiming(
			CONFIGURATION_WITH_SITE.timingConfiguration,
		) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} );
		expect( storage.writes ).toEqual( [] );
	} );
} );
