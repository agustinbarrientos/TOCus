import { z } from 'zod';
import { CanonicalHostSchema } from '../../protection/types/protected-site-rule';
import { LocalDateSchema } from '../../protection/types/protection-value';
import { StatisticsNonNegativeSafeIntegerSchema } from './statistics-value';

/**
 * Validates one configured website's aggregate outcomes on a local date.
 * @since 1.1.0
 */
export const DailySiteVisitOutcomesSchema = z.object( {
	date: LocalDateSchema,
	siteHost: CanonicalHostSchema,
	reconsideredVisitCount: StatisticsNonNegativeSafeIntegerSchema,
	visitedAfterPauseCount: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * One configured website's aggregate visit outcomes on a local date.
 * @since 1.1.0
 */
export type DailySiteVisitOutcomes = z.infer<typeof DailySiteVisitOutcomesSchema>;

/**
 * Validates aggregate reconsiderations in one captured local-hour bucket.
 * @since 1.1.0
 */
export const DailyHourlyReconsiderationsSchema = z.object( {
	date: LocalDateSchema,
	hour: z.number().int().min( 0 ).max( 23 ),
	reconsideredVisitCount: StatisticsNonNegativeSafeIntegerSchema,
} ).strict();

/**
 * Aggregate reconsiderations in one captured local-hour bucket.
 * @since 1.1.0
 */
export type DailyHourlyReconsiderations = z.infer<typeof DailyHourlyReconsiderationsSchema>;

/**
 * Validates the shape of aggregate website and hourly coverage.
 * @since 1.1.0
 */
const StatisticsVisitOutcomesFieldsSchema = z.object( {
	recordedFromDate: LocalDateSchema,
	dailySites: z.array( DailySiteVisitOutcomesSchema ),
	dailyHours: z.array( DailyHourlyReconsiderationsSchema ),
} ).strict();

/**
 * Parsed aggregate marginals before their consistency validation.
 * @since 1.1.0
 */
type StatisticsVisitOutcomesFields = z.infer<typeof StatisticsVisitOutcomesFieldsSchema>;

/**
 * Validates ordered, unique buckets and equal reconsideration marginals.
 * @param outcomes - Parsed aggregate marginals and their coverage date.
 * @return Whether both collections describe the same safe reconsideration totals.
 * @since 1.1.0
 */
function hasConsistentOutcomes( outcomes: StatisticsVisitOutcomesFields ): boolean {
	const siteCounts = new Map<string, number>();
	const hourCounts = new Map<string, number>();
	let previousSite = '';
	let previousHour = '';
	let reconsideredTotal = 0;
	let continuedTotal = 0;

	for ( const day of outcomes.dailySites ) {
		const key = `${ day.date }|${ day.siteHost }`;
		if ( day.date < outcomes.recordedFromDate || key <= previousSite ) {
			return false;
		}
		previousSite = key;
		const count = ( siteCounts.get( day.date ) ?? 0 ) + day.reconsideredVisitCount;
		if ( ! Number.isSafeInteger( count ) ) {
			return false;
		}
		siteCounts.set( day.date, count );
		reconsideredTotal += day.reconsideredVisitCount;
		continuedTotal += day.visitedAfterPauseCount;
	}
	if ( ! Number.isSafeInteger( reconsideredTotal ) || ! Number.isSafeInteger( continuedTotal ) ) {
		return false;
	}

	for ( const day of outcomes.dailyHours ) {
		const key = `${ day.date }|${ String( day.hour ).padStart( 2, '0' ) }`;
		if ( day.date < outcomes.recordedFromDate || key <= previousHour ) {
			return false;
		}
		previousHour = key;
		const count = ( hourCounts.get( day.date ) ?? 0 ) + day.reconsideredVisitCount;
		if ( ! Number.isSafeInteger( count ) ) {
			return false;
		}
		hourCounts.set( day.date, count );
	}

	return [ ...new Set( [ ...siteCounts.keys(), ...hourCounts.keys() ] ) ].every(
		( date ) => ( siteCounts.get( date ) ?? 0 ) === ( hourCounts.get( date ) ?? 0 ),
	);
}

/**
 * Aggregate-only website and local-hour history, absent from older documents.
 * @since 1.1.0
 */
export const StatisticsVisitOutcomesSchema = StatisticsVisitOutcomesFieldsSchema.refine( hasConsistentOutcomes, {
	message: 'Visit outcomes must be ordered, unique, within coverage and internally consistent.',
} );

/**
 * Local aggregate marginals without per-visit timestamps, destinations or event logs.
 * @since 1.1.0
 */
export type StatisticsVisitOutcomes = z.infer<typeof StatisticsVisitOutcomesSchema>;
