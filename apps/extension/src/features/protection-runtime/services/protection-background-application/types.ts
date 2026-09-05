import { type WxtBrowser } from 'wxt/browser';

/**
 * Dependencies used to construct the extension background application.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundApplicationOptions {
	/** Browser APIs used by protection, statistics, preferences, and onboarding. */
	browser: WxtBrowser;
}
