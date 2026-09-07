import { StatisticsLoadState } from '../../services/settings-screen-state/types';
import type { StatisticsFailureFeedback, StatisticsRecoveryCopy } from './types';

/**
 * Selects recovery copy without presenting loading or valid totals as failures.
 * @param state - Authoritative read or reset state from the statistics controller.
 * @param copy - Localized explanations for the two recoverable failure operations.
 * @return Operation-specific failure feedback, or null while no failure is present.
 * @since 0.1.0
 */
export function resolveStatisticsFeedback(
	state: StatisticsLoadState, copy: StatisticsRecoveryCopy,
): StatisticsFailureFeedback | null {
	if ( state === StatisticsLoadState.RESET_FAILED ) {
		return { title: copy.resetErrorTitle, description: copy.resetErrorDescription };
	}
	if ( state === StatisticsLoadState.FAILED ) {
		return { title: copy.unavailableTitle, description: copy.unavailableDescription };
	}
	return null;
}
