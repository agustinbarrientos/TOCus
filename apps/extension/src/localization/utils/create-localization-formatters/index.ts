import { type LocalizationFormatters } from './types';

/**
 * Creates reusable ECMA-402 formatters for one selected language.
 * @param languageTag - Valid BCP-47 language tag.
 * @return Locale-sensitive number, unit-list, and collation formatters.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizationFormatters( languageTag: string ): LocalizationFormatters {
	return {
		number: new Intl.NumberFormat( languageTag ),
		list: new Intl.ListFormat( languageTag, { style: 'long', type: 'unit' } ),
		collator: new Intl.Collator( languageTag ),
	};
}

export { type LocalizationFormatters } from './types';
