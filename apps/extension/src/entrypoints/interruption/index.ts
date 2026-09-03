import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { createPreferencesStorageService } from '../../domains/preferences/services';
import { ComponentInterruptionScreen } from '../../features/interruption/components/screen';
import {
	createInterruptionPageController,
	type InterruptionPageClock,
	type InterruptionPageRuntime,
	type InterruptionPageVisibility,
} from '../../features/interruption/services/interruption-page-controller';
import { type InterruptionPageRequest } from '../../features/protection-runtime/types/runtime-message';
import { createPreferencesController } from '../../features/preferences/services/preferences-controller';
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

const interruptionScreenCandidate = document.querySelector( 'tocus-f-interruption-screen' );

if ( ! ( interruptionScreenCandidate instanceof ComponentInterruptionScreen ) ) {
	throw new TypeError( 'Expected the interruption page to contain the interruption screen.' );
}

const interruptionScreen = interruptionScreenCandidate;

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
const preferencesController = createPreferencesController( {
	appearanceTarget: document.documentElement,
	presentation: interruptionScreen,
	storage: preferencesStorage,
	storageChanges: browser.storage.onChanged,
	systemMotionPreference: motionPreference,
} );

/**
 * Applies local preferences before connecting interruption behavior.
 * @return Promise resolved after preference and interruption startup.
 * @since 0.1.0 Initial implementation.
 */
async function startInterruptionPage(): Promise<void> {
	await preferencesController.start();
	const controller = createInterruptionPageController( {
		clock,
		documentTarget: document,
		motionPreference: preferencesController,
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
