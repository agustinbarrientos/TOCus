import type { FocusedProgressClockTiming } from '../../services/focused-progress-clock/types';
import type { ComponentInterruptionScreen } from '.';
import type { CSSProperties } from 'react';

/**
 * Continuous artwork values applied only to the owned scene.
 * @since 0.1.0
 */
export interface SceneStyle extends CSSProperties {
	'--tocus-breath-bloom-opacity': string;
	'--tocus-breath-bloom-scale': string;
	'--tocus-breath-progress': string;
}

/**
 * Immutable React presentation supplied by the controller-facing adapter.
 * @since 0.1.0
 */
export interface ScreenViewProps {
	host: HTMLElement;
	shadowRoot: ShadowRoot;
	copy: Readonly<InterruptionScreenCopy>;
	state: InterruptionScreenState;
	mode: InterruptionScreenMode;
	progressMilliseconds: number;
	waitDurationMilliseconds: number;
	reducedMotion: boolean;
	recovering: boolean;
	wellbeingSummary: string;
	announcement: string;
	onContinue: () => void;
	onRetry: () => void;
}

declare global {
	/** Controller-facing native pause tag retained during the presentation migration. */
	interface HTMLElementTagNameMap {
		'tocus-f-interruption-screen': ComponentInterruptionScreen;
	}
}
import {
	PauseMode,
	type PauseMode as PauseModeValue,
} from '../../../../domains/preferences/types';

/**
 * Presentation states supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionScreenState = {
	READY: 'ready',
	READY_EXPIRED: 'ready-expired',
	UNAVAILABLE: 'unavailable',
	WAITING: 'waiting',
} as const;

/**
 * Presentation state supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export type InterruptionScreenState = typeof InterruptionScreenState[ keyof typeof InterruptionScreenState ];

/**
 * Pause modes supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionScreenMode = PauseMode;

/**
 * Pause mode supported by the interruption screen.
 * @since 0.1.0 Initial implementation.
 */
export type InterruptionScreenMode = PauseModeValue;

/**
 * Polite announcement states retained across localized-copy changes.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionScreenAnnouncementKind = {
	PAUSED: 'paused',
	READY: 'ready',
	READY_EXPIRED: 'ready-expired',
	RECOVERY_FAILED: 'recovery-failed',
	RECOVERY_STARTED: 'recovery-started',
	RESUMED: 'resumed',
	UNAVAILABLE: 'unavailable',
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
	/**
	 * Formats the remaining wait for visible presentation.
	 * @param remainingSeconds - Nonnegative whole seconds remaining.
	 * @return Localized remaining-time label.
	 * @since 0.1.0 Initial implementation.
	 */
	formatRemainingTime: ( remainingSeconds: number ) => string;
	pausedAnnouncement: string;
	readyAnnouncement: string;
	readyExpiredMessage: string;
	recoveryFailedAnnouncement: string;
	recoveryStartedAnnouncement: string;
	retryLabel: string;
	retryingLabel: string;
	resumedAnnouncement: string;
	spaceKeyLabel: string;
	sphereAlternative: string;
	stillSphereAlternative: string;
	takeAMoment: string;
	unavailableMessage: string;
	unavailableTitle: string;
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
 * Name of the plain Continue-request event emitted by the screen.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionContinueRequestEventName = 'tocus-continue-request';

/**
 * Name of the plain retry-request event emitted by the unavailable recovery action.
 * @since 0.1.0 Initial implementation.
 */
export const InterruptionRetryRequestEventName = 'tocus-retry-request';
