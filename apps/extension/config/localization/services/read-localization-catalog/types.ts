import { type CatalogType } from '@lingui/cli/api';

/**
 * Reads one canonical extension localization catalog.
 * @since 0.1.0 Initial implementation.
 */
export type LocalizationCatalogReader = ( locale: string ) => Promise<CatalogType>;
