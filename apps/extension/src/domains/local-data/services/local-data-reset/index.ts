import { PreferencesStorageKey } from '../../../preferences/services/preferences-storage';
import { ProtectionConfigurationStorageKey } from '../../../protection/services/protection-configuration-storage';
import { ProtectionStorageKey } from '../../../protection/services/protection-storage';
import { StatisticsSessionStorageKey } from '../../../statistics/services/statistics-session-storage';
import { StatisticsStorageKey } from '../../../statistics/services/statistics-storage';
import {
	LocalDataGenerationSchema,
	LocalDataGenerationStorageKey,
	readLocalDataGeneration,
	type LocalDataGeneration,
} from '../local-data-generation';
import { type LocalDataReset, type LocalDataResetOptions } from './types';

/**
 * Coordinates explicit full deletion with settings writers and recoverable browser cleanup.
 * @param options - Persistence, shared locks, and background lifecycle boundaries.
 * @return Reset and interrupted-reset recovery operations.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalDataReset( options: LocalDataResetOptions ): LocalDataReset {
	/**
	 * Completes destructive cleanup while both settings mutation locks are held.
	 * @param marker - Durable identity of the reset being completed.
	 * @return Promise resolved after every owned record is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function complete( marker: LocalDataGeneration ): Promise<void> {
		await options.suspend();
		if ( ! await options.revokeAccess() ) {
			throw new Error( 'Website access could not be revoked.' );
		}
		await options.sessionArea.remove( [
			ProtectionStorageKey.SESSION,
			StatisticsSessionStorageKey.SESSION,
			StatisticsSessionStorageKey.FOCUS_EPOCH,
		] );
		await options.localArea.remove( [
			ProtectionConfigurationStorageKey.CONFIGURATION,
			PreferencesStorageKey.PREFERENCES,
			ProtectionStorageKey.DURABLE,
			StatisticsStorageKey.STATISTICS,
		] );
		await options.localArea.set( {
			[ LocalDataGenerationStorageKey ]: { ...marker, pending: false, needsOnboarding: true },
		} );
	}

	/**
	 * Starts or recovers a reset under the existing configuration and preferences locks.
	 * @param requested - Whether the user explicitly requested a new reset.
	 * @return Whether normal startup can safely proceed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function run( requested: boolean ): Promise<boolean> {
		try {
			return await options.locks.request( ProtectionConfigurationStorageKey.CONFIGURATION, () =>
				options.locks.request( PreferencesStorageKey.PREFERENCES, async () => {
					const current = await readLocalDataGeneration( options.localArea );
					if ( ! requested && ! current?.pending ) {
						return true;
					}
					const marker = current?.pending ? current : LocalDataGenerationSchema.parse( {
						generation: options.createGeneration(),
						pending: true,
					} );
					await options.localArea.set( { [ LocalDataGenerationStorageKey ]: marker } );
					await complete( marker );
					return true;
				} ),
			);
		} catch {
			return false;
		}
	}

	return {
		/**
		 * Starts a user-confirmed full reset.
		 * @return Whether cleanup completed successfully.
		 * @since 0.1.0 Initial implementation.
		 */
		reset: () => run( true ),
		/**
		 * Completes pending cleanup before ordinary startup.
		 * @return Whether startup may proceed.
		 * @since 0.1.0 Initial implementation.
		 */
		recover: () => run( false ),
	};
}

export * from './types';
