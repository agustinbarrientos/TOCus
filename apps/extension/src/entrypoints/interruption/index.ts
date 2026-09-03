import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { ComponentInterruptionScreen } from '../../features/interruption/components/screen';
import {
	createInterruptionPageController,
	type InterruptionPageClock,
	type InterruptionPageRuntime,
	type InterruptionPageVisibility,
} from '../../features/interruption/services/interruption-page-controller';
import { type InterruptionPageRequest } from '../../features/protection-runtime/types/runtime-message';
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

const interruptionScreen = document.querySelector( 'tocus-f-interruption-screen' );

if ( ! ( interruptionScreen instanceof ComponentInterruptionScreen ) ) {
	throw new TypeError( 'Expected the interruption page to contain the interruption screen.' );
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
const controller = createInterruptionPageController( {
	clock,
	documentTarget: document,
	motionPreference,
	runtime,
	scheduler: window,
	screen: interruptionScreen,
	visibility,
	windowTarget: window,
} );

void controller.start();
