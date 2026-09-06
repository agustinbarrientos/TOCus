import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../protection-configuration-editor';
import {
	ProtectionConfigurationStorageKey,
	createProtectionConfigurationStorageService,
} from '../protection-configuration-storage';
import {
	type BrowserProtectionConfigurationEditor,
	type BrowserProtectionConfigurationEditorOptions,
} from './types';
import { createLocalDataMutationGuard } from '../../../local-data/services/local-data-generation';

/**
 * Creates browser-backed protection editing with shared cross-context coordination.
 * @param options - Browser storage, lock, and identifier dependencies.
 * @return Coordinated protection editor and persistence boundary.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserProtectionConfigurationEditor(
	options: BrowserProtectionConfigurationEditorOptions,
): BrowserProtectionConfigurationEditor {
	const storage = createProtectionConfigurationStorageService( { area: options.area } );
	const assertCurrentGeneration = createLocalDataMutationGuard( options.area );

	/**
	 * Persists a configuration only while its editor belongs to the current installation data.
	 * @param input - Candidate configuration validated by the storage service.
	 * @return Promise resolved after guarded persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	async function save( input: unknown ): Promise<void> {
		await assertCurrentGeneration();
		await storage.save( input );
	}

	/**
	 * Creates one independent protection scope identifier.
	 * @return Prefixed browser-generated scope identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function createIndependentScopeId(): string {
		return `scope_${ options.cryptography.randomUUID() }`;
	}

	/**
	 * Creates one protection measurement revision.
	 * @return Prefixed browser-generated measurement revision.
	 * @since 0.1.0 Initial implementation.
	 */
	function createMeasurementRevision(): string {
		return `revision_${ options.cryptography.randomUUID() }`;
	}

	/**
	 * Runs one protection mutation under its stable cross-context lock.
	 * @param mutation - Deferred protection configuration mutation.
	 * @return Exact edit result after lock release.
	 * @since 0.1.0 Initial implementation.
	 */
	function coordinateMutation(
		mutation: ProtectionConfigurationMutation,
	): Promise<ProtectionConfigurationEditResult> {
		return options.locks.request( ProtectionConfigurationStorageKey.CONFIGURATION, mutation );
	}

	const editor = createProtectionConfigurationEditor( {
		storage: {
			/**
			 * Reads the current persisted document without changing reset identity.
			 * @return Current settings or a malformed-data marker.
			 * @since 0.1.0 Initial implementation.
			 */
			load: () => storage.load(),
			save,
		},
		createIndependentScopeId,
		createMeasurementRevision,
		coordinateMutation,
		validateAddition: assertCurrentGeneration,
	} );

	return { editor, storage };
}

export * from './types';
