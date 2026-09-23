/**
 * Sends one asynchronous response through a browser runtime message channel.
 * @since 1.0.0 Initial implementation.
 */
export interface ProtectedPageResponseSender {
	/**
	 * Sends the resolved response or completes the channel without a value.
	 * @param response - Optional protected-page response.
	 * @since 1.0.0 Initial implementation.
	 */
	( response?: unknown ): void;
}
