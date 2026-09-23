import '@tocus/theme/index.scss';
import '@tocus/ui/styles.scss';
import '@tocus/ui/notifications.scss';
import { browser } from 'wxt/browser';
import { resolveLanguage } from '../../domains/preferences/utils';
import { mountOnboarding } from '../../features/onboarding/services/onboarding-presentation';
import { bootstrapOnboardingPage } from '../../features/onboarding/services/onboarding-page';
import { consumeOnboardingResetCompletion } from '../../features/onboarding/services/reset-completion';
import { loadLocalizationBundle } from '../../localization';
import './styles.scss';

const container = document.getElementById( 'app' );

if ( ! container ) {
	throw new TypeError( 'Expected the onboarding page to contain the onboarding shell.' );
}
const onboardingShell = mountOnboarding( container );

/**
 * Opens the browser-managed extension Settings page.
 * @return Promise resolved after the browser accepts the request.
 * @since 1.0.0 Initial implementation.
 */
function openSettings(): Promise<void> {
	return browser.runtime.openOptionsPage();
}

/**
 * Verifies and consumes the completed-reset handoff in this onboarding tab.
 * @return Whether the loaded page may announce reset completion once.
 * @since 1.0.0
 */
function readResetCompletion(): Promise<boolean> {
	return consumeOnboardingResetCompletion( { storageArea: browser.storage.local, pageWindow: window } );
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
	readResetCompletion,
} );
