declare module '*.po' {
	import { type Messages } from '@lingui/core';

	/**
	 * Compiled Lingui messages exported by the Vite catalog loader.
	 * @since 0.1.0 Initial implementation.
	 */
	export const messages: Messages;
}
