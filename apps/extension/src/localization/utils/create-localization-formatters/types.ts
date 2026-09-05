/**
 * Reusable locale-sensitive ECMA-402 formatters for one localization bundle.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationFormatters {
	number: Intl.NumberFormat;
	list: Intl.ListFormat;
	collator: Intl.Collator;
}
