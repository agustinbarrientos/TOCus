import { describe, expect, it } from 'vitest';
import { DepartureCause } from '../../../protection/types/protection-event';
import { ProtectionFactType } from '../../../protection/types/protection-fact';
import type { StatisticsDocument } from '../../types/statistics-document';
import { StatisticsOperationType } from '../../types/statistics-operation';
import { createMockStatisticsDocument } from '../../types/__fixtures__';
import { projectStatistics } from '../project-statistics';
import { reduceStatistics } from './index';

/**
 * Exercises an allowance with minute-sized navigation checkpoints, followed by its expiry.
 * @param document - Prior local statistics.
 * @param siteHost - Configured website receiving focus.
 * @param startedAt - Unique visit start and identifier seed.
 * @param focusedMilliseconds - Actual foreground use within a five-minute allowance.
 * @return Statistics after this visit has expired.
 */
function recordVisit(
	document: StatisticsDocument,
	siteHost: string,
	startedAt: number,
	focusedMilliseconds: number,
): StatisticsDocument {
	const allowanceId = `allowance_${ String( startedAt ) }`;
	let current = reduceStatistics( document, {
		type: StatisticsOperationType.APPLY_FACT_BATCH,
		batch: {
			batchId: `batch_${ String( startedAt ) }`,
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			observedAtEpochMilliseconds: startedAt,
			facts: [ {
				type: ProtectionFactType.ALLOWANCE_GRANTED,
				factId: `fact_${ String( startedAt ) }`,
				scopeId: 'scope_default',
				allowanceId,
				startedAtEpochMilliseconds: startedAt,
				expiresAtEpochMilliseconds: startedAt + 300_000,
				allowanceDurationMilliseconds: 300_000,
			} ],
		},
	} );
	for ( let elapsed = 0; elapsed < focusedMilliseconds; elapsed += 60_000 ) {
		current = reduceStatistics( current, {
			type: StatisticsOperationType.RECORD_FOCUSED_INTERVAL,
			generationId: document.generationId,
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId,
			siteHost,
			startedAtEpochMilliseconds: startedAt + elapsed,
			endedAtEpochMilliseconds: startedAt + Math.min( elapsed + 60_000, focusedMilliseconds ),
		} );
	}
	return reduceStatistics( current, {
		type: StatisticsOperationType.FINALIZE_ACTIVE_ALLOWANCE,
		generationId: document.generationId,
		scopeId: 'scope_default',
		measurementRevision: 'revision_1',
		allowanceId,
		finalizedAtEpochMilliseconds: startedAt + 300_000,
	} );
}

/**
 * Records distinct abandoned visits after all fixture allowances have expired.
 * @param document - Prior local statistics.
 * @param durations - Configured browsing allowances captured when visits were reconsidered.
 * @param scopeId - Current timer for these sites.
 * @param revision - Current timer measurement revision.
 * @return Statistics after one durable departure batch.
 */
function reconsiderVisits(
	document: StatisticsDocument,
	durations: number[],
	scopeId = 'scope_default',
	revision = 'revision_1',
): StatisticsDocument {
	return reduceStatistics( document, {
		type: StatisticsOperationType.APPLY_FACT_BATCH,
		batch: {
			batchId: `batch_departures_${ document.generationId }`,
			scopeId,
			measurementRevision: revision,
			observedAtEpochMilliseconds: 2_000_000,
			facts: durations.map( ( allowanceDurationMilliseconds, index ) => ( {
				type: ProtectionFactType.RECONSIDERED_VISIT,
				factId: `fact_departure_${ document.generationId }_${ String( index ) }`,
				scopeId,
				allowanceDurationMilliseconds,
				waitId: `wait_${ String( index ) }`,
				participantId: `participant_${ String( index ) }`,
				departureCause: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
				observedAtEpochMilliseconds: 2_000_000,
			} ) ),
		},
	} );
}

