import { describe, expect, it } from 'vitest';
import { createMockStatisticsDocument } from '../../types/__fixtures__';
import { ScopeStatisticsSchema, StatisticsDocumentSchema } from '../../types/statistics-document';
import { projectStatistics } from './index';

describe( 'projectStatistics', () => {
	it( 'returns unavailable for malformed or unsupported persistence', () => {
		expect( projectStatistics( null ) ).toEqual( { status: 'unavailable' } );
		expect( projectStatistics( {
			...createMockStatisticsDocument(),
			schemaVersion: 2,
		} ) ).toEqual( { status: 'unavailable' } );
	} );

	it( 'projects exactly five empty all-time values without inventing an estimate', () => {
		expect( projectStatistics( createMockStatisticsDocument() ) ).toEqual( {
			status: 'available',
			estimatedReclaimedMilliseconds: null,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		} );
	} );

	it.each( [ 0, 120_000 ] )( 'projects numeric zero with a valid %i ms baseline', ( focusedUseMilliseconds ) => {
		const document = createMockStatisticsDocument();

		document.scopes.scope_default = ScopeStatisticsSchema.parse( {
			...document.scopes.scope_default,
			latestBaseline: {
				measurementRevision: 'revision_1',
				focusedUseMilliseconds,
			},
		} );

		expect( projectStatistics( document ) ).toMatchObject( {
			status: 'available',
			estimatedReclaimedMilliseconds: 0,
		} );
	} );

	it( 'sums every per-scope all-time total', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: 1,
						focusedPauseMilliseconds: 2,
						reconsideredVisitCount: 3,
						completedWaitCount: 4,
						allowanceGrantedCount: 5,
					},
					currentMeasurementRevision: 'revision_1',
				},
				scope_historical: {
					totals: {
						estimatedReclaimedMilliseconds: 10,
						focusedPauseMilliseconds: 20,
						reconsideredVisitCount: 30,
						completedWaitCount: 40,
						allowanceGrantedCount: 50,
					},
				},
			},
		} );

		expect( projectStatistics( document ) ).toEqual( {
			status: 'available',
			estimatedReclaimedMilliseconds: 11,
			focusedPauseMilliseconds: 22,
			reconsideredVisitCount: 33,
			completedWaitCount: 44,
			allowanceGrantedCount: 55,
		} );
	} );

	it( 'preserves a positive historical estimate without a current baseline', () => {
		const document = createMockStatisticsDocument();
		const scope = document.scopes.scope_default;

		if ( scope === undefined ) {
			throw new Error( 'Expected a current scope fixture.' );
		}

		document.scopes.scope_default = ScopeStatisticsSchema.parse( {
			totals: {
				...scope.totals,
				estimatedReclaimedMilliseconds: 60_000,
			},
			currentMeasurementRevision: 'revision_2',
		} );

		expect( projectStatistics( document ) ).toMatchObject( {
			status: 'available',
			estimatedReclaimedMilliseconds: 60_000,
		} );
	} );

	it( 'projects known zero from a historical finalized-baseline marker', () => {
		const document = createMockStatisticsDocument();
		const scope = document.scopes.scope_default;

		if ( scope === undefined ) {
			throw new Error( 'Expected a current scope fixture.' );
		}

		document.scopes.scope_default = ScopeStatisticsSchema.parse( {
			totals: scope.totals,
			hasFinalizedBaseline: true,
		} );

		expect( projectStatistics( document ) ).toMatchObject( {
			status: 'available',
			estimatedReclaimedMilliseconds: 0,
		} );
	} );

	it( 'returns unavailable when cross-scope aggregation exceeds the safe integer range', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: Number.MAX_SAFE_INTEGER,
						focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 0,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
					currentMeasurementRevision: 'revision_1',
				},
				scope_other: {
					totals: {
						estimatedReclaimedMilliseconds: 1,
						focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 0,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
				},
			},
		} );

		expect( projectStatistics( document ) ).toEqual( { status: 'unavailable' } );
	} );
} );
