import type { WebsiteLanguage } from '../../localization/types';

/**
 * Localized social-preview content shared by every static page.
 * @since 1.0.0
 */
export interface SocialMetadataProperties {
	language: WebsiteLanguage;
	title: string;
	description: string;
	imageAlt: string;
}
