import { describe, expect, it } from 'vitest';
import { DepartureCause } from '../../../protection/types/protection-event';
import { ProtectionFactType } from '../../../protection/types/protection-fact';
import { StatisticsDocumentSchema, type StatisticsDocument } from '../../types/statistics-document';
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
 * @param hosts - Configured websites abandoned at their pauses.
 * @param scopeId - Current timer for these sites.
 * @param revision - Current timer measurement revision.
 * @return Statistics after one durable departure batch.
 */
function reconsiderVisits(
	document: StatisticsDocument,
	hosts: string[],
	scopeId = 'scope_default',
	revision = 'revision_1',
): StatisticsDocument {
	return reduceStatistics( document, {
		type: StatisticsOperationType.APPLY_FACT_BATCH,
		batch: {
			batchId: 'batch_departures',
			scopeId,
			measurementRevision: revision,
			observedAtEpochMilliseconds: 2_000_000,
			facts: hosts.map( ( siteHost, index ) => ( {
				type: ProtectionFactType.RECONSIDERED_VISIT,
				factId: `fact_departure_${ String( index ) }`,
				scopeId,
				siteHost,
				waitId: `wait_${ String( index ) }`,
				participantId: `participant_${ String( index ) }`,
				departureCause: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
				observedAtEpochMilliseconds: 2_000_000,
			} ) ),
		},
	} );
}

describe( 'per-site longest-visit estimates', () => {
	it( 'adds fifteen minutes for three reconsidered visits after a five-minute visit and a shorter visit', () => {
		const fullVisit = recordVisit( createMockStatisticsDocument(), 'youtube.com', 100_000, 300_000 );
		const shortVisit = recordVisit( fullVisit, 'youtube.com', 500_000, 10_000 );
		const result = reconsiderVisits( shortVisit, [ 'youtube.com', 'youtube.com', 'youtube.com' ] );

		expect( projectStatistics( result ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 900_000,
			reconsideredVisitCount: 3,
		} );
		expect( reconsiderVisits( result, [ 'youtube.com', 'youtube.com', 'youtube.com' ] ) ).toEqual( result );
	} );

	it( 'uses each site own maximum even when its timer is shared', () => {
		const youtube = recordVisit( createMockStatisticsDocument(), 'youtube.com', 100_000, 300_000 );
		const github = recordVisit( youtube, 'github.com', 500_000, 120_000 );
		const result = reconsiderVisits( github, [ 'youtube.com', 'github.com', 'netflix.com' ] );

		expect( projectStatistics( result ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 420_000,
			reconsideredVisitCount: 3,
		} );
	} );

	it.each( [ 'scope_default', 'scope_independent' ] )( 'keeps a site maximum after a revision or timer change to %s', ( scopeId ) => {
		const visited = recordVisit( createMockStatisticsDocument(), 'youtube.com', 100_000, 300_000 );
		const reconfigured = reduceStatistics( visited, {
			type: StatisticsOperationType.RECONCILE_MEASUREMENT_REVISIONS,
			measurementRevisionsByScope: { [ scopeId ]: 'revision_2' },
		} );
		const result = reconsiderVisits( reconfigured, [ 'youtube.com' ], scopeId, 'revision_2' );

		expect( projectStatistics( result ) ).toMatchObject( { estimatedReclaimedMilliseconds: 300_000 } );
	} );

	it( 'does not assign an old shared-timer sample to an identified site', () => {
		const fixture = createMockStatisticsDocument();
		const document = StatisticsDocumentSchema.parse( {
			...fixture,
			scopes: {
				scope_default: {
					...fixture.scopes.scope_default,
					latestBaseline: { measurementRevision: 'revision_1', focusedUseMilliseconds: 300_000 },
				},
			},
		} );
		const result = reconsiderVisits( document, [ 'youtube.com' ] );

		expect( projectStatistics( result ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: 0,
			reconsideredVisitCount: 1,
		} );
	} );

	it( 'clears per-site maxima when statistics are reset', () => {
		const visited = recordVisit( createMockStatisticsDocument(), 'youtube.com', 100_000, 300_000 );
		const reset = reduceStatistics( visited, {
			type: StatisticsOperationType.RESET,
			generationId: 'generation_new',
			measurementRevisionsByScope: { scope_default: 'revision_1' },
		} );

		expect( projectStatistics( reconsiderVisits( reset, [ 'youtube.com' ] ) ) ).toMatchObject( {
			estimatedReclaimedMilliseconds: null,
			reconsideredVisitCount: 1,
		} );
	} );
} );
