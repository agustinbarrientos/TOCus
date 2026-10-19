import { LocalDateSchema, type LocalDate } from '../../../../domains/protection/types/protection-value';

const LOCAL_DATE_FORMAT_LOCALE = 'en-US';

/**
 * Captures the outcome's wall-clock hour before queued delivery or timezone changes.
 * @param epochMilliseconds - Outcome observation time.
 * @param timeZone - IANA time zone observed with the outcome.
 * @return Local wall-clock hour from zero through twenty-three.
 * @throws {RangeError} When the time zone or formatted hour is invalid.
 * @since 1.0.0 Initial implementation.
 */
export function createRuntimeLocalHour( epochMilliseconds: number, timeZone: string ): number {
	const hour = new Intl.DateTimeFormat( LOCAL_DATE_FORMAT_LOCALE, {
		hour: '2-digit', hourCycle: 'h23', timeZone,
	} ).formatToParts( new Date( epochMilliseconds ) ).find( ( part ) => part.type === 'hour' )?.value;
	const value = hour === undefined ? NaN : Number( hour );
	if ( ! Number.isInteger( value ) || value < 0 || value > 23 ) {
		throw new RangeError( 'The local calendar hour could not be formatted.' );
	}
	return value;
}

/**
 * Formats one epoch instant as a validated local calendar date.
 * @param epochMilliseconds - Current epoch time.
 * @param timeZone - Current IANA time zone.
 * @return Local date in YYYY-MM-DD form.
 * @throws {RangeError} When the supplied time zone is invalid.
 * @since 1.0.0 Initial implementation.
 */
export function createRuntimeLocalDate( epochMilliseconds: number, timeZone: string ): LocalDate {
	const parts = new Intl.DateTimeFormat( LOCAL_DATE_FORMAT_LOCALE, {
		day: '2-digit',
		month: '2-digit',
		timeZone,
		year: 'numeric',
	} ).formatToParts( new Date( epochMilliseconds ) );
	const year = parts.find( ( part ) => part.type === 'year' )?.value;
	const month = parts.find( ( part ) => part.type === 'month' )?.value;
	const day = parts.find( ( part ) => part.type === 'day' )?.value;

	if ( year === undefined || month === undefined || day === undefined ) {
		throw new RangeError( 'The local calendar date could not be formatted.' );
	}

	return LocalDateSchema.parse( `${ year }-${ month }-${ day }` );
}
