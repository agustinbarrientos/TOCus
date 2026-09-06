import {
	LocalDataGenerationSchema,
	LocalDataGenerationStorageKey,
	type LocalDataGeneration,
	type LocalDataGenerationArea,
	type LocalDataMutationGuard,
} from './types';

/**
 * Identifies persistence rejected because an editor predates a full data reset.
 * @since 0.1.0 Initial implementation.
 */
export class LocalDataResetError extends Error {
	/**
	 * Creates the reset-specific failure used by coordinated permission compensation.
	 * @since 0.1.0 Initial implementation.
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
 * @since 0.1.0 Initial implementation.
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
 * @since 0.1.0 Initial implementation.
 */
export function createLocalDataMutationGuard( area: LocalDataGenerationArea ): LocalDataMutationGuard {
	const initial = readLocalDataGeneration( area ).catch( () => undefined );

	/**
	 * Rejects a stale editor or any mutation during incomplete reset cleanup.
	 * @return Promise resolved only while persistence remains safe.
	 * @since 0.1.0 Initial implementation.
	 */
	async function assertCurrent(): Promise<void> {
		const captured = await initial;
		const current = await readLocalDataGeneration( area );
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
