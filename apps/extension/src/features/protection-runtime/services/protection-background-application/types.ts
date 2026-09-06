import { type WxtBrowser } from 'wxt/browser';
import { type TabAudioMutedInfo } from '../tab-audio-controller';

/**
 * Native tab updates relevant to interruption audio ownership.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundTabAudioChange {
	/** Changed mute metadata, absent for unrelated tab updates. */
	mutedInfo?: TabAudioMutedInfo | undefined;
}

/**
 * Dependencies used to construct the extension background application.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionBackgroundApplicationOptions {
	/** Browser APIs used by protection, statistics, preferences, and onboarding. */
	browser: WxtBrowser;
}
