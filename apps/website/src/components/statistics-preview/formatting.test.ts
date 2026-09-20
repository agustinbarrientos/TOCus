import { describe, expect, it } from 'vitest';
import { createStatisticsPreviewFormatting } from './formatting';
import { SamplePeriod } from './types';
import { selectSampleDays, summarizeSampleDays } from './data';
import { createSampleChartBuckets } from './utils/chart-buckets';

describe( 'statistics preview formatting', () => {
	it( 'uses simple hyphens for localized date ranges', () => {
		for ( const locale of [ 'en', 'es', 'es-AR', 'pt-BR', 'pt-PT', 'it', 'fr', 'de', 'ja', 'ru' ] ) {
			const formatting = createStatisticsPreviewFormatting( locale );
			expect( JSON.stringify( formatting ) ).not.toMatch( /[\u2013\u2014]/u );
		}
	} );

	it( 'serializes complete past calendar labels and readable durations for hydration', () => {
		const formatting = createStatisticsPreviewFormatting( 'en' );
		expect( Object.keys( formatting.dates ) ).toHaveLength( 61 );
		expect( formatting.dates[ '2026-06-01' ] ).toBe( 'Jun 1, 2026' );
		expect( formatting.dates[ '2026-07-31' ] ).toBe( 'Jul 31, 2026' );
		expect( formatting.durations[ 1_050_000 ] ).toBe( '18 minutes' );
		expect( JSON.parse( JSON.stringify( formatting ) ) ).toEqual( formatting );
	} );
	it( 'serializes every selectable summary and grouped chart interval', () => {
		const formatting = createStatisticsPreviewFormatting( 'en' );
		for ( const period of Object.values( SamplePeriod ) ) {
			const days = selectSampleDays( period );
			const totals = summarizeSampleDays( days );
			expect( formatting.periodRanges[ period ] ).toEqual( expect.stringContaining( '2026' ) );
			expect( formatting.durations[ totals.estimatedReclaimedMilliseconds ] ).toEqual( expect.any( String ) );
			expect( formatting.durations[ totals.focusedPauseMilliseconds ] ).toEqual( expect.any( String ) );
			for ( const bucket of createSampleChartBuckets( days ) ) {
				expect( formatting.dateRanges[ `${ bucket.date }:${ bucket.endDate }` ] ).toEqual( expect.any( String ) );
				expect( formatting.durations[ bucket.estimatedReclaimedMilliseconds ] ).toEqual( expect.any( String ) );
			}
		}
	} );
} );
