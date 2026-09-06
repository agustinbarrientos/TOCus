import { z } from 'zod';

/**
 * Local reset coordination record, retained without personal data after deletion.
 * @since 0.1.0 Initial implementation.
 */
export const LocalDataGenerationStorageKey = 'tocus.local-data.generation.v1';

/**
 * Durable reset identity and incomplete-cleanup marker.
 * @since 0.1.0 Initial implementation.
 */
export const LocalDataGenerationSchema = z.strictObject( {
	generation: z.string().min( 1 ),
	pending: z.boolean(),
	needsOnboarding: z.boolean().default( false ),
} );

/**
 * Validated durable reset coordination record.
 * @since 0.1.0 Initial implementation.
 */
export type LocalDataGeneration = z.infer<typeof LocalDataGenerationSchema>;

/**
 * Local storage read boundary shared by configuration and preferences editors.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataGenerationArea {
	/**
	 * Reads one extension-owned storage record.
	 * @param key - Storage key to read.
	 * @return Values returned by the browser.
	 * @since 0.1.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>>;
}

/**
 * Checks that an editor still belongs to the current data generation.
 * @since 0.1.0 Initial implementation.
 */
export type LocalDataMutationGuard = () => Promise<void>;
