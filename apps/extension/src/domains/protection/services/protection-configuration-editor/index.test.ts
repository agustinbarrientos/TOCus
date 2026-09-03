import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from './index';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import {
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
import { type ProtectionConfigurationStorageService } from '../protection-configuration-storage';

const CONFIGURED_SITE: ProtectedSiteConfiguration = {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
const CONFIGURED_SECOND_SITE: ProtectedSiteConfiguration = {
	identityHost: 'www.youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
const CONFIGURATION_WITH_SITE: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ CONFIGURED_SITE ],
};

/**
 * In-memory configuration storage used to verify complete editor behavior.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectionConfigurationEditorStorage implements ProtectionConfigurationStorageService {
	readonly writes: unknown[] = [];

	/**
	 * Creates in-memory storage with one initial load result.
	 * @param configuration - Configuration returned before the first write.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private configuration: ProtectionConfigurationDocument | null ) {}

	/**
	 * Loads the latest in-memory configuration.
	 * @return Current configuration or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores one configuration and records the exact write.
	 * @param input - Configuration to persist.
	 * @return Promise resolved after the in-memory write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.writes.push( input );
		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * In-memory storage that holds its first write until a concurrency test releases it.
 * @since 0.1.0 Initial implementation.
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
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		this.loads += 1;

		return Promise.resolve( this.configuration );
	}

	/**
	 * Defers the first write and completes every later write immediately.
	 * @param input - Complete configuration candidate.
	 * @return Promise resolved when the write completes.
	 * @since 0.1.0 Initial implementation.
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
	 * @since 0.1.0 Initial implementation.
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
 * @since 0.1.0 Initial implementation.
 */
class RejectingFirstWriteStorage implements ProtectionConfigurationStorageService {
	configuration: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };

	writes = 0;

	/**
	 * Loads the latest successfully persisted configuration.
	 * @return Current persisted configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Rejects the first write and persists each later write.
	 * @param input - Complete configuration candidate.
	 * @return Promise resolved after a successful write.
	 * @since 0.1.0 Initial implementation.
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
 * Creates one deterministic valid independent scope.
 * @return Stable independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
function createValidIndependentScopeId(): string {
	return 'scope_independent_a';
}

/**
 * Creates one intentionally invalid independent scope fixture.
 * @return Invalid independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
function createInvalidIndependentScopeId(): string {
	return 'scope with spaces';
}

/**
 * Runs one mutation immediately when cross-context coordination is irrelevant to a test.
 * @param mutation - Deferred protected-site configuration mutation.
 * @return Exact mutation result.
 * @since 0.1.0 Initial implementation.
 */
function coordinateMutationDirectly(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return mutation();
}

/**
 * Resolves a test mutation queue after either mutation outcome.
 * @return Undefined queue settlement value.
 * @since 0.1.0 Initial implementation.
 */
function releaseTestMutationQueue(): undefined {
	return undefined;
}

/**
 * Creates one shared coordinator that serializes mutations across editor instances.
 * @return Cross-instance mutation coordinator.
 * @since 0.1.0 Initial implementation.
 */
function createSharedMutationCoordinator(): (
	mutation: ProtectionConfigurationMutation,
) => Promise<ProtectionConfigurationEditResult> {
	let mutationQueue: Promise<void> = Promise.resolve();

	/**
	 * Runs one mutation after all earlier coordinated mutations settle.
	 * @param mutation - Deferred protected-site configuration mutation.
	 * @return Exact mutation result.
	 * @since 0.1.0 Initial implementation.
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
 * @since 0.1.0 Initial implementation.
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
 * @since 0.1.0 Initial implementation.
 */
function updateMissingSite(
	editor: ReturnType<typeof createProtectionConfigurationEditor>,
) {
	return editor.update( 'missing.example', 'Name', true );
}

/**
 * Attempts to remove an invalid site identity through the supplied editor.
 * @param editor - Protected-site configuration editor under test.
 * @return Rejected removal result.
 * @since 0.1.0 Initial implementation.
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
 * @since 0.1.0 Initial implementation.
 */
function updateInvalidSite(
	editor: ReturnType<typeof createProtectionConfigurationEditor>,
) {
	return editor.update( 'not a host', 'Name', false );
}

/**
 * Creates an editor backed by deterministic in-memory dependencies.
 * @param configuration - Initial configuration or malformed-data marker.
 * @return Editor and observable in-memory storage.
 * @since 0.1.0 Initial implementation.
 */
function createEditor( configuration: ProtectionConfigurationDocument | null = CONFIGURATION_WITH_SITE ) {
	const storage = new MemoryProtectionConfigurationEditorStorage( configuration );
	const editor = createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId: createValidIndependentScopeId,
		coordinateMutation: coordinateMutationDirectly,
	} );

	return { editor, storage };
}

