import type { WebsiteLocalization } from '../../localization/types';

/**
 * The home page language whose copy the structured data uses.
 */
export interface StructuredDataProperties {
	localization: Readonly<WebsiteLocalization>;
}
