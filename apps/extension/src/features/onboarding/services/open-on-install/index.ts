import {
	type ExtensionInstallationDetails,
	OnboardingInstallStorageKey,
	type OpenOnInstallOptions,
} from './types';

/**
 * Number of immediate tab attempts made for each recoverable onboarding open.
 * @since 0.1.0 Initial implementation.
 */
const MaximumOnboardingOpenAttempts = 2;

/**
 * Registers the first-install listener that opens the onboarding page.
 * @param options - Browser APIs used by the installation flow.
 * @since 0.1.0 Initial implementation.
 */
export function registerOnboardingOpenOnInstall( options: OpenOnInstallOptions ): void {
	let openQueue = Promise.resolve();

	/**
	 * Attempts to open onboarding without allowing a browser rejection to escape.
	 * @return Whether one onboarding tab was created.
	 * @since 0.1.0 Initial implementation.
	 */
	async function openOnboardingTab(): Promise<boolean> {
		for ( let attempt = 0; attempt < MaximumOnboardingOpenAttempts; attempt += 1 ) {
			try {
				await options.browser.tabs.create( {
					url: options.browser.runtime.getURL( '/onboarding.html' ),
				} );

				return true;
			} catch {
				continue;
			}
		}

		return false;
	}

	/**
	 * Opens a locally pending onboarding page and clears recovery after success.
	 * @return Promise resolved after local recovery settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function openPendingOnboarding(): Promise<void> {
		try {
			const stored = await options.browser.storage.local.get(
				OnboardingInstallStorageKey.PENDING_OPEN,
			);

			if ( stored[ OnboardingInstallStorageKey.PENDING_OPEN ] !== true ) {
				return;
			}

			if ( await openOnboardingTab() ) {
				await options.browser.storage.local.remove( OnboardingInstallStorageKey.PENDING_OPEN );
			}
		} catch {
			return;
		}
	}

	/**
	 * Serializes recovery checks so one worker cannot open duplicate onboarding tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueuePendingOnboarding(): void {
		openQueue = openQueue.then( openPendingOnboarding );
	}

	/**
	 * Persists first-install onboarding before requesting its browser tab.
	 * @return Promise resolved after the request is queued or directly attempted.
	 * @since 0.1.0 Initial implementation.
	 */
	async function openFirstInstallOnboarding(): Promise<void> {
		try {
			await options.browser.storage.local.set( {
				[ OnboardingInstallStorageKey.PENDING_OPEN ]: true,
			} );
		} catch {
			await openOnboardingTab();

			return;
		}

		enqueuePendingOnboarding();
	}

	/**
	 * Opens onboarding only for a fresh extension installation.
	 * @param details - Browser installation event details.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleExtensionInstalled( details: ExtensionInstallationDetails ): void {
		if ( details.reason !== 'install' ) {
			return;
		}

		void openFirstInstallOnboarding();
	}

	options.browser.runtime.onInstalled.addListener( handleExtensionInstalled );
	enqueuePendingOnboarding();
}

export * from './types';
