import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { createPreferencesStorageService } from '../../domains/preferences/services';
import { type Language } from '../../domains/preferences/types';
import { resolveLanguage } from '../../domains/preferences/utils';
import { loadLocalizationBundle } from '../../localization';
import { createPreferencesController } from '../../features/preferences/services/preferences-controller';
import { ComponentPopupShell } from '../../features/popup/components/shell';
import './styles.scss';

/**
 * Popup-shell candidate mounted by the page document.
 * @since 0.1.0 Initial implementation.
 */
const popupShellCandidate = document.querySelector( 'tocus-f-popup-shell' );

if ( ! ( popupShellCandidate instanceof ComponentPopupShell ) ) {
	throw new TypeError( 'Expected the popup page to contain the popup shell.' );
}

/**
 * Validated popup shell receiving localized copy.
 * @since 0.1.0 Initial implementation.
 */
const popupShell = popupShellCandidate;

/**
 * Supported language derived from the browser UI locale.
 * @since 0.1.0 Initial implementation.
 */
const browserLanguage = resolveLanguage( browser.i18n.getUILanguage() );
const preferencesStorage = createPreferencesStorageService( {
	area: browser.storage.local,
} );
const preferencesController = createPreferencesController( {
	appearanceTarget: document.documentElement,
	browserLanguage,
	storage: preferencesStorage,
	storageChanges: browser.storage.onChanged,
	systemMotionPreference: window.matchMedia( '(prefers-reduced-motion: reduce)' ),
} );

/**
 * Latest requested localization projection revision.
 * @since 0.1.0 Initial implementation.
 */
let localizationRevision = 0;

/**
 * Applies one complete localization snapshot to the popup document.
 * @param language - Effective browser-derived or explicitly selected language.
 * @return Promise resolved after the latest requested language is projected.
 * @since 0.1.0 Initial implementation.
 */
async function applyLocalization( language: Language ): Promise<void> {
	localizationRevision += 1;
	const requestedRevision = localizationRevision;
	const localization = await loadLocalizationBundle( language );

	if ( requestedRevision !== localizationRevision ) {
		return;
	}

	document.documentElement.lang = localization.languageTag;
	document.title = localization.document.popupTitle;
	popupShell.copy = localization.popup;
}

/**
 * Starts one non-blocking live localization projection.
 * @param language - Newly effective preference language.
 * @since 0.1.0 Initial implementation.
 */
function handleLanguageChange( language: Language ): void {
	void applyLocalization( language );
}

preferencesController.addLanguageChangeListener( handleLanguageChange );

/**
 * Waits until the most recently requested localization is projected.
 * @return Promise resolved when no newer language request is pending.
 * @since 0.1.0 Initial implementation.
 */
async function synchronizeLocalization(): Promise<void> {
	let requestedRevision: number;

	do {
		requestedRevision = localizationRevision + 1;
		await applyLocalization( preferencesController.language );
	} while ( requestedRevision !== localizationRevision );
}

/**
 * Applies persisted preferences before revealing the popup document.
 * @return Promise resolved after the initial preference projection.
 * @since 0.1.0 Initial implementation.
 */
async function startPopup(): Promise<void> {
	await preferencesController.start();
	await synchronizeLocalization();
	document.documentElement.style.removeProperty( 'color-scheme' );
	document.documentElement.style.removeProperty( 'background' );
	document.documentElement.style.removeProperty( 'visibility' );
}

void startPopup();
