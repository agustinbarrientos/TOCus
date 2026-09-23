import { ReviewPromptStorageKey } from '../../../../domains/preferences/services/review-prompt-storage';
import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import type { StatisticsStorageChangeListener } from '../../../statistics/services/statistics-client/types';
import {
	ReviewPromptDismissRequestEventName,
	type ReviewPromptController,
	type ReviewPromptControllerOptions,
} from './types';

/**
 * One hour of estimated reclaimed time required before asking for a review.
 * @since 1.0.0 Initial implementation.
 */
const ReviewPromptThresholdMilliseconds = 3_600_000;

/**
 * Keeps an optional review invitation separate from interruption timing and continuation.
 * @param options - Authoritative statistics, local dismissal and presentation dependencies.
 * @return Invitation lifecycle and refresh operations.
 * @since 1.0.0 Initial implementation.
 */
export function createReviewPromptController(
	options: ReviewPromptControllerOptions,
): ReviewPromptController {
	let started = false;
	let dismissed = false;
	let dismissing = false;
	let readRevision = 0;
	let lifecycleRevision = 0;

	/**
	 * Reads eligibility without letting older results reopen a dismissed invitation.
	 * @return Completion after the read is either applied or safely discarded.
	 * @since 1.0.0 Initial implementation.
	 */
	async function refresh(): Promise<void> {
		if ( ! started || options.url === null || dismissing || dismissed ) {
			return;
		}
		const revision = ++readRevision;
		try {
			const [ statistics, storedDismissal ] = await Promise.all( [
				options.source.readStatistics(), options.storage.load(),
			] );
			if ( revision !== readRevision ) {
				return;
			}
			dismissed = storedDismissal === true;
			options.target.reviewPrompt = storedDismissal === false &&
				statistics.status === StatisticsProjectionStatus.AVAILABLE &&
				statistics.estimatedReclaimedMilliseconds >= ReviewPromptThresholdMilliseconds
				? {
					url: options.url,
					savedMilliseconds: statistics.estimatedReclaimedMilliseconds,
					dismissing: false,
					dismissalFailed: false,
				}
				: null;
		} catch {
			if ( revision === readRevision ) {
				options.target.reviewPrompt = null;
			}
		}
	}

	/**
	 * Refreshes eligibility after an authoritative statistics invalidation.
	 * @since 1.0.0 Initial implementation.
	 */
	function handleStatisticsChange(): void {
		void refresh();
	}

	/**
	 * Immediately applies dismissals from other tabs and rechecks explicit removals.
	 * @param changes - Changed browser-storage records.
	 * @param areaName - Browser storage area that changed.
	 * @since 1.0.0 Initial implementation.
	 */
	const handleStorageChange: StatisticsStorageChangeListener = ( changes, areaName ): void => {
		if ( ! started || areaName !== 'local' || ! Object.hasOwn( changes, ReviewPromptStorageKey ) ) {
			return;
		}
		readRevision += 1;
		dismissed = changes[ ReviewPromptStorageKey ]?.newValue === true;
		options.target.reviewPrompt = null;
		void refresh();
	};

	/**
	 * Saves permanent dismissal once and exposes a retry if persistence fails.
	 * @return Completion after durable dismissal or visible recovery.
	 * @since 1.0.0 Initial implementation.
	 */
	async function dismiss(): Promise<void> {
		const presentation = options.target.reviewPrompt;
		if ( ! started || presentation === null || dismissing ) {
			return;
		}
		const lifecycle = lifecycleRevision;
		readRevision += 1;
		dismissing = true;
		options.target.reviewPrompt = { ...presentation, dismissing: true, dismissalFailed: false };
		try {
			await options.storage.dismiss();
			if ( lifecycle === lifecycleRevision ) {
				dismissed = true;
				options.target.reviewPrompt = null;
			}
		} catch {
			if ( lifecycle === lifecycleRevision && ! dismissed ) {
				options.target.reviewPrompt = { ...presentation, dismissing: false, dismissalFailed: true };
			}
		} finally {
			if ( lifecycle === lifecycleRevision ) {
				dismissing = false;
			}
		}
	}

	/**
	 * Starts one nonblocking durable dismissal from a user action.
	 * @since 1.0.0 Initial implementation.
	 */
	function handleDismissRequest(): void {
		void dismiss();
	}

	/**
	 * Begins observing local changes only when a store destination exists.
	 * @since 1.0.0 Initial implementation.
	 */
	function start(): void {
		if ( started || options.url === null ) {
			return;
		}
		started = true;
		dismissed = false;
		options.target.addEventListener( ReviewPromptDismissRequestEventName, handleDismissRequest );
		options.source.addStatisticsChangeListener( handleStatisticsChange );
		options.storageChanges.addListener( handleStorageChange );
		void refresh();
	}

	/**
	 * Stops listeners and prevents pending reads or writes from repainting the screen.
	 * @since 1.0.0 Initial implementation.
	 */
	function stop(): void {
		if ( ! started ) {
			return;
		}
		started = false;
		dismissing = false;
		readRevision += 1;
		lifecycleRevision += 1;
		options.target.removeEventListener( ReviewPromptDismissRequestEventName, handleDismissRequest );
		options.source.removeStatisticsChangeListener( handleStatisticsChange );
		options.storageChanges.removeListener( handleStorageChange );
		options.target.reviewPrompt = null;
	}

	return { start, stop, refresh };
}

export * from './types';
