import type { RegisterDraft } from '../../utils/draft-controller/types';

/**
 * Stable destinations available in extension settings.
 * @since 0.1.0 Initial implementation.
 */
export const SettingsDestination = {
	ABOUT: 'about',
	APPEARANCE: 'appearance',
	LANGUAGE: 'language',
	PRIVACY: 'privacy',
	PROTECTED_SITES: 'protected-sites',
	SCHEDULE: 'schedule',
	STATISTICS: 'statistics',
	TIMING: 'timing',
} as const;

/**
 * Active destination rendered by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export type SettingsDestination = typeof SettingsDestination[ keyof typeof SettingsDestination ];

/**
 * Browser history state key owned by the Settings draft-navigation guard.
 * @since 0.1.0
 */
export const SettingsHistoryPositionKey = 'tocusSettingsHistoryPosition';

/**
 * Internal movement used to restore a guarded entry or commit a confirmed navigation.
 * @since 0.1.0
 */
export const SettingsHistoryTransition = {
	RESTORE: 'restore',
	COMMIT: 'commit',
} as const;

/**
 * Guard-owned history movement, or null while no movement is pending.
 * @since 0.1.0
 */
export type SettingsHistoryTransition =
	typeof SettingsHistoryTransition[ keyof typeof SettingsHistoryTransition ] | null;

/**
 * Deferred navigation held while the current destination contains unsaved edits.
 * @since 0.1.0
 */
export interface PendingSettingsNavigation {
	/** Browser hash originally requested by the user. */
	hash: string;
	/** Relative history movement, or null for a new navigation-link entry. */
	delta: number | null;
	/** Previously focused control restored when the user chooses to stay. */
	focus: HTMLElement | null;
}

/**
 * Current destination state and the guarded navigation operations exposed to the shell.
 * @since 0.1.0
 */
export interface SettingsNavigationState {
	/** Destination whose content is currently mounted. */
	destination: SettingsDestination;
	/** Requested navigation awaiting a discard/stay decision. */
	pending: PendingSettingsNavigation | null;
	/** Registers the currently mounted destination's editable draft. */
	register: RegisterDraft;
	/** Requests a new navigation-link entry while preserving an active draft. */
	navigate: ( hash: string, focus: HTMLElement ) => void;
	/** Discards the current draft before completing its deferred navigation. */
	discard: () => Promise<void>;
	/** Cancels deferred navigation and restores the triggering control's focus. */
	stay: () => void;
}
