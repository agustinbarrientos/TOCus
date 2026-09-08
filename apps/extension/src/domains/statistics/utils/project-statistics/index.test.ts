import { describe, expect, it } from 'vitest';
import { createMockStatisticsDocument } from '../../types/__fixtures__';
import { ScopeStatisticsSchema, StatisticsDocumentSchema } from '../../types/statistics-document';
import { StatisticsProjectionStatus } from '../../types/statistics-projection';
import { projectStatistics } from './index';

describe( 'projectStatistics', () => {
	it( 'returns unavailable for malformed or unsupported persistence', () => {
		expect( projectStatistics( null ) ).toEqual( { status: StatisticsProjectionStatus.UNAVAILABLE } );
		expect( projectStatistics( {
			...createMockStatisticsDocument(),
			schemaVersion: 2,
		} ) ).toEqual( { status: StatisticsProjectionStatus.UNAVAILABLE } );
	} );

	it( 'projects exactly five empty all-time values without inventing an estimate', () => {
		expect( projectStatistics( createMockStatisticsDocument() ) ).toEqual( {
			status: StatisticsProjectionStatus.AVAILABLE,
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
			status: StatisticsProjectionStatus.AVAILABLE,
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
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 33,
			focusedPauseMilliseconds: 22,
			reconsideredVisitCount: 33,
			completedWaitCount: 44,
			allowanceGrantedCount: 55,
		} );
	} );

	it.each( [ false, true ] )( 'includes recorded pause time with no reconsidered visits (finalized baseline: %s)', ( hasFinalizedBaseline ) => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					hasFinalizedBaseline,
					totals: {
						estimatedReclaimedMilliseconds: 0,
						focusedPauseMilliseconds: 120_000,
						reconsideredVisitCount: 0,
						completedWaitCount: 6,
						allowanceGrantedCount: 6,
					},
				},
			},
		} );

		expect( projectStatistics( document ) ).toEqual( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 120_000,
			focusedPauseMilliseconds: 120_000,
			reconsideredVisitCount: 0,
			completedWaitCount: 6,
			allowanceGrantedCount: 6,
		} );
	} );

	it( 'includes the pause breakdown once without changing stored estimates or accumulating across reads', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: 900_000,
						focusedPauseMilliseconds: 120_000,
						reconsideredVisitCount: 3,
						completedWaitCount: 6,
						allowanceGrantedCount: 6,
					},
				},
			},
		} );
		const persistedBefore = JSON.stringify( document );

		for ( let read = 0; read < 3; read += 1 ) {
			expect( projectStatistics( document ) ).toMatchObject( {
				status: StatisticsProjectionStatus.AVAILABLE,
				estimatedReclaimedMilliseconds: 1_020_000,
				focusedPauseMilliseconds: 120_000,
				reconsideredVisitCount: 3,
			} );
		}

		expect( JSON.stringify( document ) ).toBe( persistedBefore );
	} );

	it( 'returns unavailable when the combined estimate and pause time exceed the safe integer range', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: Number.MAX_SAFE_INTEGER,
						focusedPauseMilliseconds: 1,
						reconsideredVisitCount: 0,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
				},
			},
		} );

		expect( projectStatistics( document ) ).toEqual( { status: StatisticsProjectionStatus.UNAVAILABLE } );
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
			status: StatisticsProjectionStatus.AVAILABLE,
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
			status: StatisticsProjectionStatus.AVAILABLE,
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

		expect( projectStatistics( document ) ).toEqual( { status: StatisticsProjectionStatus.UNAVAILABLE } );
	} );
} );
