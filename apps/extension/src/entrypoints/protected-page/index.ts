import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { createPreferencesStorageService } from '../../domains/preferences/services';
import { type Language } from '../../domains/preferences/types';
import { resolveLanguage } from '../../domains/preferences/utils';
import { type AllowanceId } from '../../domains/protection/types/protection-value';
import { ComponentProtectedPageLayer } from '../../features/interruption/components/protected-page-layer';
import {
	createInterruptionPageController,
	type InterruptionPageController,
	type InterruptionPageVisibility,
} from '../../features/interruption/services/interruption-page-controller';
import {
	createProtectedPageLayerController,
	type ProtectedPageLayerController,
} from '../../features/interruption/services/protected-page-layer-controller';
import {
	createPreferencesController,
	type PreferencesController,
	type PreferencesLanguageChangeListener,
} from '../../features/preferences/services/preferences-controller';
import { createLocalizedProtectedPageCopy } from '../../localization/utils/create-localized-protected-page-copy';
import {
	ProtectionClockRequestType,
	type InterruptionPageRequest,
} from '../../features/protection-runtime/types/runtime-message';
import { createStatisticsClient } from '../../features/statistics/services/statistics-client';
import {
	createWellbeingSummaryController,
	type WellbeingSummaryController,
} from '../../features/statistics/services/wellbeing-summary-controller';

/**
 * Isolated-world key that prevents duplicate protected-page initialization.
 * @since 0.1.0 Initial implementation.
 */
const PROTECTED_PAGE_INITIALIZATION_KEY = Symbol.for( 'tocus.protected-page.initialization' );

/**
 * Reports whether an isolated-world value is a protected-page initialization promise.
 * @param value - Isolated-world value to inspect.
 * @return Whether the value can be reused as the shared initialization.
 * @since 0.1.0 Initial implementation.
 */
function isProtectedPageInitialization( value: unknown ): value is Promise<void> {
	return value instanceof Promise;
}

/**
 * Sends one interruption request through the extension runtime.
 * @param request - Validated interruption request.
 * @return Unknown response awaiting controller validation.
 * @since 0.1.0 Initial implementation.
 */
function sendInterruptionPageRequest( request: InterruptionPageRequest ): Promise<unknown> {
	return browser.runtime.sendMessage( request );
}

/**
 * Requests authoritative clock reconciliation after one page-local allowance expiry.
 * @param allowanceId - Allowance identity that armed the local expiry guard.
 * @return Promise resolved after extension messaging accepts the request.
 * @since 0.1.0 Initial implementation.
 */
async function reconcileAllowanceExpiry( allowanceId: AllowanceId ): Promise<void> {
	await browser.runtime.sendMessage( {
		type: ProtectionClockRequestType.RECONCILE_ALLOWANCE_EXPIRY,
		allowanceId,
	} );
}

/**
 * Returns the current wall-clock epoch time.
 * @return Current epoch milliseconds.
 * @since 0.1.0 Initial implementation.
 */
function getCurrentEpochMilliseconds(): number {
	return Date.now();
}

/**
 * Reads the current isolated-world protected-page initialization.
 * @return Existing initialization promise, or null before initialization begins.
 * @since 0.1.0 Initial implementation.
 */
function getProtectedPageInitialization(): Promise<void> | null {
	const initialization: unknown = Reflect.get( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY );

	return isProtectedPageInitialization( initialization ) ? initialization : null;
}

/**
 * Creates one owned warning and interruption layer in an authorized protected document.
 * @return Promise resolved after the layer and its message listener are ready.
 * @since 0.1.0 Initial implementation.
 */
