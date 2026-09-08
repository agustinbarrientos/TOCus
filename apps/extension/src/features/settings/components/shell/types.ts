import type { SettingsDestination } from '../../services/settings-navigation/types';
export {
	SettingsDestination,
	SettingsHistoryPositionKey,
	type SettingsHistoryTransition,
	type PendingSettingsNavigation,
	type SettingsNavigationState,
} from '../../services/settings-navigation/types';
import type { IconName } from '@tocus/ui';
import type { SettingsPageShell } from '../../services/settings-page/types';
import type { RegisterDraft } from '../../utils/draft-controller/types';
import type { AccessRefresh } from '../../../protected-sites/components/screen/types';

/**
 * Stable browser families supported by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export const SettingsPlatform = {
	CHROME: 'chrome',
	FIREFOX: 'firefox',
	SAFARI: 'safari',
} as const;

/**
 * Browser family whose native visual conventions the settings shell follows.
 * @since 0.1.0 Initial implementation.
 */
export type SettingsPlatform = typeof SettingsPlatform[ keyof typeof SettingsPlatform ];

/**
 * Localizable messages rendered by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsShellCopy {
	navigationLabel: string;
	about: string;
	appearance: string;
	language: string;
	privacy: string;
	protectedSites: string;
	schedule: string;
	statistics: string;
	timing: string;
	unsavedChangesTitle: string;
	unsavedChangesDescription: string;
	stay: string;
	discard: string;
}

/**
 * Mutable bridge to the currently mounted Protected Sites access refresh operation.
 * @since 0.1.0
 */
export interface SettingsAccessReference {
	/** Current destination-owned refresh operation, returning null when unavailable. */
	current: AccessRefresh;
}

/**
 * Services and access bridge required by the Settings application shell.
 * @since 0.1.0
 */
export interface SettingsShellProperties {
	/** Fully localized page-controller service contract. */
	shell: SettingsPageShell;
	/** Mutable operation updated by the mounted Protected Sites destination. */
	accessRef: SettingsAccessReference;
}

/**
 * One localized Settings navigation destination and its shared icon.
 * @since 0.1.0
 */
export interface SettingsNavigationItem {
	/** Canonical destination also used as the URL fragment. */
	id: SettingsDestination;
	/** Active-language navigation label. */
	name: string;
	/** Packaged section icon. */
	icon: IconName;
}

/**
 * Properties needed to mount exactly one destination with its shared guard registration.
 * @since 0.1.0
 */
export interface SettingsDestinationProperties extends SettingsShellProperties {
	/** Canonical destination selected by the guarded navigation state. */
	destination: SettingsDestination;
	/** Callback receiving the mounted destination's dirty/saving state. */
	register: RegisterDraft;
}
