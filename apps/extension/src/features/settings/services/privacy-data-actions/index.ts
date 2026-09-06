import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import { createStatisticsClient } from '../../../statistics/services/statistics-client';
import { type PrivacyDataActions } from '../../components/privacy-screen/types';
import { type PrivacyDataActionsOptions } from './types';

/**
 * Keeps confirmed privacy actions in the background independently of the settings page lifetime.
 * @param options - Local background messaging boundary.
 * @return Separate statistics-only and full-reset actions.
 * @since 0.1.0 Initial implementation.
 */
export function createPrivacyDataActions( options: PrivacyDataActionsOptions ): PrivacyDataActions {
	const statistics = createStatisticsClient( options );
	return {
		/**
		 * Resets historical totals without changing website rules or preferences.
		 * @return Whether the statistics authority reports success.
		 * @since 0.1.0 Initial implementation.
		 */
		async resetStatistics(): Promise<boolean> {
			return ( await statistics.resetStatistics() ).status === StatisticsProjectionStatus.AVAILABLE;
		},
		/**
		 * Requests full deletion after the view obtains explicit confirmation.
		 * @return Whether cleanup and reopening onboarding succeeded.
		 * @since 0.1.0 Initial implementation.
		 */
		async resetAllData(): Promise<boolean> {
			try {
				return await options.runtime.sendMessage( { type: 'reset-all-data' } ) === true;
			} catch {
				return false;
			}
		},
	};
}

export * from './types';
