/**
 * Localized copy for the compact browser download action.
 * @since 1.0.0
 */
export interface DownloadLinkProps {
	label: string;
	comingSoon: string;
}

/**
 * Localized copy for a primary download badge and alternate browser links.
 * @since 1.0.0
 */
export interface DownloadLinksProps extends DownloadLinkProps {
	alsoAvailable: string;
}
