/**
 * Localized messages displayed by the About settings screen.
 * @since 0.1.0 Initial implementation.
 */
export interface AboutScreenCopy {
	eyebrow: string;
	summary: string;
	linksTitle: string;
	linksDescription: string;
	sourceCode: string;
	license: string;
	contribute: string;
	externalLinksHint: string;
	/**
	 * Formats the installed extension version.
	 * @param version - Version supplied by the browser manifest.
	 * @return Localized version label.
	 * @since 0.1.0 Initial implementation.
	 */
	formatVersion( version: string ): string;
}
