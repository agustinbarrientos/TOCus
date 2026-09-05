import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
	startProtectionBackgroundApplication,
} from '../../features/protection-runtime/services/protection-background-application';

/**
 * Starts the browser-backed background application.
 * @since 0.1.0 Initial implementation.
 */
function startBackground(): void {
	startProtectionBackgroundApplication( { browser } );
}

/**
 * Registers the non-persistent extension background entrypoint.
 * @since 0.1.0 Initial implementation.
 */
export default defineBackground( {
	persistent: false,
	main: startBackground,
} );