describe( 'createProtectionConfigurationEditor', () => {
	it( 'loads current configuration without altering it', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.load() ).resolves.toEqual( CONFIGURATION_WITH_SITE );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'adds a URL as one whole-domain site in the default shared scope', async () => {
		const { editor, storage } = createEditor( { ...TestEmptyProtectionConfiguration } );

		await expect( editor.add( 'https://www.instagram.com/reels', false ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: CONFIGURATION_WITH_SITE,
		} );
		expect( storage.writes ).toEqual( [ CONFIGURATION_WITH_SITE ] );
	} );

	it( 'runs an add pre-persist check after validation and before storage', async () => {
		const { editor, storage } = createEditor( { ...TestEmptyProtectionConfiguration } );
		const beforePersist = vi.fn().mockImplementation(
			( configuration: ProtectionConfigurationDocument ): Promise<void> => {
				expect( configuration ).toEqual( CONFIGURATION_WITH_SITE );
				expect( storage.writes ).toEqual( [] );

				return Promise.resolve();
			},
		);

		await expect(
			editor.add( 'https://www.instagram.com/reels', false, beforePersist ),
		).resolves.toMatchObject( { status: ProtectionConfigurationEditStatus.UPDATED } );
		expect( beforePersist ).toHaveBeenCalledOnce();
		expect( storage.writes ).toEqual( [ CONFIGURATION_WITH_SITE ] );
	} );

	it( 'adds an explicitly independent site to its own supplied scope', async () => {
		const { editor } = createEditor( { ...TestEmptyProtectionConfiguration } );

		await expect( editor.add( 'instagram.com', true ) ).resolves.toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				sites: [ {
					rule: { scopeId: 'scope_independent_a' },
				} ],
			},
		} );
	} );

	it( 'rejects a generated independent scope already owned by another exception', async () => {
		const existingIndependentSite: ProtectedSiteConfiguration = {
			...CONFIGURED_SITE,
			rule: {
				...CONFIGURED_SITE.rule,
				scopeId: ProtectionScopeIdSchema.parse( 'scope_independent_a' ),
			},
		};
		const { editor, storage } = createEditor( {
			...TestEmptyProtectionConfiguration,
			sites: [ existingIndependentSite ],
			schedulesByScope: {
				...TestEmptyProtectionConfiguration.schedulesByScope,
				scope_independent_a: DefaultProtectionSchedule,
			},
		} );

		await expect( editor.add( 'youtube.com', true ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'serializes concurrent mutations so later writes include earlier changes', async () => {
		const storage = new DeferredFirstWriteStorage();
		const editor = createProtectionConfigurationEditor( {
			storage,
			createIndependentScopeId: createValidIndependentScopeId,
			coordinateMutation: coordinateMutationDirectly,
		} );
		const firstEdit = editor.add( 'instagram.com', false );
		const secondEdit = editor.add( 'youtube.com', false );

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
		const editorOptions = {
			storage,
			createIndependentScopeId: createValidIndependentScopeId,
			coordinateMutation: createSharedMutationCoordinator(),
		};
		const firstEditor = createProtectionConfigurationEditor( editorOptions );
		const secondEditor = createProtectionConfigurationEditor( editorOptions );
		const firstEdit = firstEditor.add( 'instagram.com', false );
		const secondEdit = secondEditor.add( 'youtube.com', false );

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
		const editor = createProtectionConfigurationEditor( {
			storage,
			createIndependentScopeId: createValidIndependentScopeId,
			coordinateMutation: coordinateMutationDirectly,
		} );
		const firstEdit = editor.add( 'instagram.com', false );
		const secondEdit = editor.add( 'youtube.com', false );

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

		await expect( editor.add( 'https://business.instagram.com/', false ) ).resolves.toEqual( {
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

		await expect( editor.add( siteInput, false ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'rejects malformed stored configuration without replacing it', async () => {
		const { editor, storage } = createEditor( null );

		await expect( editor.add( 'example.com', false ) ).resolves.toEqual( {
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

	it( 'stores a trimmed editable display name and scope behavior in one write', async () => {
		const { editor, storage } = createEditor( {
			...TestEmptyProtectionConfiguration,
			sites: [ CONFIGURED_SITE, CONFIGURED_SECOND_SITE ],
		} );

		const result = await editor.update(
			'www.instagram.com',
			'  My Instagram  ',
			true,
		);

		expect( result ).toMatchObject( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				sites: [
					{
						displayNameOverride: 'My Instagram',
						rule: { scopeId: 'scope_independent_a' },
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

		await expect( editor.update( 'www.instagram.com', '   ', false ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: CONFIGURATION_WITH_SITE,
		} );
	} );

	it( 'rejects an overlong editable display name', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.update(
			'www.instagram.com',
			'a'.repeat( 81 ),
			false,
		) ).resolves.toEqual( {
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
			},
		} );
		expect( storage.writes ).toHaveLength( 1 );
		expect( CONFIGURATION_WITH_SITE.sites ).toHaveLength( 1 );
	} );

	it( 'moves one independent site back to the shared default scope', async () => {
		const { editor } = createEditor( {
			...CONFIGURATION_WITH_SITE,
			schedulesByScope: {
				...CONFIGURATION_WITH_SITE.schedulesByScope,
				scope_independent_a: DefaultProtectionSchedule,
			},
			sites: [ {
				...CONFIGURED_SITE,
				rule: {
					...CONFIGURED_SITE.rule,
					scopeId: ProtectionScopeIdSchema.parse( 'scope_independent_a' ),
				},
			} ],
		} );

		await expect( editor.update( 'www.instagram.com', '', false ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: CONFIGURATION_WITH_SITE,
		} );
	} );

	it( 'preserves an existing independent scope when independent behavior remains selected', async () => {
		const independentSite: ProtectedSiteConfiguration = {
			...CONFIGURED_SITE,
			rule: {
				...CONFIGURED_SITE.rule,
				scopeId: ProtectionScopeIdSchema.parse( 'scope_existing_independent' ),
			},
		};
		const { editor } = createEditor( {
			...TestEmptyProtectionConfiguration,
			sites: [ independentSite ],
			schedulesByScope: {
				...TestEmptyProtectionConfiguration.schedulesByScope,
				scope_existing_independent: DefaultProtectionSchedule,
			},
		} );

		await expect( editor.update( 'www.instagram.com', '', true ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				...TestEmptyProtectionConfiguration,
				schedulesByScope: {
					...TestEmptyProtectionConfiguration.schedulesByScope,
					scope_existing_independent: DefaultProtectionSchedule,
				},
				sites: [ independentSite ],
			},
		} );
	} );

	it( 'rejects an invalid generated independent scope identifier', async () => {
		const storage = new MemoryProtectionConfigurationEditorStorage( CONFIGURATION_WITH_SITE );
		const editor = createProtectionConfigurationEditor( {
			storage,
			createIndependentScopeId: createInvalidIndependentScopeId,
			coordinateMutation: coordinateMutationDirectly,
		} );

		await expect( editor.update( 'www.instagram.com', '', true ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID,
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
			ladderIncreaseMilliseconds: 10_000,
			maximumWaitMilliseconds: 45_000,
			allowanceMilliseconds: 12 * 60_000,
			completionAction: CompletionAction.OPEN_AUTOMATICALLY,
		};

		await expect( editor.updateTiming( timingConfiguration ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				...CONFIGURATION_WITH_SITE,
				timingConfiguration,
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

	it( 'normalizes and updates the schedule for one active scope', async () => {
		const { editor, storage } = createEditor();

		await expect( editor.updateSchedule( DefaultProtectionScopeId, {
			mode: ScheduleMode.CUSTOM,
			windows: [
				{ weekday: Weekday.MONDAY, startMinute: 540, endMinute: 720 },
				{ weekday: Weekday.MONDAY, startMinute: 720, endMinute: 1_020 },
			],
		} ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration: {
				...CONFIGURATION_WITH_SITE,
				schedulesByScope: {
					[ DefaultProtectionScopeId ]: {
						mode: ScheduleMode.CUSTOM,
						windows: [ {
							weekday: Weekday.MONDAY,
							startMinute: 540,
							endMinute: 1_020,
						} ],
					},
				},
			},
		} );
		expect( storage.writes ).toHaveLength( 1 );
	} );

	it.each( [
		{
			label: 'invalid schedule',
			scopeId: DefaultProtectionScopeId,
			schedule: {
				mode: ScheduleMode.CUSTOM,
				windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 540 } ],
			},
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE,
		},
		{
			label: 'unknown scope',
			scopeId: 'scope_missing',
			schedule: { mode: ScheduleMode.ALWAYS },
			reason: ProtectionConfigurationEditRejectionReason.SCOPE_NOT_FOUND,
		},
		{
			label: 'invalid scope identifier',
			scopeId: 'scope with spaces',
			schedule: { mode: ScheduleMode.ALWAYS },
			reason: ProtectionConfigurationEditRejectionReason.SCOPE_NOT_FOUND,
		},
	] )( 'rejects an $label without writing', async ( { scopeId, schedule, reason } ) => {
		const { editor, storage } = createEditor();

		await expect( editor.updateSchedule( scopeId, schedule ) ).resolves.toEqual( {
			status: ProtectionConfigurationEditStatus.REJECTED,
			reason,
		} );
		expect( storage.writes ).toEqual( [] );
	} );

	it( 'rejects schedule and timing edits when the stored configuration is malformed', async () => {
		const { editor, storage } = createEditor( null );

		await expect( editor.updateSchedule(
			DefaultProtectionScopeId,
			{ mode: ScheduleMode.ALWAYS },
		) ).resolves.toEqual( {
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
