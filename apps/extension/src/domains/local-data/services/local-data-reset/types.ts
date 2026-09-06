import { type LocalDataGenerationArea } from '../local-data-generation';

/**
 * Extension-owned persistence operations used by explicit full reset.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataResetArea extends LocalDataGenerationArea {
	/**
	 * Writes reset coordination metadata.
	 * @param values - Records to persist.
	 * @return Browser write completion.
	 * @since 0.1.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void>;
	/**
	 * Removes only the specified extension-owned records.
	 * @param keys - Exact keys to remove.
	 * @return Browser removal completion.
	 * @since 0.1.0 Initial implementation.
	 */
	remove( keys: string[] ): Promise<void>;
}

/**
 * Shared cross-context mutation locks used by settings editors.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataResetLocks {
	/**
	 * Runs reset work with exclusive ownership of one named lock.
	 * @template Result Operation result.
	 * @param name - Existing settings mutation lock name.
	 * @param operation - Work performed while the lock is held.
	 * @return Operation result after lock release.
	 * @since 0.1.0 Initial implementation.
	 */
	request<Result>( name: string, operation: () => Promise<Result> ): Promise<Result>;
}

/**
 * Persistence and browser lifecycle dependencies for recoverable full reset.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataResetOptions {
	/** Local configuration, preferences, statistics, and reset metadata. */
	localArea: LocalDataResetArea;
	/** Session recovery and focus measurement records. */
	sessionArea: Pick<LocalDataResetArea, 'remove'>;
	/** Existing configuration and preferences mutation locks. */
	locks: LocalDataResetLocks;
	/**
	 * Creates a fresh non-personal reset generation identifier.
	 * @return Unique reset identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	createGeneration(): string;
	/**
	 * Stops new observations, drains pending writes, and releases all active pauses.
	 * @return Completion of runtime cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	suspend(): Promise<void>;
	/**
	 * Revokes all granted website origins and optional navigation access.
	 * @return Whether access was fully revoked.
	 * @since 0.1.0 Initial implementation.
	 */
	revokeAccess(): Promise<boolean>;
}

/**
 * Full-reset operations independent from statistics-only reset.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalDataReset {
	/**
	 * Deletes all user data after the caller obtains explicit confirmation.
	 * @return Whether deletion and permission revocation completed.
	 * @since 0.1.0 Initial implementation.
	 */
	reset(): Promise<boolean>;
	/**
	 * Finishes an interrupted reset before normal background startup.
	 * @return Whether startup can safely proceed.
	 * @since 0.1.0 Initial implementation.
	 */
	recover(): Promise<boolean>;
}
