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
import { type InterruptionPageRequest } from '../../../protection-runtime/types/runtime-message';
import { createStatisticsClient } from '../../../statistics/services/statistics-client';
import {
	createWellbeingSummaryController,
	type WellbeingSummaryController,
} from '../../../statistics/services/wellbeing-summary-controller';
import { ComponentInterruptionScreen } from '../../components/screen';
import { InterruptionScreenState } from '../../components/screen/types';
import {
	createInterruptionPageController,
	type InterruptionPageClock,
	type InterruptionPageController,
	type InterruptionPageRuntime,
	type InterruptionPageVisibility,
} from '../interruption-page-controller';

/**
 * Reveals the interruption document after either successful startup or terminal recovery.
 * @since 0.1.0 Initial implementation.
 */
function revealInterruptionPage(): void {
	document.documentElement.style.removeProperty( 'color-scheme' );
	document.documentElement.style.removeProperty( 'background' );
	document.documentElement.style.removeProperty( 'visibility' );
}

/**
 * Starts the interruption page after preferences and localized copy are ready.
 * @return Promise resolved after interruption timing is connected and visible.
 * @since 0.1.0 Initial implementation.
 */
export async function startInterruptionPage(): Promise<void> {
	let controller: InterruptionPageController | null = null;
	let interruptionScreen: ComponentInterruptionScreen | null = null;
	let languageChangeListener: PreferencesLanguageChangeListener | null = null;
	let preferencesController: PreferencesController | null = null;
	let wellbeingSummaryController: WellbeingSummaryController | null = null;

	try {
		const interruptionScreenCandidate = document.querySelector( 'tocus-f-interruption-screen' );

		if ( ! ( interruptionScreenCandidate instanceof ComponentInterruptionScreen ) ) {
			throw new TypeError( 'Expected the interruption page to contain the interruption screen.' );
		}

		const activeInterruptionScreen = interruptionScreenCandidate;
		const browserLanguage = resolveLanguage( browser.i18n.getUILanguage() );

		interruptionScreen = activeInterruptionScreen;

		/**
		 * Sends one interruption-page request through the extension runtime.
		 * @param request - Validated interruption-page request.
		 * @return Unknown response awaiting controller validation.
		 * @since 0.1.0 Initial implementation.
		 */
		function sendInterruptionPageRequest( request: InterruptionPageRequest ): Promise<unknown> {
			return browser.runtime.sendMessage( request );
		}

		/**
		 * Reports whether the interruption document is currently visible.
		 * @return Current document visibility.
		 * @since 0.1.0 Initial implementation.
		 */
		function isDocumentVisible(): boolean {
			return document.visibilityState === 'visible';
		}

		/**
		 * Reports whether the interruption document currently owns browser-window focus.
		 * @return Whether focused progress may advance in the current browser window.
		 * @since 0.1.0 Initial implementation.
		 */
		function isWindowFocused(): boolean {
			return document.hasFocus();
		}

		/**
		 * Returns current epoch time for exact allowance-expiry synchronization.
		 * @return Current epoch milliseconds.
		 * @since 0.1.0 Initial implementation.
		 */
		function getCurrentEpochMilliseconds(): number {
			return Date.now();
		}

		const runtime: InterruptionPageRuntime = {
			sendMessage: sendInterruptionPageRequest,
		};
		const clock: InterruptionPageClock = {
			now: getCurrentEpochMilliseconds,
		};
		const motionPreference = window.matchMedia( '(prefers-reduced-motion: reduce)' );
		const visibility: InterruptionPageVisibility = {
			isDocumentVisible,
			isWindowFocused,
		};
		const preferencesStorage = createPreferencesStorageService( {
			area: browser.storage.local,
		} );
		const activePreferencesController = createPreferencesController( {
			appearanceTarget: document.documentElement,
			browserLanguage,
			presentation: activeInterruptionScreen,
			storage: preferencesStorage,
			storageChanges: browser.storage.onChanged,
			systemMotionPreference: motionPreference,
		} );
		const statisticsClient = createStatisticsClient( {
			runtime: browser.runtime,
			storageChanges: browser.storage.onChanged,
		} );
		const activeWellbeingSummaryController = createWellbeingSummaryController( {
			source: statisticsClient,
			target: activeInterruptionScreen,
		} );
		let localizationRevision = 0;

		preferencesController = activePreferencesController;
		wellbeingSummaryController = activeWellbeingSummaryController;

		/**
		 * Applies one complete localization snapshot to the interruption document.
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
			document.title = localization.document.interruptionTitle;
			activeInterruptionScreen.copy = localization.interruption;
			activeInterruptionScreen.wellbeingSummary = localization.wellbeing.neutral;
			activeWellbeingSummaryController.setCopy( localization.wellbeing );
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

		/**
		 * Starts a non-blocking footer refresh after an authoritative major-state change.
		 * @since 0.1.0 Initial implementation.
		 */
		function refreshWellbeingSummary(): void {
			void activeWellbeingSummaryController.refresh();
		}

		languageChangeListener = handleLanguageChange;
		activePreferencesController.addLanguageChangeListener( languageChangeListener );
		await activePreferencesController.start();
		await synchronizeLocalization();
		activeWellbeingSummaryController.start();
		const activeController = createInterruptionPageController( {
			clock,
			documentTarget: document,
			motionPreference: activePreferencesController,
			onPresentationStateChange: refreshWellbeingSummary,
			runtime,
			scheduler: window,
			screen: activeInterruptionScreen,
			visibility,
			windowTarget: window,
		} );

		controller = activeController;
		await activeController.start();
	} catch ( error ) {
		controller?.stop();
		wellbeingSummaryController?.stop();
		if ( preferencesController !== null && languageChangeListener !== null ) {
			preferencesController.removeLanguageChangeListener( languageChangeListener );
		}
		preferencesController?.stop();
		if ( interruptionScreen !== null ) {
			interruptionScreen.progressing = false;
			interruptionScreen.recovering = false;
			interruptionScreen.state = InterruptionScreenState.UNAVAILABLE;
		}
		throw error;
	} finally {
		revealInterruptionPage();
	}
}

/**
 * Starts interruption while containing terminal bootstrap failures.
 * @return Promise resolved after startup succeeds or recovery reveals the page.
 * @since 0.1.0 Initial implementation.
 */
export async function bootstrapInterruptionPage(): Promise<void> {
	try {
		await startInterruptionPage();
	} catch {
		return;
	}
}