describe( 'configured browsing-allowance estimates', () => {
	it( 'adds fifteen minutes for three reconsidered visits without prior browsing history', () => {
		const result = reconsiderVisits( createMockStatisticsDocument(), [ 300_000, 300_000, 300_000 ] );

		expect( projectStatistics( result ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 900_000,
			reconsideredVisitCount: 3,
		} );
		expect( reconsiderVisits( result, [ 300_000, 300_000, 300_000 ] ) ).toEqual( result );
	} );

	it( 'adds the configured allowance regardless of previous full or short visits', () => {
		const fullVisit = recordVisit( createMockStatisticsDocument(), 'youtube.com', 100_000, 300_000 );
		const shortVisit = recordVisit( fullVisit, 'youtube.com', 500_000, 10_000 );
		const result = reconsiderVisits( shortVisit, [ 300_000, 300_000, 300_000 ] );

		expect( projectStatistics( result ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 900_000,
			reconsideredVisitCount: 3,
		} );
	} );

	it( 'uses the allowance captured by each event when timing changes', () => {
		const result = reconsiderVisits( createMockStatisticsDocument(), [ 120_000, 300_000, 600_000 ] );

		expect( projectStatistics( result ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 1_020_000,
			reconsideredVisitCount: 3,
		} );
	} );

	it( 'includes recorded breathing time once even when its fact batch is replayed', () => {
		const reconsidered = reconsiderVisits( createMockStatisticsDocument(), [ 300_000, 300_000, 300_000 ] );
		const operation = {
			type: StatisticsOperationType.APPLY_FACT_BATCH,
			batch: {
				batchId: 'batch_pause',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				observedAtEpochMilliseconds: 2_100_000,
				facts: [ {
					type: ProtectionFactType.PAUSE_TIME,
					factId: 'fact_pause',
					scopeId: 'scope_default',
					waitId: 'wait_pause',
					ownerParticipantId: 'participant_pause',
					ownerEpoch: 1,
					checkpointHighWaterMilliseconds: 20_000,
					acceptedDurationMilliseconds: 20_000,
					observedAtEpochMilliseconds: 2_100_000,
				} ],
			},
		};
		const result = reduceStatistics( reconsidered, operation );
		expect( reduceStatistics( result, operation ) ).toEqual( result );
		expect( result.scopes.scope_default?.totals.estimatedReclaimedMilliseconds ).toBe( 900_000 );
		for ( let read = 0; read < 2; read += 1 ) {
			expect( projectStatistics( result ) ).toMatchObject( {
				estimatedReclaimedMilliseconds: 920_000,
				focusedPauseMilliseconds: 20_000,
				reconsideredVisitCount: 3,
			} );
		}
	} );

	it.each( [ 'scope_default', 'scope_independent' ] )( 'uses configured time after a revision or timer change to %s', ( scopeId ) => {
		const visited = recordVisit( createMockStatisticsDocument(), 'youtube.com', 100_000, 300_000 );
		const reconfigured = reduceStatistics( visited, {
			type: StatisticsOperationType.RECONCILE_MEASUREMENT_REVISIONS,
			measurementRevisionsByScope: { [ scopeId ]: 'revision_2' },
		} );
		const result = reconsiderVisits( reconfigured, [ 600_000 ], scopeId, 'revision_2' );

		expect( projectStatistics( result ) ).toMatchObject( { estimatedReclaimedMilliseconds: 600_000 } );
	} );

	it( 'resets totals and counts the full configured allowance on the next reconsidered visit', () => {
		const reconsidered = reconsiderVisits( createMockStatisticsDocument(), [ 300_000, 300_000 ] );
		const reset = reduceStatistics( reconsidered, {
			type: StatisticsOperationType.RESET,
			generationId: 'generation_new',
			measurementRevisionsByScope: { scope_default: 'revision_1' },
		} );

		expect( projectStatistics( reset ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 0,
			reconsideredVisitCount: 0,
		} );
		expect( projectStatistics( reconsiderVisits( reset, [ 300_000 ] ) ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 300_000,
			reconsideredVisitCount: 1,
		} );
	} );
} );
