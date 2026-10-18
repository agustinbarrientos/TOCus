import {
	LocalDataGenerationSchema,
	LocalDataGenerationStorageKey,
	type LocalDataGeneration,
	type LocalDataGenerationArea,
	type LocalDataMutationGuard,
} from './types';
import { BackupImportJournalKey } from '../../types/backup-storage-key';

/**
 * Identifies persistence rejected because an editor predates a full data reset.
 * @since 1.0.0 Initial implementation.
 */
export class LocalDataResetError extends Error {
	/**
	 * Creates the reset-specific failure used by coordinated permission compensation.
	 * @since 1.0.0 Initial implementation.
	 */
	constructor() {
		super( 'Local data was reset. Reopen this page before saving.' );
		this.name = 'LocalDataResetError';
	}
}

/**
 * Reads reset coordination metadata without creating or repairing a document.
 * @param area - Extension-local storage boundary.
 * @return Current metadata, or null before the first reset.
 * @since 1.0.0 Initial implementation.
 */
export async function readLocalDataGeneration(
	area: LocalDataGenerationArea,
): Promise<LocalDataGeneration | null> {
	const values = await area.get( LocalDataGenerationStorageKey );
	const value = values[ LocalDataGenerationStorageKey ];
	return value === undefined ? null : LocalDataGenerationSchema.parse( value );
}

/**
 * Captures an editor's data generation before user interaction can start a permission prompt.
 * @param area - Extension-local storage boundary.
 * @return Guard to run immediately before persistence while the editor's mutation lock is held.
 * @since 1.0.0 Initial implementation.
 */
export function createLocalDataMutationGuard( area: LocalDataGenerationArea ): LocalDataMutationGuard {
	/**
	 * Captures a generation only while no replacement journal can expose mixed documents.
	 * @return Current metadata or a rejection for an incomplete import.
	 * @since 1.1.0
	 */
	async function readEditableGeneration(): Promise<LocalDataGeneration | null> {
		const generation = await readLocalDataGeneration( area );
		if ( ( await area.get( BackupImportJournalKey ) )[ BackupImportJournalKey ] !== undefined ) {
			throw new LocalDataResetError();
		}
		return generation;
	}
	const initial = readEditableGeneration().catch( () => undefined );

	/**
	 * Rejects a stale editor or any mutation during incomplete reset cleanup.
	 * @return Promise resolved only while persistence remains safe.
	 * @since 1.0.0 Initial implementation.
	 */
	async function assertCurrent(): Promise<void> {
		const captured = await initial;
		const current = await readEditableGeneration();
		if (
			captured === undefined || captured?.pending || current?.pending ||
			captured?.generation !== current?.generation
		) {
			throw new LocalDataResetError();
		}
	}

	return assertCurrent;
}

export * from './types';
