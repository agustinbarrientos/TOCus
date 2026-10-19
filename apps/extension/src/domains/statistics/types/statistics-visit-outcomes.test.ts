import { describe, expect, it } from 'vitest';
import { StatisticsVisitOutcomesSchema } from './statistics-visit-outcomes';
import { StatisticsDocumentSchema } from './statistics-document';
import { createMockStatisticsDocument } from './__fixtures__/statistics-document';

/** Valid aggregate-only detail with matching reconsideration marginals. */
const outcomes = {
	recordedFromDate: '2026-10-17',
	dailySites: [ { date: '2026-10-18', siteHost: 'youtube.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 1 } ],
	dailyHours: [ { date: '2026-10-18', hour: 14, reconsideredVisitCount: 2 } ],
};

describe( 'StatisticsVisitOutcomesSchema', () => {
	it( 'retains empty coverage and matching aggregate marginals', () => {
		expect( StatisticsVisitOutcomesSchema.parse( outcomes ) ).toEqual( outcomes );
		expect( StatisticsVisitOutcomesSchema.parse( { ...outcomes, dailySites: [], dailyHours: [] } ) ).toEqual( {
			...outcomes, dailySites: [], dailyHours: [],
		} );
	} );

	it.each( [
		{ dailySites: [ { ...outcomes.dailySites[ 0 ], siteHost: 'https://youtube.com/watch' } ] },
		{ dailySites: [ { ...outcomes.dailySites[ 0 ], date: '2026-10-16' } ] },
		{ dailySites: [ ...outcomes.dailySites, ...outcomes.dailySites ] },
		{ dailyHours: [ ...outcomes.dailyHours, ...outcomes.dailyHours ] },
		{ dailyHours: [ { ...outcomes.dailyHours[ 0 ], hour: 24 } ] },
		{ dailyHours: [ { ...outcomes.dailyHours[ 0 ], hour: -1 } ] },
		{ dailyHours: [ { ...outcomes.dailyHours[ 0 ], hour: 2.5 } ] },
		{ dailyHours: [ { ...outcomes.dailyHours[ 0 ], reconsideredVisitCount: 1 } ] },
		{ dailyHours: [ { ...outcomes.dailyHours[ 0 ], date: '2026-10-16' } ] },
		{ dailySites: [ { ...outcomes.dailySites[ 0 ], reconsideredVisitCount: -1 } ] },
		{ dailySites: [ { ...outcomes.dailySites[ 0 ], reconsideredVisitCount: Number.MAX_SAFE_INTEGER + 1 } ] },
		{ events: [] },
	] )( 'rejects unsafe, duplicate or inconsistent aggregates %#', ( change ) => {
		expect( StatisticsVisitOutcomesSchema.safeParse( { ...outcomes, ...change } ).success ).toBe( false );
	} );

	it( 'rejects unordered site and hour buckets', () => {
		expect( StatisticsVisitOutcomesSchema.safeParse( {
			...outcomes,
			dailySites: [ { ...outcomes.dailySites[ 0 ], siteHost: 'z.com' }, ...outcomes.dailySites ],
		} ).success ).toBe( false );
		expect( StatisticsVisitOutcomesSchema.safeParse( {
			...outcomes,
			dailyHours: [ { ...outcomes.dailyHours[ 0 ], hour: 15 }, ...outcomes.dailyHours ],
		} ).success ).toBe( false );
	} );

	it( 'rejects overflow across distinct website and hourly aggregates', () => {
		expect( StatisticsVisitOutcomesSchema.safeParse( {
			...outcomes,
			dailySites: [
				{ ...outcomes.dailySites[ 0 ], siteHost: 'a.com', reconsideredVisitCount: Number.MAX_SAFE_INTEGER },
				{ ...outcomes.dailySites[ 0 ], siteHost: 'b.com' },
			],
		} ).success ).toBe( false );
		expect( StatisticsVisitOutcomesSchema.safeParse( {
			...outcomes,
			dailyHours: [
				{ ...outcomes.dailyHours[ 0 ], hour: 1, reconsideredVisitCount: Number.MAX_SAFE_INTEGER },
				{ ...outcomes.dailyHours[ 0 ], hour: 2 },
			],
		} ).success ).toBe( false );
	} );

	it( 'accepts continued-only days and rejects hourly counts without matching websites', () => {
		expect( StatisticsVisitOutcomesSchema.safeParse( {
			...outcomes, dailySites: [ { ...outcomes.dailySites[ 0 ], reconsideredVisitCount: 0 } ], dailyHours: [],
		} ).success ).toBe( true );
		expect( StatisticsVisitOutcomesSchema.safeParse( { ...outcomes, dailySites: [] } ).success ).toBe( false );
	} );

	it.each( [ 'reconsideredVisitCount', 'visitedAfterPauseCount' ] )( 'rejects cross-date %s overflow before import', ( metric ) => {
		const dailySites = [ '2026-10-17', '2026-10-18' ].map( ( date, index ) => ( {
			date, siteHost: 'youtube.com', reconsideredVisitCount: 0, visitedAfterPauseCount: 0,
			[ metric ]: index === 0 ? Number.MAX_SAFE_INTEGER : 1,
		} ) );
		const dailyHours = metric === 'reconsideredVisitCount' ? dailySites.map( ( site ) => ( {
			date: site.date, hour: 14, reconsideredVisitCount: site.reconsideredVisitCount,
		} ) ) : [];
		const result = StatisticsVisitOutcomesSchema.safeParse( { ...outcomes, dailySites, dailyHours } );
		expect( result.success ).toBe( false );
	} );

	it( 'keeps legacy documents unchanged and accepts optional aggregates', () => {
		const legacy = createMockStatisticsDocument();
		expect( StatisticsDocumentSchema.parse( legacy ) ).toEqual( legacy );
		expect( Object.hasOwn( StatisticsDocumentSchema.parse( legacy ), 'visitOutcomes' ) ).toBe( false );
		const updated = StatisticsDocumentSchema.parse( { ...legacy, visitOutcomes: outcomes } );
		expect( updated.visitOutcomes ).toEqual( outcomes );
	} );
} );
