import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { createPreferencesStorageService } from '../../domains/preferences/services';
import { type Language } from '../../domains/preferences/types';
import { resolveLanguage } from '../../domains/preferences/utils';
import { ComponentInterruptionScreen } from '../../features/interruption/components/screen';
import {
	createInterruptionPageController,
	type InterruptionPageClock,
	type InterruptionPageRuntime,
	type InterruptionPageVisibility,
} from '../../features/interruption/services/interruption-page-controller';
import { type InterruptionPageRequest } from '../../features/protection-runtime/types/runtime-message';
import { loadLocalizationBundle } from '../../localization';
import { createPreferencesController } from '../../features/preferences/services/preferences-controller';
import { createStatisticsClient } from '../../features/statistics/services/statistics-client';
import { createWellbeingSummaryController } from '../../features/statistics/services/wellbeing-summary-controller';
import './styles.scss';

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

/**
 * Interruption-screen candidate mounted by the page document.
 * @since 0.1.0 Initial implementation.
 */
const interruptionScreenCandidate = document.querySelector( 'tocus-f-interruption-screen' );

if ( ! ( interruptionScreenCandidate instanceof ComponentInterruptionScreen ) ) {
	throw new TypeError( 'Expected the interruption page to contain the interruption screen.' );
}

/**
 * Validated interruption screen receiving runtime and statistics state.
 * @since 0.1.0 Initial implementation.
 */
const interruptionScreen = interruptionScreenCandidate;

/**
 * Supported language derived from the browser UI locale.
 * @since 0.1.0 Initial implementation.
 */
const browserLanguage = resolveLanguage( browser.i18n.getUILanguage() );

/**
 * Extension runtime boundary used by the interruption controller.
 * @since 0.1.0 Initial implementation.
 */
const runtime: InterruptionPageRuntime = {
	sendMessage: sendInterruptionPageRequest,
};

/**
 * Wall-clock boundary used by the interruption controller.
 * @since 0.1.0 Initial implementation.
 */
const clock: InterruptionPageClock = {
	now: getCurrentEpochMilliseconds,
};

/**
 * Live operating-system motion preference used by the interruption presentation.
 * @since 0.1.0 Initial implementation.
 */
const motionPreference = window.matchMedia( '(prefers-reduced-motion: reduce)' );

/**
 * Document and browser-window visibility boundary used by focused pause timing.
 * @since 0.1.0 Initial implementation.
 */
const visibility: InterruptionPageVisibility = {
	isDocumentVisible,
	isWindowFocused,
};

/**
 * Local preference persistence used by the interruption page.
 * @since 0.1.0 Initial implementation.
 */
const preferencesStorage = createPreferencesStorageService( {
	area: browser.storage.local,
} );

/**
 * Preference projection applied before the interruption page becomes visible.
 * @since 0.1.0 Initial implementation.
 */
const preferencesController = createPreferencesController( {
	appearanceTarget: document.documentElement,
	browserLanguage,
	presentation: interruptionScreen,
	storage: preferencesStorage,
	storageChanges: browser.storage.onChanged,
	systemMotionPreference: motionPreference,
} );

/**
 * Local statistics client shared by interruption wellbeing presentation.
 * @since 0.1.0 Initial implementation.
 */
const statisticsClient = createStatisticsClient( {
	runtime: browser.runtime,
	storageChanges: browser.storage.onChanged,
} );

/**
 * Keeps the interruption footer synchronized with authoritative local totals.
 * @since 0.1.0 Initial implementation.
 */
const wellbeingSummaryController = createWellbeingSummaryController( {
	source: statisticsClient,
	target: interruptionScreen,
} );

/**
 * Latest requested localization projection revision.
 * @since 0.1.0 Initial implementation.
 */
let localizationRevision = 0;

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
	interruptionScreen.copy = localization.interruption;
	interruptionScreen.wellbeingSummary = localization.wellbeing.neutral;
	wellbeingSummaryController.setCopy( localization.wellbeing );
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
 * Starts a non-blocking footer refresh after an authoritative major-state change.
 * @since 0.1.0 Initial implementation.
 */
function refreshWellbeingSummary(): void {
	void wellbeingSummaryController.refresh();
}

/**
 * Applies local preferences before connecting interruption behavior.
 * @return Promise resolved after preference and interruption startup.
 * @since 0.1.0 Initial implementation.
 */
async function startInterruptionPage(): Promise<void> {
	await preferencesController.start();
	await synchronizeLocalization();
	wellbeingSummaryController.start();
	const controller = createInterruptionPageController( {
		clock,
		documentTarget: document,
		motionPreference: preferencesController,
		onPresentationStateChange: refreshWellbeingSummary,
		runtime,
		scheduler: window,
		screen: interruptionScreen,
		visibility,
		windowTarget: window,
	} );

	await controller.start();
	document.documentElement.style.removeProperty( 'color-scheme' );
	document.documentElement.style.removeProperty( 'background' );
	document.documentElement.style.removeProperty( 'visibility' );
}

void startInterruptionPage();
