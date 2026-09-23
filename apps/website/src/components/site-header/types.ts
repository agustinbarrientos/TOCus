import type { LocalizedHomePageProperties } from '../../localization';

/**
 * Localized navigation, hydration readiness and optional hero overlay placement.
 * @since 1.0.0
 */
export interface SiteHeaderProps extends LocalizedHomePageProperties {
	enhanced: boolean;
	overlayHero?: boolean;
}
