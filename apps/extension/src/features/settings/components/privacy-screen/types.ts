/**
 * Destructive local data operations available from Settings.
 * @since 0.1.0 Initial implementation.
 */
export interface PrivacyDataActions {
	/**
	 * Resets statistics while preserving website rules and preferences.
	 * @return Whether the complete reset succeeded.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics(): Promise<boolean>;
	/**
	 * Resets all local data, removes website access, and opens onboarding.
	 * @return Whether every reset step succeeded.
	 * @since 0.1.0 Initial implementation.
	 */
	resetAllData(): Promise<boolean>;
}

/**
 * Available explicit reset choices.
 * @since 0.1.0 Initial implementation.
 */
export const PrivacyResetAction = {
	STATISTICS: 'statistics',
	ALL: 'all',
} as const;

/**
 * Reset operation selected for inline confirmation.
 * @since 0.1.0 Initial implementation.
 */
export type PrivacyResetAction = typeof PrivacyResetAction[keyof typeof PrivacyResetAction];

/**
 * Localized explanations, confirmation text, and operation announcements.
 * @since 0.1.0 Initial implementation.
 */
export interface PrivacyScreenCopy {
	title: string;
	introduction: string;
	storedTitle: string;
	storedDescription: string;
	statisticsPrivacy: string;
	recoveryPrivacy: string;
	permissionsTitle: string;
	websitePermission: string;
	toolbarPermission: string;
	navigationPermission: string;
	localToolsPermission: string;
	faviconPermission: string;
	deniedPermission: string;
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
