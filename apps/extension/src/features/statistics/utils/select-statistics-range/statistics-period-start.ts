import { LocalDateSchema, type LocalDate } from '../../../../domains/protection/types/protection-value';
import { shiftStatisticsDate } from '../../../../domains/statistics/utils/statistics-calendar-date';
import { StatisticsRange, type ComparableStatisticsRange } from './types';

/**
 * Finds the first day of a finite calendar period using date-only arithmetic.
 * @param currentDate - Authoritative local endpoint.
 * @param range - Selected week, month or year.
 * @return Inclusive first date of the selected period.
 * @since 1.1.0
 */
export function statisticsPeriodStart( currentDate: LocalDate, range: ComparableStatisticsRange ): LocalDate {
	if ( range === StatisticsRange.CURRENT_MONTH ) {
		return LocalDateSchema.parse( `${ currentDate.slice( 0, 7 ) }-01` );
	}
	if ( range === StatisticsRange.CURRENT_YEAR ) {
		return LocalDateSchema.parse( `${ currentDate.slice( 0, 4 ) }-01-01` );
	}
	const weekday = new Date( `${ currentDate }T00:00:00Z` ).getUTCDay();
	return shiftStatisticsDate( currentDate, -( ( weekday + 6 ) % 7 ) );
}
