import { browser } from 'wxt/browser';
import { createPreferencesStorageService } from '../../../../domains/preferences/services';
import { type Language } from '../../../../domains/preferences/types';
import { resolveLanguage } from '../../../../domains/preferences/utils';
import { loadLocalizationBundle } from '../../../../localization';
import {
	createPreferencesController,
	type PreferencesController,
	type PreferencesLanguageChangeListener,
} from '../../../preferences/services/preferences-controller';
import { ComponentPopupShell } from '../../components/shell';

/**
 * Reveals the popup after either successful startup or terminal recovery.
 * @since 0.1.0 Initial implementation.
 */
function revealPopupPage(): void {
	document.documentElement.style.removeProperty( 'color-scheme' );
	document.documentElement.style.removeProperty( 'background' );
	document.documentElement.style.removeProperty( 'visibility' );
}

/**
 * Starts the popup page and reveals it after preferences and localized copy are ready.
 * @return Promise resolved after the initial popup projection is visible.
 * @since 0.1.0 Initial implementation.
 */
export async function startPopupPage(): Promise<void> {
	let languageChangeListener: PreferencesLanguageChangeListener | null = null;
	let preferencesController: PreferencesController | null = null;

	try {
		const popupShellCandidate = document.querySelector( 'tocus-f-popup-shell' );

		if ( ! ( popupShellCandidate instanceof ComponentPopupShell ) ) {
			throw new TypeError( 'Expected the popup page to contain the popup shell.' );
		}

		const popupShell = popupShellCandidate;
		const browserLanguage = resolveLanguage( browser.i18n.getUILanguage() );
		const preferencesStorage = createPreferencesStorageService( {
			area: browser.storage.local,
		} );
		const activePreferencesController = createPreferencesController( {
			appearanceTarget: document.documentElement,
			browserLanguage,
			storage: preferencesStorage,
			storageChanges: browser.storage.onChanged,
			systemMotionPreference: window.matchMedia( '(prefers-reduced-motion: reduce)' ),
		} );
		let localizationRevision = 0;

		preferencesController = activePreferencesController;

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
		 * Applies a live localization request without replacing the last usable copy on failure.
		 * @param language - Newly effective preference language.
		 * @return Promise resolved after the live request settles.
		 * @since 0.1.0 Initial implementation.
		 */
		async function applyLiveLocalization( language: Language ): Promise<void> {
			try {
				await applyLocalization( language );
			} catch {
				return;
			}
		}

		/**
		 * Starts one non-blocking live localization projection.
		 * @param language - Newly effective preference language.
		 * @since 0.1.0 Initial implementation.
		 */
		function handleLanguageChange( language: Language ): void {
			void applyLiveLocalization( language );
		}

		/**
		 * Waits until the most recently requested localization is projected.
		 * @return Promise resolved when no newer language request is pending.
		 * @since 0.1.0 Initial implementation.
		 */
		async function synchronizeLocalization(): Promise<void> {
			let requestedRevision: number;

			do {
				requestedRevision = localizationRevision + 1;
				await applyLocalization( activePreferencesController.language );
			} while ( requestedRevision !== localizationRevision );
		}

		languageChangeListener = handleLanguageChange;
		activePreferencesController.addLanguageChangeListener( languageChangeListener );
		await activePreferencesController.start();
		await synchronizeLocalization();
	} catch ( error ) {
		if ( preferencesController !== null && languageChangeListener !== null ) {
			preferencesController.removeLanguageChangeListener( languageChangeListener );
		}
		preferencesController?.stop();
		throw error;
	} finally {
		revealPopupPage();
	}
}

/**
 * Starts the popup while containing terminal bootstrap failures.
 * @return Promise resolved after startup succeeds or recovery reveals the page.
 * @since 0.1.0 Initial implementation.
 */
export async function bootstrapPopupPage(): Promise<void> {
	try {
		await startPopupPage();
	} catch {
		return;
	}
}
