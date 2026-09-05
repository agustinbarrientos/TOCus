import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { resolveLanguage } from '../../domains/preferences/utils';
import { ComponentSettingsShell } from '../../features/settings/components/shell';
import { SettingsPlatform } from '../../features/settings/components/shell/types';
import { bootstrapSettingsPage } from '../../features/settings/services/settings-page';
import { loadLocalizationBundle } from '../../localization';
import './styles.scss';

const settingsShell = document.querySelector( 'tocus-f-settings-shell' );

if ( ! ( settingsShell instanceof ComponentSettingsShell ) ) {
	throw new TypeError( 'Expected the options page to contain the settings shell.' );
}

void bootstrapSettingsPage( {
	browserLanguage: resolveLanguage( browser.i18n.getUILanguage() ),
	cryptography: crypto,
	document,
	extensionRootUrl: browser.runtime.getURL( '/' ),
	loadLocalization: loadLocalizationBundle,
	locks: navigator.locks,
	pageWindow: window,
	permissions: browser.permissions,
	platform: import.meta.env.SAFARI
		? SettingsPlatform.SAFARI
		: import.meta.env.FIREFOX
			? SettingsPlatform.FIREFOX
			: SettingsPlatform.CHROME,
	runtime: browser.runtime,
	shell: settingsShell,
	storageArea: browser.storage.local,
	storageChanges: browser.storage.onChanged,
	supportsCachedFavicons: import.meta.env.CHROME,
} );