async function initializeProtectedPageLayer(): Promise<void> {
	const layer = new ComponentProtectedPageLayer();
	let interruptionController: InterruptionPageController | null = null;
	let layerController: ProtectedPageLayerController | null = null;
	let languageChangeListener: PreferencesLanguageChangeListener | null = null;
	let preferencesController: PreferencesController | null = null;
	let wellbeingSummaryController: WellbeingSummaryController | null = null;

	layer.connectionGuardEnabled = true;
	layer.style.visibility = 'hidden';
	document.documentElement.append( layer );

	try {
		const browserLanguage = resolveLanguage( browser.i18n.getUILanguage() );
		const bootstrapLocalization = createLocalizedProtectedPageCopy( browserLanguage );

		layer.lang = bootstrapLocalization.languageTag;
		layer.copy = bootstrapLocalization.protectedPageLayer;
		layer.interruptionCopy = bootstrapLocalization.interruption;
		await layer.updateComplete;
		const interruptionScreen = layer.getInterruptionScreen();

		interruptionScreen.wellbeingSummary = bootstrapLocalization.wellbeing.neutral;
		const preferencesStorage = createPreferencesStorageService( {
			area: browser.storage.local,
		} );

		preferencesController = createPreferencesController( {
			appearanceTarget: layer,
			browserLanguage,
			presentation: interruptionScreen,
			storage: preferencesStorage,
			storageChanges: browser.storage.onChanged,
			systemMotionPreference: window.matchMedia( '(prefers-reduced-motion: reduce)' ),
		} );
		const statisticsClient = createStatisticsClient( {
			runtime: browser.runtime,
			storageChanges: browser.storage.onChanged,
		} );
		wellbeingSummaryController = createWellbeingSummaryController( {
			source: statisticsClient,
			target: interruptionScreen,
		} );
		const activeWellbeingSummaryController = wellbeingSummaryController;

		/**
		 * Applies one complete localization snapshot to the owned protected-page layer.
		 * @param language - Effective browser-derived or explicitly selected language.
		 * @since 0.1.0 Initial implementation.
		 */
		function applyLocalization( language: Language ): void {
			const localization = createLocalizedProtectedPageCopy( language );

			layer.lang = localization.languageTag;
			layer.copy = localization.protectedPageLayer;
			layer.interruptionCopy = localization.interruption;
			interruptionScreen.wellbeingSummary = localization.wellbeing.neutral;
			activeWellbeingSummaryController.setCopy( localization.wellbeing );
		}

		languageChangeListener = applyLocalization;
		preferencesController.addLanguageChangeListener( languageChangeListener );

		/**
		 * Starts a non-blocking footer refresh after an authoritative major-state change.
		 * @since 0.1.0 Initial implementation.
		 */
		function refreshWellbeingSummary(): void {
			void activeWellbeingSummaryController.refresh();
		}

		await preferencesController.start();
		applyLocalization( preferencesController.language );
		activeWellbeingSummaryController.start();
		const visibility: InterruptionPageVisibility = {
			/**
			 * Reports whether the live protected page and native interruption are both visible.
			 * @return Current protected-page presentation visibility.
			 * @since 0.1.0 Initial implementation.
			 */
			isDocumentVisible(): boolean {
				return document.visibilityState === 'visible' && layer.isInterruptionPresentationVisible();
			},
			/**
			 * Reports whether the protected document currently owns browser-window focus.
			 * @return Whether focused progress may advance in the current browser window.
			 * @since 0.1.0 Initial implementation.
			 */
			isWindowFocused(): boolean {
				return document.hasFocus();
			},
		};

		interruptionController = createInterruptionPageController( {
			clock: { now: getCurrentEpochMilliseconds },
			documentTarget: document,
			motionPreference: preferencesController,
			onPresentationStateChange: refreshWellbeingSummary,
			runtime: { sendMessage: sendInterruptionPageRequest },
			scheduler: window,
			screen: interruptionScreen,
			visibility,
			windowTarget: window,
		} );
		layerController = createProtectedPageLayerController( {
			clock: { now: getCurrentEpochMilliseconds },
			interruptionController,
			reconcileAllowanceExpiry,
			scheduler: window,
			view: layer,
		} );
		const activeLayerController = layerController;

		/**
		 * Routes one protected-page command through the local presentation controller.
		 * @param input - Unknown extension message payload.
		 * @param sender - Browser-provided sender details.
		 * @param sendResponse - Browser response callback.
		 * @return True while the asynchronous response remains pending.
		 * @since 0.1.0 Initial implementation.
		 */
		function handleProtectedPageMessage(
			input: unknown,
			sender: unknown,
			sendResponse: ( response?: unknown ) => void,
		): true {
			void sender;
			if ( ! layer.isConnected ) {
				document.documentElement.append( layer );
			}
			void activeLayerController.handleMessage( input )
				.then( ( response ) => {
					sendResponse( response );
				} )
				.catch( () => {
					sendResponse();
				} );

			return true;
		}

		layer.style.removeProperty( 'visibility' );
		browser.runtime.onMessage.addListener( handleProtectedPageMessage );
	} catch ( error ) {
		layerController?.stop();
		interruptionController?.stop();
		wellbeingSummaryController?.stop();
		if ( preferencesController !== null && languageChangeListener !== null ) {
			preferencesController.removeLanguageChangeListener( languageChangeListener );
		}
		preferencesController?.stop();
		layer.connectionGuardEnabled = false;
		layer.remove();
		throw error;
	}
}

/**
 * Mounts one isolated warning and interruption layer in an authorized protected document.
 * @return Shared isolated-world initialization promise.
 * @since 0.1.0 Initial implementation.
 */
function mountProtectedPageLayer(): Promise<void> {
	const existingInitialization = getProtectedPageInitialization();

	if ( existingInitialization !== null ) {
		return existingInitialization;
	}

	const initialization = initializeProtectedPageLayer();

	Reflect.set( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY, initialization );
	void initialization.catch( () => {
		Reflect.deleteProperty( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY );
	} );

	return initialization;
}

/**
 * Defines the unlisted protected-page script mounted on demand by the background runtime.
 * @since 0.1.0 Initial implementation.
 */
export default defineUnlistedScript( { main: mountProtectedPageLayer } );
