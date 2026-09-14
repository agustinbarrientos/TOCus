import { describe, expect, it } from 'vitest';
import { createStatisticsDocument } from '../create-statistics-document';
import { projectStatistics } from '../project-statistics';
import { reduceStatistics } from './index';
import { StatisticsDocumentSchema } from '../../types/statistics-document';

/**
 * Records one configured allowance contribution on its observed local date.
 * @param document - Current statistics document.
 * @param date - Recorded local date.
 * @param batchId - Unique FIFO batch identifier.
 * @return Updated statistics document.
 * @since 0.1.0 Initial implementation.
 */
function recordVisit( document: unknown, date: string, batchId = 'batch_1' ) {
	return reduceStatistics( document, {
		type: 'apply-fact-batch',
		batch: {
			observedLocalDate: date,
			batchId,
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			observedAtEpochMilliseconds: 100_000,
			facts: [ {
				type: 'reconsidered-visit', factId: batchId,
				scopeId: 'scope_default', waitId: 'wait_1', participantId: 'participant_1',
				allowanceDurationMilliseconds: 120_000,
				departureCause: 'active-session-tab-close', observedAtEpochMilliseconds: 100_000,
			}, {
				type: 'pause-time', factId: `${ batchId }_pause`,
				scopeId: 'scope_default', waitId: 'wait_1', ownerParticipantId: 'participant_1',
				ownerEpoch: 1, checkpointHighWaterMilliseconds: 5_000,
				acceptedDurationMilliseconds: 5_000, observedAtEpochMilliseconds: 100_000,
			} ],
		},
	} );
}

describe( 'daily statistics', () => {
	it( 'rejects inconsistent, unordered and out-of-retention persisted daily history', () => {
		const document = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-09-14' );
		const day = document.dailyTotals[ 0 ];
		for ( const changes of [
			{ firstRecordedDate: null },
			{ firstRecordedDate: '2026-09-15' },
			{ dailyTotals: [] },
			{ dailyTotals: [ day, day ] },
			{ dailyTotals: [ day, { ...day, date: '2026-09-13' } ] },
			{ dailyTotals: [ day, { ...day, date: '2027-01-01' } ] },
		] ) {
			expect( StatisticsDocumentSchema.safeParse( { ...document, ...changes } ).success ).toBe( false );
		}
	} );

	it( 'fails closed for an invalid current date and never displays future buckets', () => {
		const document = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-09-14' );
		expect( projectStatistics( document, 'invalid' ) ).toEqual( { status: 'unavailable' } );
		expect( projectStatistics( document, '2026-09-13' ) ).toMatchObject( { dailyTotals: [] } );
	} );

	it( 'combines successive checkpoints and configured allowances on the same date', () => {
		const first = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-09-14' );
		const document = recordVisit( first, '2026-09-14', 'batch_2' );
		expect( projectStatistics( document, '2026-09-14' ) ).toMatchObject( { dailyTotals: [ {
			date: '2026-09-14', estimatedReclaimedMilliseconds: 250_000,
			focusedPauseMilliseconds: 10_000, reconsideredVisitCount: 2,
		} ] } );
	} );
	it( 'does not invent observations for a new document', () => {
		expect( projectStatistics( createStatisticsDocument( 'generation_1' ), '2026-09-14' ) )
			.toMatchObject( { dailyTotals: [], estimatedReclaimedMilliseconds: 0 } );
	} );

	it( 'counts accepted pause and configured reconsidered allowance once in daily and lifetime totals', () => {
		const document = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-09-14' );
		const replayed = recordVisit( document, '2026-09-15' );

		expect( replayed ).toEqual( document );
		expect( projectStatistics( replayed, '2026-09-14' ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 125_000,
			dailyTotals: [ {
				date: '2026-09-14', estimatedReclaimedMilliseconds: 125_000,
				focusedPauseMilliseconds: 5_000, reconsideredVisitCount: 1,
				completedWaitCount: 0, allowanceGrantedCount: 0,
			} ],
		} );
	} );

	it( 'separates local dates and fills only observed-era gaps, including a DST boundary', () => {
		const first = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-03-07' );
		const document = recordVisit( first, '2026-03-09', 'batch_2' );
		const projection = projectStatistics( document, '2026-03-09' );

		expect( projection ).toMatchObject( { dailyTotals: [
			{ date: '2026-03-07', estimatedReclaimedMilliseconds: 125_000 },
			{ date: '2026-03-08', estimatedReclaimedMilliseconds: 0 },
			{ date: '2026-03-09', estimatedReclaimedMilliseconds: 125_000 },
		] } );
	} );

	it( 'bounds retention to ninety calendar dates without losing lifetime totals or reviving old buckets', () => {
		let document = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-01-01' );
		document = recordVisit( document, '2026-04-01', 'batch_2' );
		document = recordVisit( document, '2026-01-01', 'batch_3' );

		expect( document.dailyTotals ).toEqual( [ expect.objectContaining( { date: '2026-04-01' } ) ] );
		const projection = projectStatistics( document, '2026-04-01' );
		expect( projection ).toMatchObject( { estimatedReclaimedMilliseconds: 375_000 } );
		if ( projection.status === 'available' ) {
			expect( projection.dailyTotals ).toHaveLength( 30 );
			expect( projection.dailyTotals[ 0 ]?.date ).toBe( '2026-03-03' );
		}
	} );

	it( 'does not fabricate zero history when a clock rollback revisits already-pruned dates', () => {
		const first = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-01-01' );
		const document = recordVisit( first, '2026-06-01', 'batch_2' );
		expect( projectStatistics( document, '2026-02-01' ) ).toMatchObject( { dailyTotals: [] } );
	} );

	it( 'clears daily history on explicit reset and preserves the replay fence', () => {
		const document = recordVisit( createStatisticsDocument( 'generation_1' ), '2026-09-14' );
		const reset = reduceStatistics( document, {
			type: 'reset', generationId: 'generation_2', measurementRevisionsByScope: {},
		} );
		expect( projectStatistics( recordVisit( reset, '2026-09-14' ), '2026-09-14' ) )
			.toMatchObject( { dailyTotals: [], estimatedReclaimedMilliseconds: 0 } );
	} );
} );
