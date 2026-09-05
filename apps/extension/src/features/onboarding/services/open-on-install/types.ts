import { type WxtBrowser } from 'wxt/browser';

/**
 * Browser-local storage keys owned by onboarding installation recovery.
 * @since 0.1.0 Initial implementation.
 */
export const OnboardingInstallStorageKey = {
	PENDING_OPEN: 'tocus.onboarding.pending-open.v1',
} as const;

/**
 * Dependencies used to open onboarding after first installation.
 * @since 0.1.0 Initial implementation.
 */
export interface OpenOnInstallOptions {
	/** Browser APIs used for installation events, local recovery, extension URLs, and tab creation. */
	browser: WxtBrowser;
}

/**
 * Browser details supplied to an extension installation listener.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionInstallationDetails {
	/** Browser installation reason. */
	reason: string;
}
