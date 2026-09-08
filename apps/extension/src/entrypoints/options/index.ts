import '@tocus/ui/styles.scss';
import { browser } from 'wxt/browser';
import { resolveLanguage } from '../../domains/preferences/utils';
import { mountSettings } from '../../features/settings/services/settings-presentation';
import { SettingsPlatform } from '../../features/settings/components/shell/types';
import { bootstrapSettingsPage } from '../../features/settings/services/settings-page';
import { loadLocalizationBundle } from '../../localization';
import './styles.scss';

const settingsContainer = document.getElementById( 'settings-root' );

if ( settingsContainer === null ) {
	throw new TypeError( 'Expected the options page to contain the settings shell.' );
}

const settingsShell = mountSettings( settingsContainer );

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
	version: browser.runtime.getManifest().version,
} );
