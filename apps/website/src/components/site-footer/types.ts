import type { LocalizedHomePageProperties } from '../../localization';

/**
 * Localized footer content and availability of the interactive language menu.
 * @since 1.0.0
 */
export interface SiteFooterProps extends LocalizedHomePageProperties {
	enhanced: boolean;
}
