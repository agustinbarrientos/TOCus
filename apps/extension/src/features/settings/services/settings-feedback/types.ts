import type { ReactNode } from 'react';
import type { SettingsShellCopy } from '../../components/shell/types';

/**
 * Confirmed settings actions with shared localized notification messages.
 * @since 1.0.0
 */
export const SettingsFeedbackAction = {
	SAVED: 'saved',
	DISCARDED: 'discarded',
	SITE_ADDED: 'site-added',
	SITE_UPDATED: 'site-updated',
	SITE_REMOVED: 'site-removed',
	SITES_REMOVED: 'sites-removed',
	DUPLICATE_SITE: 'duplicate-site',
} as const;

/**
 * One settings outcome ready to be announced.
 * @since 1.0.0
 */
export type SettingsFeedbackAction = typeof SettingsFeedbackAction[ keyof typeof SettingsFeedbackAction ];

/**
 * Stable notification boundary shared by destination controllers.
 * @since 1.0.0
 */
export interface SettingsFeedback {
	/** Announces one confirmed action using the current settings language. */
	notify: ( action: SettingsFeedbackAction ) => void;
}

/**
 * Localized shell copy and destinations sharing one notification lifetime.
 * @since 1.0.0
 */
export interface SettingsFeedbackProviderProps {
	copy: Readonly<SettingsShellCopy>;
	children: ReactNode;
}
