import { describe, expect, it } from 'vitest';
import { selectSampleDays } from '../sample-statistics';
import { SamplePeriod } from '../../types';
import { createSampleChartBuckets } from './index';

describe( 'sample chart calendar intervals', () => {
	it( 'combines long histories into bounded intervals without dropping the last day', () => {
		const buckets = createSampleChartBuckets( selectSampleDays( SamplePeriod.ALL ) );
		expect( buckets ).toHaveLength( 31 );
		expect( buckets[ 0 ] ).toMatchObject( {
			date: '2026-06-01', endDate: '2026-06-02', estimatedReclaimedMilliseconds: 2_830_000,
		} );
		expect( buckets.at( -1 ) ).toMatchObject( { date: '2026-07-31', endDate: '2026-07-31' } );
	} );
	it( 'keeps daily intervals for the current month including zero activity', () => {
		const buckets = createSampleChartBuckets( selectSampleDays( SamplePeriod.CURRENT_MONTH ) );
		expect( buckets ).toHaveLength( 31 );
		expect( buckets[ 4 ] ).toMatchObject( {
			date: '2026-07-05', endDate: '2026-07-05', estimatedReclaimedMilliseconds: 0,
		} );
		expect( createSampleChartBuckets( [] ) ).toEqual( [] );
	} );
} );
