import {
	ReviewPromptStorageKey,
	type ReviewPromptStorageService,
	type ReviewPromptStorageServiceOptions,
} from './types';

/**
 * Creates local persistence for a review invitation's permanent dismissal.
 * @param options - Existing browser-local storage boundary.
 * @return Independent dismissal read and write operations.
 * @since 0.1.0 Initial implementation.
 */
export function createReviewPromptStorageService(
	options: ReviewPromptStorageServiceOptions,
): ReviewPromptStorageService {
	/**
	 * Reads the stored flag without altering missing or malformed data.
	 * @return Dismissal flag or a malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(): Promise<boolean | null> {
		const values = await options.area.get( ReviewPromptStorageKey );
		if ( ! Object.hasOwn( values, ReviewPromptStorageKey ) ) {
			return false;
		}
		const dismissed = values[ ReviewPromptStorageKey ];
		return typeof dismissed === 'boolean' ? dismissed : null;
	}

	/**
	 * Writes only the permanent dismissal flag.
	 * @return Completion after browser storage accepts the dismissal.
	 * @since 0.1.0 Initial implementation.
	 */
	function dismiss(): Promise<void> {
		return options.area.set( { [ ReviewPromptStorageKey ]: true } );
	}

	return { load, dismiss };
}

export * from './types';
