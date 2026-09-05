import { type Language } from '../../../../domains/preferences/types';
import {
	type OnboardingLocalizationCoordinator,
	type OnboardingLocalizationCoordinatorOptions,
} from './types';

/**
 * Creates latest-only localization coordination for onboarding.
 * @param options - Localization loader and projection callback.
 * @return Localization request and readiness operations.
 * @since 0.1.0 Initial implementation.
 */
export function createOnboardingLocalizationCoordinator(
	options: OnboardingLocalizationCoordinatorOptions,
): OnboardingLocalizationCoordinator {
	let appliedLanguage: Language | null = null;
	let latestLanguage: Language | null = null;
	let pendingLanguage: Language | null = null;
	let pendingRequest: Promise<boolean> | null = null;
	let revision = 0;

	/**
	 * Clears the pending request when it still represents the current revision.
	 * @param requestRevision - Revision owned by the settled request.
	 * @since 0.1.0 Initial implementation.
	 */
	function clearPendingRequest( requestRevision: number ): void {
		if ( requestRevision === revision ) {
			pendingLanguage = null;
			pendingRequest = null;
		}
	}

	/**
	 * Loads and applies one localization only while it remains current.
	 * @param language - Exact requested language.
	 * @param requestRevision - Revision assigned to this request.
	 * @return Whether this request remained current and was applied.
	 * @since 0.1.0 Initial implementation.
	 */
	async function loadLocalization(
		language: Language,
		requestRevision: number,
	): Promise<boolean> {
		const localization = await options.load( language );

		if ( requestRevision !== revision ) {
			return false;
		}

		options.apply( localization );
		appliedLanguage = localization.language;
		latestLanguage = localization.language;

		return localization.language === language;
	}

	/**
	 * Starts or reuses one localization request.
	 * @param language - Exact language to load.
	 * @return Whether this request remained current and was applied.
	 * @since 0.1.0 Initial implementation.
	 */
	function request( language: Language ): Promise<boolean> {
		if ( appliedLanguage === language && pendingRequest === null ) {
			latestLanguage = language;

			return Promise.resolve( true );
		}

		if ( pendingLanguage === language && pendingRequest !== null ) {
			return pendingRequest;
		}

		revision += 1;
		const requestRevision = revision;
		const requestPromise = loadLocalization( language, requestRevision );

		latestLanguage = language;
		pendingLanguage = language;
		pendingRequest = requestPromise;
		void requestPromise.then(
			() => {
				clearPendingRequest( requestRevision );
			},
			() => {
				clearPendingRequest( requestRevision );
			},
		);

		return requestPromise;
	}

	/**
	 * Waits for one language only when it is still the newest selection.
	 * @param language - Exact language required before navigation.
	 * @return Whether the requested language is now applied.
	 * @since 0.1.0 Initial implementation.
	 */
	function synchronize( language: Language ): Promise<boolean> {
		if ( appliedLanguage === language ) {
			return Promise.resolve( true );
		}

		if ( pendingRequest !== null ) {
			return pendingLanguage === language
				? pendingRequest
				: Promise.resolve( false );
		}

		if ( latestLanguage !== null && latestLanguage !== language ) {
			return Promise.resolve( false );
		}

		return request( language );
	}

	return Object.freeze( { request, synchronize } );
}

export * from './types';
