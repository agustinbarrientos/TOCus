import type { WebsiteCatalog } from '../../localization/types';

/**
 * Localized captions and scroll state for the single browser illustration.
 * @since 0.1.0
 */
export interface ProductStoryProps {
	catalog: Readonly<WebsiteCatalog>;
	enhanced: boolean;
}
