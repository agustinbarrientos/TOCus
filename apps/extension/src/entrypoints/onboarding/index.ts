import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { resolveLanguage } from '../../domains/preferences/utils';
import { ComponentOnboardingShell } from '../../features/onboarding/components/shell';
import { bootstrapOnboardingPage } from '../../features/onboarding/services/onboarding-page';
import { loadLocalizationBundle } from '../../localization';
import './styles.scss';

const onboardingShell = document.querySelector( 'tocus-f-onboarding-shell' );

if ( ! ( onboardingShell instanceof ComponentOnboardingShell ) ) {
	throw new TypeError( 'Expected the onboarding page to contain the onboarding shell.' );
}

/**
 * Opens the browser-managed extension Settings page.
 * @return Promise resolved after the browser accepts the request.
 * @since 0.1.0 Initial implementation.
 */
function openSettings(): Promise<void> {
	return browser.runtime.openOptionsPage();
}

void bootstrapOnboardingPage( {
	browserLanguage: resolveLanguage( browser.i18n.getUILanguage() ),
	cryptography: crypto,
	document,
	loadLocalization: loadLocalizationBundle,
	locks: navigator.locks,
	openSettings,
	pageWindow: window,
	permissions: browser.permissions,
	shell: onboardingShell,
	storageArea: browser.storage.local,
	storageChanges: browser.storage.onChanged,
} );
