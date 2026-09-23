
/**
 * Localized messages displayed by the About settings screen.
 * @since 1.0.0 Initial implementation.
 */
export interface AboutScreenCopy {
	title: string;
	storyTitle: string;
	creator: string;
	summary: string;
	privacyTitle: string;
	privacyDescription: string;
	linksTitle: string;
	linksDescription: string;
	forkDescription: string;
	sourceCode: string;
	suggestChanges: string;
	license: string;
	contribute: string;
	fork: string;
	externalLinksHint: string;
	/**
	 * Formats the installed extension version.
	 * @param version - Version supplied by the browser manifest.
	 * @return Localized version label.
	 * @since 1.0.0 Initial implementation.
	 */
	formatVersion( version: string ): string;
}


/**
 * User-opened project resource from the canonical About content.
 * @since 1.0.0
 */
export interface ProjectLinkProps {
	label: string;
	href: string;
}
