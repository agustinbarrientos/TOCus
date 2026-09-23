import type { Browser, WxtBrowser } from 'wxt/browser';
import type { TabAudioMutedInfo } from '../tab-audio-controller';
import type { ExtensionTabContextTab } from '../../../../shared/services/extension-tab-context';

/**
 * Live originating-tab identity, including a pending browser navigation state.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectionBackgroundSettingsTab = ExtensionTabContextTab & Pick<Browser.tabs.Tab, 'status'>;

/**
 * Optional live extension context lookup, unavailable in older browser engines.
 * @since 1.0.0 Initial implementation.
 */
export type ProtectionBackgroundSettingsRuntime = Partial<Pick<WxtBrowser[ 'runtime' ], 'getContexts'>>;

/**
 * Native tab updates relevant to interruption audio ownership.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectionBackgroundTabAudioChange {
	/** Changed mute metadata, absent for unrelated tab updates. */
	mutedInfo?: TabAudioMutedInfo | undefined;
}

/**
 * Dependencies used to construct the extension background application.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectionBackgroundApplicationOptions {
	/** Browser APIs used by protection, statistics, preferences, and onboarding. */
	browser: WxtBrowser;
}
