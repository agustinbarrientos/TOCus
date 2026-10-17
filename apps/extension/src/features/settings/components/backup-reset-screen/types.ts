import type { BackupControlsCopy } from '../backup-controls/types';
import type { ReactNode } from 'react';

/**
 * Destructive local data operations available from Settings.
 * @since 1.0.0 Initial implementation.
 */
export interface LocalDataActions {
	/**
	 * Resets statistics while preserving website rules and preferences.
	 * @return Whether the complete reset succeeded.
	 * @since 1.0.0 Initial implementation.
	 */
	resetStatistics(): Promise<boolean>;
	/**
	 * Resets all local data, removes website access, and opens onboarding.
	 * @return Whether every reset step succeeded.
	 * @since 1.0.0 Initial implementation.
	 */
	resetAllData(): Promise<boolean>;
}

/**
 * Available explicit reset choices.
 * @since 1.0.0 Initial implementation.
 */
export const DataResetAction = {
	STATISTICS: 'statistics',
	ALL: 'all',
} as const;

/**
 * Reset operation selected for inline confirmation.
 * @since 1.0.0 Initial implementation.
 */
export type DataResetAction = typeof DataResetAction[keyof typeof DataResetAction];

/**
 * Localized explanations, confirmation text and announcements for data operations.
 * @since 1.1.0
 */
export interface BackupResetScreenCopy extends BackupControlsCopy {
	title: string;
	statisticsTitle: string;
	statisticsDescription: string;
	statisticsConfirmationTitle: string;
	statisticsConfirmation: string;
	resetStatistics: string;
	allTitle: string;
	allDescription: string;
	allConfirmationTitle: string;
	allConfirmation: string;
	resetAll: string;
	cancel: string;
	resetting: string;
	retry: string;
	resetError: string;
	statisticsSuccess: string;
	allSuccess: string;
	unavailable: string;
}

/**
 * Localized description and trigger for one destructive data operation.
 * @since 1.0.0
 */
export interface ResetSectionProps {
	title: string;
	description: string;
	label: string;
	disabled: boolean;
	onRequest: () => void;
	children?: ReactNode;
}
