import { z } from 'zod';

/**
 * Observable causes for a participant leaving protected state.
 * @since 1.0.0 Initial implementation.
 */
export const DepartureCause = {
	ACTIVE_SESSION_TAB_CLOSE: 'active-session-tab-close',
	ACTIVE_SESSION_WINDOW_CLOSE: 'active-session-window-close',
	BACK: 'back',
	NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY: 'non-extension-top-level-navigation-away',
	REDIRECT: 'redirect',
	AUTHENTICATION_HANDOFF: 'authentication-handoff',
	PROGRAMMATIC_NAVIGATION: 'programmatic-navigation',
	BROWSER_ERROR_OR_RECOVERY: 'browser-error-or-recovery',
	SCHEDULE_DEACTIVATION: 'schedule-deactivation',
	PERMISSION_LOSS: 'permission-loss',
	BROWSER_TERMINATION: 'browser-termination',
	EXTENSION_TERMINATION: 'extension-termination',
	CONFIGURATION_CHANGE: 'configuration-change',
	STORAGE_FAILURE: 'storage-failure',
	UNKNOWN: 'unknown',
} as const;

/**
 * Validates an observable participant-departure cause.
 * @since 1.0.0 Initial implementation.
 */
export const DepartureCauseSchema = z.enum( DepartureCause );

/**
 * Observable cause for a participant leaving protected state.
 * @since 1.0.0 Initial implementation.
 */
export type DepartureCause = z.infer<typeof DepartureCauseSchema>;

/**
 * Departure causes that represent one reconsidered navigation visit.
 * @since 1.0.0 Initial implementation.
 */
export const QualifyingDepartureCause = {
	ACTIVE_SESSION_TAB_CLOSE: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
	ACTIVE_SESSION_WINDOW_CLOSE: DepartureCause.ACTIVE_SESSION_WINDOW_CLOSE,
	BACK: DepartureCause.BACK,
	NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY: DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
} as const;

/**
 * Validates a departure cause that represents one reconsidered navigation visit.
 * @since 1.0.0 Initial implementation.
 */
export const QualifyingDepartureCauseSchema = z.enum( QualifyingDepartureCause );

/**
 * Departure cause that represents one reconsidered navigation visit.
 * @since 1.0.0 Initial implementation.
 */
export type QualifyingDepartureCause = z.infer<typeof QualifyingDepartureCauseSchema>;
