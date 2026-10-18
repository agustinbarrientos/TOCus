import { describe, expect, it } from 'vitest';
import { createStatisticsDocument } from '../create-statistics-document';
import { projectStatistics } from '../project-statistics';
import { reduceStatistics } from './index';

/**
 * Records one prospective website outcome with captured calendar attribution.
 * @param document - Current aggregate persistence.
 * @param root0 - Captured outcome attribution and identity.
 * @param root0.batchId - Durable batch identity.
 * @param root0.date - Original local calendar date.
 * @param root0.hour - Original local hour.
 * @param root0.siteHost - Configured website host.
 * @param root0.continued - Whether the browser accepted a continuation.
 * @param root0.legacy - Whether an older queued fact lacks attribution.
 * @return Reduced aggregate persistence.
 */
function recordOutcome( document: unknown, {
	batchId = 'batch_1', date = '2026-10-18', hour = 14, siteHost = 'youtube.com',
	continued = false, legacy = false,
} = {} ) {
	const common = {
		factId: batchId, scopeId: 'scope_default', participantId: 'participant_1',
		observedAtEpochMilliseconds: 100_000,
	};
	return reduceStatistics( document, {
		type: 'apply-fact-batch',
		batch: {
			batchId, observedLocalDate: date, scopeId: 'scope_default',
			measurementRevision: 'revision_1', observedAtEpochMilliseconds: 100_000,
			facts: [ continued ? {
				...common, type: 'continued-visit', pageId: 'page_1', allowanceId: 'allowance_1',
				siteHost, observedLocalHour: hour,
			} : {
				...common, type: 'reconsidered-visit', waitId: 'wait_1',
				allowanceDurationMilliseconds: 120_000, departureCause: 'active-session-tab-close',
				...( legacy ? {} : { siteHost, observedLocalHour: hour } ),
			} ],
		},
	} );
}

describe( 'website and hourly visit outcomes', () => {
	it( 'adds accepted continuations independently of shared completed pauses and allowances', () => {
		const first = recordOutcome( createStatisticsDocument( 'generation_1' ) );
		const second = recordOutcome( first, { batchId: 'batch_2', continued: true } );
		const third = recordOutcome( second, { batchId: 'batch_3', continued: true } );
		expect( third.visitOutcomes ).toEqual( {
			recordedFromDate: '2026-10-18',
			dailySites: [ { date: '2026-10-18', siteHost: 'youtube.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 2 } ],
			dailyHours: [ { date: '2026-10-18', hour: 14, reconsideredVisitCount: 1 } ],
		} );
		expect( third.scopes.scope_default?.totals ).toEqual( first.scopes.scope_default?.totals );
		expect( recordOutcome( third, { batchId: 'batch_3', continued: true } ) ).toEqual( third );
	} );

	it( 'replays captured hosts, dates and local hours without rematching or deriving them from epoch time', () => {
		let document = recordOutcome( createStatisticsDocument( 'generation_1' ), { date: '2026-11-01', hour: 1 } );
		document = recordOutcome( document, { batchId: 'batch_2', date: '2026-11-01', hour: 1 } );
		document = recordOutcome( document, { batchId: 'batch_3', date: '2026-10-31', hour: 23, siteHost: 'reddit.com' } );
		document = recordOutcome( document, { batchId: 'batch_4', date: '2026-11-01', hour: 0, siteHost: 'a.com' } );
		expect( document.visitOutcomes ).toEqual( {
			recordedFromDate: '2026-10-31',
			dailySites: [
				{ date: '2026-10-31', siteHost: 'reddit.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 },
				{ date: '2026-11-01', siteHost: 'a.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 },
				{ date: '2026-11-01', siteHost: 'youtube.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 0 },
			],
			dailyHours: [
				{ date: '2026-10-31', hour: 23, reconsideredVisitCount: 1 },
				{ date: '2026-11-01', hour: 0, reconsideredVisitCount: 1 },
				{ date: '2026-11-01', hour: 1, reconsideredVisitCount: 2 },
			],
		} );
	} );

	it( 'keeps legacy FIFO facts unattributed while preserving their original totals', () => {
		const legacy = recordOutcome( createStatisticsDocument( 'generation_1' ), { legacy: true } );
		expect( Object.hasOwn( legacy, 'visitOutcomes' ) ).toBe( false );
		expect( legacy.scopes.scope_default?.totals.reconsideredVisitCount ).toBe( 1 );
	} );

	it( 'projects real history coverage, hides future buckets and detaches aggregate data', () => {
		const first = recordOutcome( createStatisticsDocument( 'generation_1' ) );
		const document = recordOutcome( first, { batchId: 'batch_2', date: '2026-10-19' } );
		const projection = projectStatistics( document, '2026-10-18' );
		expect( projection ).toMatchObject( { firstRecordedDate: '2026-10-18', visitOutcomes: first.visitOutcomes } );
		if ( projection.status === 'available' ) {
			projection.visitOutcomes?.dailySites.splice( 0 );
		}
		expect( document.visitOutcomes?.dailySites ).toHaveLength( 2 );
	} );

	it( 'clears every breakdown on reset and preserves the batch replay fence', () => {
		const document = recordOutcome( createStatisticsDocument( 'generation_1' ) );
		const reset = reduceStatistics( document, {
			type: 'reset', generationId: 'generation_2', measurementRevisionsByScope: {},
		} );
		expect( Object.hasOwn( reset, 'visitOutcomes' ) ).toBe( false );
		expect( reset.lastAppliedBatchId ).toBe( document.lastAppliedBatchId );
		expect( recordOutcome( reset ) ).toEqual( reset );
	} );
} );
