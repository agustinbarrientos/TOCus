import type { ReviewPromptStorageService } from '../../../../domains/preferences/services/review-prompt-storage';
import type {
	StatisticsChangeSource,
	StatisticsStorageChangeSource,
} from '../../../statistics/services/statistics-client/types';

/**
 * Event requested by either the review link or permanent-dismissal button.
 * @since 1.0.0 Initial implementation.
 */
export const ReviewPromptDismissRequestEventName = 'tocus-dismiss-review-request';

/**
 * Visible review invitation and its durable-dismissal feedback.
 * @since 1.0.0 Initial implementation.
 */
export interface ReviewPromptPresentation {
	/** Browser-specific store review destination. */
	url: string;
	/** Authoritative all-time estimated time reclaimed, in milliseconds. */
	savedMilliseconds: number;
	/** Whether a permanent dismissal is being saved. */
	dismissing: boolean;
	/** Whether the last dismissal failed and may be retried. */
	dismissalFailed: boolean;
}

/**
 * Interruption screen boundary for an optional review invitation.
 * @since 1.0.0 Initial implementation.
 */
export interface ReviewPromptTarget extends Pick<EventTarget, 'addEventListener' | 'removeEventListener'> {
	/** Current invitation, or null while ineligible or permanently dismissed. */
	reviewPrompt: Readonly<ReviewPromptPresentation> | null;
}

/**
 * Local-only dependencies for the interruption review invitation.
 * @since 1.0.0 Initial implementation.
 */
export interface ReviewPromptControllerOptions {
	/** Authoritative all-time statistics with invalidation events. */
	source: StatisticsChangeSource;
	/** Existing interruption presentation. */
	target: ReviewPromptTarget;
	/** Independent permanent-dismissal persistence. */
	storage: ReviewPromptStorageService;
	/** Cross-context local-storage invalidations. */
	storageChanges: StatisticsStorageChangeSource;
	/** Browser store destination, or null when no valid destination exists. */
	url: string | null;
}

/**
 * Lifecycle and authoritative refresh operations for one invitation.
 * @since 1.0.0 Initial implementation.
 */
export interface ReviewPromptController {
	/**
	 * Observes changes and starts a nonblocking eligibility read.
	 * @since 1.0.0 Initial implementation.
	 */
	start(): void;
	/**
	 * Removes listeners and invalidates all pending presentation updates.
	 * @since 1.0.0 Initial implementation.
	 */
	stop(): void;
	/**
	 * Refreshes eligibility using authoritative statistics and local dismissal.
	 * @return Completion after the newest relevant read settles.
	 * @since 1.0.0 Initial implementation.
	 */
	refresh(): Promise<void>;
}
