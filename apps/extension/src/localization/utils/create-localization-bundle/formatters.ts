import {
	type DurationUnitMessageCatalog,
	type PluralMessageCatalog,
} from '../../catalogs/types';
import {
	type LocalizationFormatters,
	type TemplateVariables,
} from './types';

/**
 * Milliseconds contained in one second.
 * @since 0.1.0 Initial implementation.
 */
export const MILLISECONDS_PER_SECOND = 1_000;

/**
 * Milliseconds contained in one minute.
 * @since 0.1.0 Initial implementation.
 */
export const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Minutes contained in one hour.
 * @since 0.1.0 Initial implementation.
 */
const MINUTES_PER_HOUR = 60;

/**
 * Named-placeholder syntax supported by translator catalogs.
 * @since 0.1.0 Initial implementation.
 */
const MESSAGE_PLACEHOLDER_PATTERN = /\{([a-z][a-zA-Z0-9]*)\}/gu;

/**
 * Substitutes named localized values into one complete message template.
 * @param template - Translator-authored complete message template.
 * @param variables - Localized values indexed by placeholder name.
 * @return Complete localized message.
 * @throws {RangeError} When the template requests an unavailable placeholder.
 * @since 0.1.0 Initial implementation.
 */
export function formatMessage( template: string, variables: TemplateVariables ): string {
	return template.replace( MESSAGE_PLACEHOLDER_PATTERN, ( placeholder, name: string ) => {
		const replacement = variables[ name ];

		if ( replacement === undefined ) {
			throw new RangeError( `No localized value was provided for ${ placeholder }.` );
		}

		return replacement;
	} );
}

/**
 * Creates reusable ECMA-402 formatters for one selected language.
 * @param languageTag - Valid BCP-47 language tag.
 * @return Locale-sensitive number, plural, unit-list, and collation formatters.
 * @since 0.1.0 Initial implementation.
 */
export function createFormatters( languageTag: string ): LocalizationFormatters {
	return {
		number: new Intl.NumberFormat( languageTag ),
		plural: new Intl.PluralRules( languageTag ),
		list: new Intl.ListFormat( languageTag, { style: 'long', type: 'unit' } ),
		collator: new Intl.Collator( languageTag ),
	};
}

/**
 * Formats one count with the selected plural message and number system.
 * @param count - Numeric value whose cardinal category selects the message.
 * @param messages - Complete plural-category templates.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized count message.
 * @since 0.1.0 Initial implementation.
 */
export function formatPluralMessage(
	count: number,
	messages: PluralMessageCatalog,
	formatters: LocalizationFormatters,
): string {
	const category = formatters.plural.select( count );

	return formatMessage( messages[ category ], { count: formatters.number.format( count ) } );
}

/**
 * Formats one localized duration unit.
 * @param count - Whole unit count.
 * @param unit - Unit catalog whose plural form should be selected.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Localized duration unit.
 * @since 0.1.0 Initial implementation.
 */
export function formatDurationUnit(
	count: number,
	unit: PluralMessageCatalog,
	formatters: LocalizationFormatters,
): string {
	return formatPluralMessage( count, unit, formatters );
}

/**
 * Formats a rounded whole-minute duration as minutes or hours and minutes.
 * @param totalMinutes - Nonnegative rounded whole minutes.
 * @param units - Localized duration-unit messages.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Localized duration.
 * @since 0.1.0 Initial implementation.
 */
export function formatMinuteDuration(
	totalMinutes: number,
	units: DurationUnitMessageCatalog,
	formatters: LocalizationFormatters,
): string {
	if ( totalMinutes < MINUTES_PER_HOUR ) {
		return formatDurationUnit( totalMinutes, units.minute, formatters );
	}

	const hours = Math.floor( totalMinutes / MINUTES_PER_HOUR );
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	const hoursLabel = formatDurationUnit( hours, units.hour, formatters );

	if ( minutes === 0 ) {
		return hoursLabel;
	}

	return formatters.list.format( [
		hoursLabel,
		formatDurationUnit( minutes, units.minute, formatters ),
	] );
}
