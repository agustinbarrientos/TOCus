import type { WebsiteLanguage } from '../../localization/types';

/**
 * Localized copy for a primary download badge and alternate browser links.
 * @since 1.0.0
 */
export interface DownloadLinksProps {
	language: WebsiteLanguage;
	label: string;
	comingSoon: string;
	alsoAvailable: string;
}
