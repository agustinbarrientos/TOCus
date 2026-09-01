import { z } from 'zod';
import { EpochMillisecondsSchema } from '../../types/protection-value';

const FixedOffsetTimeZonePattern = /^[+-]/;
const MaximumDateEpochMilliseconds = 8_640_000_000_000_000;

/**
 * Validates a non-negative whole epoch instant representable by Date.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleInstantSchema = EpochMillisecondsSchema.max( MaximumDateEpochMilliseconds );

/**
 * Non-negative whole epoch instant representable by Date.
 * @since 0.1.0 Initial implementation.
 */
export type ScheduleInstant = z.infer<typeof ScheduleInstantSchema>;

/**
 * Validates a nonempty named time-zone input rather than a numeric offset.
 * @since 0.1.0 Initial implementation.
 */
export const TimeZoneInputSchema = z
	.string()
	.trim()
	.min( 1 )
	.refine( ( value ) => ! FixedOffsetTimeZonePattern.test( value ) );

/**
 * Nonempty named time-zone input rather than a numeric offset.
 * @since 0.1.0 Initial implementation.
 */
export type TimeZoneInput = z.infer<typeof TimeZoneInputSchema>;

/**
 * Locale used for deterministic schedule wall-clock extraction.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleFormatterLocale = 'en-US-u-ca-iso8601-nu-latn';

/**
 * Formatter options used for deterministic schedule wall-clock extraction.
 * @since 0.1.0 Initial implementation.
 */
export const ScheduleFormatterOptions = {
	calendar: 'iso8601',
	numberingSystem: 'latn',
	weekday: 'long',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
} as const;

/**
 * Validates and parses an h23 hour emitted with Latin digits.
 * @since 0.1.0 Initial implementation.
 */
export const FormattedScheduleHourSchema = z
	.string()
	.regex( /^(?:[01]\d|2[0-3])$/ )
	.transform( Number );

/**
 * Parsed h23 hour emitted with Latin digits.
 * @since 0.1.0 Initial implementation.
 */
export type FormattedScheduleHour = z.infer<typeof FormattedScheduleHourSchema>;

/**
 * Validates and parses a two-digit minute emitted with Latin digits.
 * @since 0.1.0 Initial implementation.
 */
export const FormattedScheduleMinuteSchema = z
	.string()
	.regex( /^[0-5]\d$/ )
	.transform( Number );

/**
 * Parsed two-digit minute emitted with Latin digits.
 * @since 0.1.0 Initial implementation.
 */
export type FormattedScheduleMinute = z.infer<typeof FormattedScheduleMinuteSchema>;
