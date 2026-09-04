import { describe, expect, it } from 'vitest';
import { createMockActiveScopeStatistics, createMockStatisticsDocument } from '../../types/__fixtures__';
import { StatisticsDocumentSchema } from '../../types/statistics-document';
import {
	ApplyStatisticsFactBatchOperationSchema,
	ReconcileMeasurementRevisionsOperationSchema,
} from '../../types/statistics-operation';
import { applyStatisticsFactBatch } from '../apply-statistics-fact-batch';
import { projectStatistics } from '../project-statistics';
import { reconcileStatisticsMeasurementRevisions } from './index';

describe( 'reconcileStatisticsMeasurementRevisions', () => {
	it( 'preserves totals while changing, removing, and adding current revisions', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					...createMockActiveScopeStatistics(),
					latestBaseline: {
						measurementRevision: 'revision_1',
						focusedUseMilliseconds: 90_000,
					},
					totals: {
						estimatedReclaimedMilliseconds: 1,
						focusedPauseMilliseconds: 2,
						reconsideredVisitCount: 3,
						completedWaitCount: 4,
						allowanceGrantedCount: 5,
					},
				},
				scope_inactive: {
					totals: {
						estimatedReclaimedMilliseconds: 6,
						focusedPauseMilliseconds: 7,
						reconsideredVisitCount: 8,
						completedWaitCount: 9,
						allowanceGrantedCount: 10,
					},
				},
			},
		} );
		const operation = ReconcileMeasurementRevisionsOperationSchema.parse( {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope: {
				scope_default: 'revision_2',
				scope_new: 'revision_new',
			},
		} );
		const result = reconcileStatisticsMeasurementRevisions( document, operation );

		expect( result.scopes ).toEqual( {
			scope_default: {
				totals: document.scopes.scope_default?.totals,
				hasFinalizedBaseline: true,
				currentMeasurementRevision: 'revision_2',
				latestBaseline: document.scopes.scope_default?.latestBaseline,
			},
			scope_inactive: {
				totals: document.scopes.scope_inactive?.totals,
			},
			scope_new: {
				totals: {
					estimatedReclaimedMilliseconds: 0,
					focusedPauseMilliseconds: 0,
					reconsideredVisitCount: 0,
					completedWaitCount: 0,
					allowanceGrantedCount: 0,
				},
				currentMeasurementRevision: 'revision_new',
			},
		} );
		expect( Object.hasOwn( result.scopes.scope_default ?? {}, 'activeAllowance' ) ).toBe( false );
	} );

	it.each( [
		{
			label: 'becomes inactive',
			measurementRevisionsByScope: { scope_default: 'revision_1' },
		},
		{
			label: 'gets a new measurement revision',
			measurementRevisionsByScope: {
				scope_default: 'revision_1',
				scope_instagram: 'revision_instagram_2',
			},
		},
	] )( 'keeps a queued site contribution when its scope $label', ( {
		measurementRevisionsByScope,
	} ) => {
		const observedAtEpochMilliseconds = 500_000;
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: createMockStatisticsDocument().scopes.scope_default,
				scope_instagram: {
					totals: {
						estimatedReclaimedMilliseconds: 6_000_000,
						focusedPauseMilliseconds: 42_000,
						reconsideredVisitCount: 20,
						completedWaitCount: 15,
						allowanceGrantedCount: 15,
					},
					currentMeasurementRevision: 'revision_instagram',
					latestBaseline: {
						measurementRevision: 'revision_instagram',
						focusedUseMilliseconds: 120_000,
					},
				},
			},
		} );
		const operation = ReconcileMeasurementRevisionsOperationSchema.parse( {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope,
		} );
		const result = reconcileStatisticsMeasurementRevisions( document, operation );
		const resultAfterQueuedFact = applyStatisticsFactBatch(
			result,
			ApplyStatisticsFactBatchOperationSchema.parse( {
				type: 'apply-fact-batch',
				batch: {
					batchId: 'batch_instagram',
					scopeId: 'scope_instagram',
					measurementRevision: 'revision_instagram',
					observedAtEpochMilliseconds,
					facts: [ {
						type: 'reconsidered-visit',
						factId: 'fact_instagram',
						scopeId: 'scope_instagram',
						waitId: 'wait_instagram',
						participantId: 'participant_instagram',
						departureCause: 'active-session-tab-close',
						observedAtEpochMilliseconds,
					} ],
				},
			} ),
		);

		expect( result.scopes.scope_instagram ).toMatchObject( {
			totals: document.scopes.scope_instagram?.totals,
			latestBaseline: document.scopes.scope_instagram?.latestBaseline,
		} );
		expect( projectStatistics( resultAfterQueuedFact ) ).toMatchObject( {
			status: 'available',
			estimatedReclaimedMilliseconds: 6_120_000,
			focusedPauseMilliseconds: 42_000,
			reconsideredVisitCount: 21,
			completedWaitCount: 15,
			allowanceGrantedCount: 15,
		} );
	} );

	it( 'keeps current measurements when the revision is unchanged', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: { scope_default: createMockActiveScopeStatistics() },
		} );
		const operation = ReconcileMeasurementRevisionsOperationSchema.parse( {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope: { scope_default: 'revision_1' },
		} );

		expect( reconcileStatisticsMeasurementRevisions( document, operation ) ).toEqual( document );
	} );

	it.each( [
		{
			label: 'measurement revision changes',
			measurementRevisionsByScope: { scope_default: 'revision_2' },
		},
		{
			label: 'scope becomes inactive',
			measurementRevisionsByScope: {},
		},
	] )( 'preserves known all-time zero when the $label', ( { measurementRevisionsByScope } ) => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: {
				scope_default: {
					...createMockStatisticsDocument().scopes.scope_default,
					latestBaseline: {
						measurementRevision: 'revision_1',
						focusedUseMilliseconds: 0,
					},
				},
			},
		} );
		const operation = ReconcileMeasurementRevisionsOperationSchema.parse( {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope,
		} );
		const result = reconcileStatisticsMeasurementRevisions( document, operation );

		expect( result.scopes.scope_default ).toMatchObject( {
			hasFinalizedBaseline: true,
		} );
		expect( projectStatistics( result ) ).toMatchObject( {
			status: 'available',
			estimatedReclaimedMilliseconds: 0,
		} );
	} );

	it( 'adds a current scope safely under the supported __proto__ key', () => {
		const document = createMockStatisticsDocument();
		const operation = ReconcileMeasurementRevisionsOperationSchema.parse( {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope: Object.fromEntries( [ [ '__proto__', 'revision_magic' ] ] ),
		} );
		const result = reconcileStatisticsMeasurementRevisions( document, operation );

		expect( Object.hasOwn( result.scopes, '__proto__' ) ).toBe( true );
		expect( result.scopes.__proto__?.currentMeasurementRevision ).toBe( 'revision_magic' );
	} );

	it( 'keeps an omitted toString scope inactive instead of reading the Object prototype', () => {
		const historicalScope = {
			totals: {
				estimatedReclaimedMilliseconds: 1,
				focusedPauseMilliseconds: 2,
				reconsideredVisitCount: 3,
				completedWaitCount: 4,
				allowanceGrantedCount: 5,
			},
		};
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			scopes: Object.fromEntries( [ [ 'toString', historicalScope ] ] ),
		} );
		const operation = ReconcileMeasurementRevisionsOperationSchema.parse( {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope: {},
		} );

		expect( Object.entries(
			reconcileStatisticsMeasurementRevisions( document, operation ).scopes,
		) ).toContainEqual( [ 'toString', historicalScope ] );
	} );
} );
