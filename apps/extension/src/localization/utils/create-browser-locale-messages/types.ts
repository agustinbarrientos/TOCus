/**
 * One browser-managed message in WebExtension localization-file format.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserLocaleMessage {
	message: string;
	description: string;
}

/**
 * Browser-managed extension metadata messages for one locale.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserLocaleMessages {
	extensionName: BrowserLocaleMessage;
	extensionDescription: BrowserLocaleMessage;
}
