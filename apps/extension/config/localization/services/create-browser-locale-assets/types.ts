import type { GeneratedPublicFile } from 'wxt';
import type { LocalizationCatalogReader } from '../read-localization-catalog/types.ts';

/**
 * Dependencies used to create browser-managed localization assets.
 * @since 1.0.0 Initial implementation.
 */
export interface CreateBrowserLocaleAssetsOptions {
	readCatalog: LocalizationCatalogReader;
}

/**
 * Browser-managed localization asset generated from one canonical PO catalog.
 * @since 1.0.0 Initial implementation.
 */
export type BrowserLocaleAsset = GeneratedPublicFile;
