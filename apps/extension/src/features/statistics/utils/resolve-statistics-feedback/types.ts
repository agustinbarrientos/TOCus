import type { StatisticsSettingsScreenCopy } from '../../components/settings-screen/types';

/**
 * Localized read and reset failures needed by the statistics recovery decision.
 * @since 0.1.0
 */
export type StatisticsRecoveryCopy = Pick<StatisticsSettingsScreenCopy,
	'unavailableTitle' | 'unavailableDescription' | 'resetErrorTitle' | 'resetErrorDescription'>;

/**
 * Failure explanation displayed with the Statistics retry action.
 * @since 0.1.0
 */
export interface StatisticsFailureFeedback {
	title: string;
	description: string;
}
