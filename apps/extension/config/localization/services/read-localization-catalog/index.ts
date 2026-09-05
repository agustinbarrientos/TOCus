import { readFile } from 'node:fs/promises';
import { type CatalogType } from '@lingui/cli/api';
import { formatter } from '@lingui/format-po';

/**
 * PO formatter used to read canonical extension localization catalogs.
 * @since 0.1.0 Initial implementation.
 */
const PoFormatter = formatter( {
	foldLength: 0,
	lineNumbers: false,
} );

/**
 * Reads one canonical extension PO catalog.
 * @param locale - Canonical Lingui locale filename.
 * @return Parsed translator catalog.
 * @since 0.1.0 Initial implementation.
 */
export async function readLocalizationCatalog( locale: string ): Promise<CatalogType> {
	const catalogUrl = new URL( `../../../../locales/${ locale }.po`, import.meta.url );

	return PoFormatter.parse( await readFile( catalogUrl, 'utf8' ), {
		filename: catalogUrl.pathname,
		locale,
		sourceLocale: 'en',
	} );
}

export { type LocalizationCatalogReader } from './types.ts';
