/**
 * Localized copy for the compact browser download action.
 * @since 0.1.0
 */
export interface DownloadLinkProps {
	label: string;
}

/**
 * Localized copy for a primary download badge and alternate browser links.
 * @since 0.1.0
 */
export interface DownloadLinksProps extends DownloadLinkProps {
	alsoAvailable: string;
}
