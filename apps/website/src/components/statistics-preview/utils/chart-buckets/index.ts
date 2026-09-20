import type { SampleDay } from '../../types';
import type { SampleChartBucket } from './types';
import { summarizeSampleDays } from '../sample-statistics';

/**
 * Groups recorded days into at most sixty chart intervals.
 * @param days - Chronological complete calendar records.
 * @return Calendar intervals retaining every recorded metric.
 * @since 0.1.0
 */
export function createSampleChartBuckets( days: readonly SampleDay[] ): SampleChartBucket[] {
	const intervalDays = Math.max( 1, Math.ceil( days.length / 60 ) );
	const buckets: SampleChartBucket[] = [];
	for ( let index = 0; index < days.length; index += intervalDays ) {
		const interval = days.slice( index, index + intervalDays );
		const first = interval[ 0 ];
		const last = interval.at( -1 );
		if ( first && last ) {
			buckets.push( { date: first.date, endDate: last.date, ...summarizeSampleDays( interval ) } );
		}
	}
	return buckets;
}
