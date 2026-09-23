import { LocalDateSchema, type LocalDate } from '../../../protection/types/protection-value';

/**
 * Shifts a calendar date without treating daylight-saving days as fixed local intervals.
 * @param date - Valid local date, represented without a time zone.
 * @param days - Whole calendar days to add or subtract.
 * @return Shifted valid local date.
 * @since 1.0.0 Initial implementation.
 */
export function shiftStatisticsDate( date: LocalDate, days: number ): LocalDate {
	const calendar = new Date( `${ date }T00:00:00.000Z` );
	calendar.setUTCDate( calendar.getUTCDate() + days );

	return LocalDateSchema.parse( calendar.toISOString().slice( 0, 10 ) );
}
