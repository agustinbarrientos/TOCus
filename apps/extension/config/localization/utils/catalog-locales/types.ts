import { type Language } from '../../../../src/domains/preferences/types.ts';

/**
 * One canonical extension PO catalog and its runtime projections.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionCatalog {
	language: Language;
	locale: string;
	browserLocales: ReadonlyArray<string>;
}
