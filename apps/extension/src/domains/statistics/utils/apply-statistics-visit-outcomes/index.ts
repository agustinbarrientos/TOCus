import { ProtectionFactType } from '../../../protection/types/protection-fact';
import type { ProtectionFactBatch } from '../../../protection/types/protection-fact-batch';
import type { StatisticsVisitOutcomes } from '../../types/statistics-visit-outcomes';
import { addStatisticsValues } from '../add-statistics-values';

/**
 * Adds attributed outcomes to aggregate marginals, retaining captured local buckets.
 * @param current - Existing detail, absent for legacy documents.
 * @param batch - Accepted durable FIFO head with its original calendar date.
 * @return Updated marginals, or absent when the batch contains only legacy facts.
 * @since 1.1.0
 */
export function applyStatisticsVisitOutcomes(
	current: StatisticsVisitOutcomes | undefined,
	batch: ProtectionFactBatch,
): StatisticsVisitOutcomes | undefined {
	let outcomes = current;
	const date = batch.observedLocalDate;

	for ( const fact of batch.facts ) {
		if ( fact.type !== ProtectionFactType.RECONSIDERED_VISIT && fact.type !== ProtectionFactType.CONTINUED_VISIT ) {
			continue;
		}
		if ( fact.siteHost === undefined || fact.observedLocalHour === undefined ) {
			continue;
		}

		const previous = outcomes ?? { recordedFromDate: date, dailySites: [], dailyHours: [] };
		const dailySites = [ ...previous.dailySites ];
		const index = dailySites.findIndex( ( day ) => day.date === date && day.siteHost === fact.siteHost );
		const site = dailySites[ index ] ?? {
			date, siteHost: fact.siteHost, reconsideredVisitCount: 0, visitedAfterPauseCount: 0,
		};
		const reconsidered = fact.type === ProtectionFactType.RECONSIDERED_VISIT;
		const updated = {
			...site,
			reconsideredVisitCount: addStatisticsValues( site.reconsideredVisitCount, Number( reconsidered ) ),
			visitedAfterPauseCount: addStatisticsValues( site.visitedAfterPauseCount, Number( ! reconsidered ) ),
		};
		if ( index < 0 ) {
			dailySites.push( updated );
		} else {
			dailySites[ index ] = updated;
		}
		dailySites.sort( ( left, right ) => {
			const a = `${ left.date }|${ left.siteHost }`;
			const b = `${ right.date }|${ right.siteHost }`;
			return Number( a > b ) - Number( a < b );
		} );

		const dailyHours = [ ...previous.dailyHours ];
		if ( reconsidered ) {
			const hourIndex = dailyHours.findIndex(
				( day ) => day.date === date && day.hour === fact.observedLocalHour,
			);
			const hour = dailyHours[ hourIndex ] ?? { date, hour: fact.observedLocalHour, reconsideredVisitCount: 0 };
			const updatedHour = {
				...hour, reconsideredVisitCount: addStatisticsValues( hour.reconsideredVisitCount, 1 ),
			};
			if ( hourIndex < 0 ) {
				dailyHours.push( updatedHour );
			} else {
				dailyHours[ hourIndex ] = updatedHour;
			}
			dailyHours.sort( ( left, right ) => left.date.localeCompare( right.date ) || left.hour - right.hour );
		}

		outcomes = {
			recordedFromDate: date < previous.recordedFromDate ? date : previous.recordedFromDate,
			dailySites,
			dailyHours,
		};
	}

	return outcomes;
}
