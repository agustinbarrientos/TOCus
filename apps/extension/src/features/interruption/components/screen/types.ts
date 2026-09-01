import type { FocusedProgressClockTiming } from '../../services/focused-progress-clock/types';

/**
 * Presentation states supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionScreenState = {
	READY: 'ready',
	READY_EXPIRED: 'ready-expired',
	WAITING: 'waiting',
} as const;

/**
 * Presentation state supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export type InterruptionScreenState = typeof InterruptionScreenState[keyof typeof InterruptionScreenState];

/**
 * Pause modes supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionScreenMode = {
	BREATHING: 'breathing',
	QUIET: 'quiet',
} as const;

/**
 * Pause mode supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export type InterruptionScreenMode = typeof InterruptionScreenMode[keyof typeof InterruptionScreenMode];

/**
 * Polite announcement states retained across localized-copy changes.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionScreenAnnouncementKind = {
	PAUSED: 'paused',
	READY: 'ready',
	READY_EXPIRED: 'ready-expired',
	RESUMED: 'resumed',
	WAITING_STARTED: 'waiting-started',
} as const;

/**
 * Polite announcement state retained by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export type InterruptionScreenAnnouncementKind = typeof InterruptionScreenAnnouncementKind[
	keyof typeof InterruptionScreenAnnouncementKind
];

/**
 * Complete localized messages consumed by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionScreenCopy {
	breatheIn: string;
	breatheOut: string;
	continueLabel: string;
	continueShortcut: string;
	formatRemainingTime: ( remainingSeconds: number ) => string;
	pausedAnnouncement: string;
	readyAnnouncement: string;
	readyExpiredMessage: string;
	resumedAnnouncement: string;
	spaceKeyLabel: string;
	sphereAlternative: string;
	stillSphereAlternative: string;
	takeAMoment: string;
	waitingStartedAnnouncement: string;
}

/**
 * Browser timing and attention dependencies used by one interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionScreenEnvironment extends FocusedProgressClockTiming {
	/**
	 * Reports whether the document can currently advance focused progress.
	 * @return Whether the document is visible.
	 * @since 0.1.0 Initial implementation.
	 */
	isDocumentVisible(): boolean;

	/**
	 * Reports whether the browser window can currently advance focused progress.
	 * @return Whether the browser window is focused.
	 * @since 0.1.0 Initial implementation.
	 */
	isWindowFocused(): boolean;
}

/**
 * Formats the default English remaining-time label.
 * @param remainingSeconds - Whole remaining seconds.
 * @return Complete remaining-time label.
 */
function formatDefaultRemainingTime( remainingSeconds: number ): string {
	return `${ String( remainingSeconds ) }s remaining`;
}

/**
 * Safe English fallback messages for an unlocalized screen fixture.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultInterruptionScreenCopy: Readonly<InterruptionScreenCopy> = {
	breatheIn: 'Breathe in',
	breatheOut: 'Breathe out',
	continueLabel: 'Continue',
	continueShortcut: 'Or press {key}',
	formatRemainingTime: formatDefaultRemainingTime,
	pausedAnnouncement: 'Your breathing pause is paused.',
	readyAnnouncement: 'You can continue when you are ready.',
	readyExpiredMessage: 'This visit window has ended. Start another breathing pause when you are ready.',
	resumedAnnouncement: 'Your breathing pause has resumed.',
	spaceKeyLabel: 'Space',
	sphereAlternative: 'A soft clay sphere expands as you breathe in and settles as you breathe out.',
	stillSphereAlternative: 'A soft clay sphere rests at the center of the screen.',
	takeAMoment: 'Take a moment',
	waitingStartedAnnouncement: 'Your breathing pause has started.',
};

/**
 * Name of the plain Continue-request event emitted by the screen.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionContinueRequestEventName = 'tocus-continue-request';
