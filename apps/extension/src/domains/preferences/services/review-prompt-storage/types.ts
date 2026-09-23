import type { PreferencesStorageArea } from '../preferences-storage';

/**
 * Local-only permanent review-prompt dismissal, separate from resettable statistics.
 * @since 0.1.0 Initial implementation.
 */
export const ReviewPromptStorageKey = 'tocus.review-prompt-dismissed.v1';

/**
 * Browser-local persistence dependency for the review prompt.
 * @since 0.1.0 Initial implementation.
 */
export interface ReviewPromptStorageServiceOptions {
	/** Existing extension-local storage area. */
	area: PreferencesStorageArea;
}

/**
 * Permanent local dismissal operations without changing existing preferences.
 * @since 0.1.0 Initial implementation.
 */
export interface ReviewPromptStorageService {
	/**
	 * Reads dismissal without repairing malformed data.
	 * @return False when missing, persisted boolean, or null for malformed data.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<boolean | null>;
	/**
	 * Permanently dismisses the prompt for this local installation.
	 * @return Completion after the durable write succeeds.
	 * @since 0.1.0 Initial implementation.
	 */
	dismiss(): Promise<void>;
}
