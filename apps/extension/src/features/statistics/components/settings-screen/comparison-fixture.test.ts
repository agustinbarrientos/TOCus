import { describe, expect, it } from 'vitest';
import { createStatisticsComparisonFixture } from './__fixtures__/comparison';

describe( 'Statistics comparison visual fixture', () => {
	it( 'provides valid aggregates whose daily counts match the website and hour marginals', () => {
		const fixture = createStatisticsComparisonFixture();
		expect( fixture.dailyTotals ).toHaveLength( 14 );
		for ( const day of fixture.dailyTotals ) {
			const sites = fixture.visitOutcomes?.dailySites.filter( ( item ) => item.date === day.date ) ?? [];
			const hours = fixture.visitOutcomes?.dailyHours.filter( ( item ) => item.date === day.date ) ?? [];
			expect( sites.reduce( ( total, site ) => total + site.reconsideredVisitCount, 0 ) )
				.toBe( day.reconsideredVisitCount );
			expect( hours.reduce( ( total, hour ) => total + hour.reconsideredVisitCount, 0 ) )
				.toBe( day.reconsideredVisitCount );
		}
	} );
} );
