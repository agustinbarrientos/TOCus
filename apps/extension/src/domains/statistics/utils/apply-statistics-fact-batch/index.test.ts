import { describe, expect, it } from 'vitest';
import { createMockActiveStatisticsDocument, createMockStatisticsDocument } from '../../types/__fixtures__';
import { StatisticsDocumentSchema } from '../../types/statistics-document';
import { ApplyStatisticsFactBatchOperationSchema } from '../../types/statistics-operation';
import { applyStatisticsFactBatch } from './index';

/**
 * Creates one valid allowance-granted fact.
 * @param factId - Stable fact identifier.
 * @param allowanceId - Stable allowance identifier.
 * @param startedAtEpochMilliseconds - Allowance start time.
 * @param scopeId - Protection scope identifier.
 * @return Allowance-granted fact fixture.
 * @since 0.1.0 Initial implementation.
 */
function createAllowanceFact(
	factId: string,
	allowanceId: string,
	startedAtEpochMilliseconds: number,
	scopeId = 'scope_default',
): Record<string, unknown> {
	return {
		type: 'allowance-granted',
		factId,
		scopeId,
		allowanceId,
		startedAtEpochMilliseconds,
		expiresAtEpochMilliseconds: startedAtEpochMilliseconds + 300_000,
		allowanceDurationMilliseconds: 300_000,
	};
}

/**
 * Creates one valid reconsidered-visit fact.
 * @param factId - Stable fact identifier.
 * @param observedAtEpochMilliseconds - Departure observation time.
 * @param scopeId - Protection scope identifier.
 * @return Reconsidered-visit fact fixture.
 * @since 0.1.0 Initial implementation.
 */
function createReconsideredFact(
	factId: string,
	observedAtEpochMilliseconds: number,
	scopeId = 'scope_default',
): Record<string, unknown> {
	return {
		type: 'reconsidered-visit',
		factId,
		scopeId,
		waitId: `wait_${ factId }`,
		participantId: `participant_${ factId }`,
		departureCause: 'active-session-tab-close',
		observedAtEpochMilliseconds,
	};
}

/**
 * Creates one validated fact-batch application operation.
 * @param batchId - Stable batch identifier.
 * @param observedAtEpochMilliseconds - Shared fact observation time.
 * @param facts - Same-scope facts.
 * @param measurementRevision - Captured measurement revision.
 * @param scopeId - Protection scope identifier.
 * @return Validated fact-batch operation.
 * @since 0.1.0 Initial implementation.
 */
function createBatchOperation(
	batchId: string,
	observedAtEpochMilliseconds: number,
	facts: Record<string, unknown>[],
	measurementRevision = 'revision_1',
	scopeId = 'scope_default',
) {
	return ApplyStatisticsFactBatchOperationSchema.parse( {
		type: 'apply-fact-batch',
		batch: {
			batchId,
			scopeId,
			measurementRevision,
			observedAtEpochMilliseconds,
			facts,
		},
	} );
}

describe( 'applyStatisticsFactBatch', () => {
	it( 'aggregates all approved facts and starts current allowance measurement', () => {
		const observedAtEpochMilliseconds = 500_000;
		const base = createMockStatisticsDocument();
		const document = StatisticsDocumentSchema.parse( {
			...base,
			scopes: {
				scope_default: {
					...base.scopes.scope_default,
					latestBaseline: {
						measurementRevision: 'revision_1',
						focusedUseMilliseconds: 120_000,
					},
				},
			},
		} );
		const operation = createBatchOperation( 'batch_1', observedAtEpochMilliseconds, [
			{
				type: 'pause-time',
				factId: 'fact_pause',
				scopeId: 'scope_default',
				waitId: 'wait_1',
				ownerParticipantId: 'participant_1',
				ownerEpoch: 1,
				checkpointHighWaterMilliseconds: 10_000,
				acceptedDurationMilliseconds: 8_000,
				observedAtEpochMilliseconds,
			},
			createReconsideredFact( 'fact_reconsidered', observedAtEpochMilliseconds ),
			{
				type: 'completed-wait',
				factId: 'fact_completed',
				scopeId: 'scope_default',
				waitId: 'wait_1',
				capturedWaitDurationMilliseconds: 10_000,
				completedAtEpochMilliseconds: observedAtEpochMilliseconds,
				completionLocalDate: '2026-09-03',
			},
			createAllowanceFact( 'fact_allowance', 'allowance_1', observedAtEpochMilliseconds ),
		] );
		const result = applyStatisticsFactBatch( document, operation );

		expect( result.lastAppliedBatchId ).toBe( 'batch_1' );
		expect( result.scopes.scope_default ).toEqual( {
			...document.scopes.scope_default,
			totals: {
				estimatedReclaimedMilliseconds: 120_000,
				focusedPauseMilliseconds: 8_000,
				reconsideredVisitCount: 1,
				completedWaitCount: 1,
				allowanceGrantedCount: 1,
			},
			activeAllowance: {
				allowanceId: 'allowance_1',
				measurementRevision: 'revision_1',
				startedAtEpochMilliseconds: 500_000,
				expiresAtEpochMilliseconds: 800_000,
				confirmedFocusedUseMilliseconds: 0,
				accountedThroughEpochMilliseconds: 500_000,
			},
		} );
	} );

	it( 'treats replay of the last FIFO-head batch as a no-op', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			lastAppliedBatchId: 'batch_1',
		} );
		const operation = createBatchOperation(
			'batch_1',
			500_000,
			[ createReconsideredFact( 'fact_1', 500_000 ) ],
		);

		expect( applyStatisticsFactBatch( document, operation ) ).toBe( document );
	} );

	it( 'finalizes an expired allowance before applying a later reconsidered visit', () => {
		const document = createMockActiveStatisticsDocument();
		const scope = document.scopes.scope_default;
		const activeAllowance = scope?.activeAllowance;

		if ( scope === undefined || activeAllowance === undefined ) {
			throw new Error( 'Expected an active scope fixture.' );
		}

		document.scopes.scope_default = {
			...scope,
			activeAllowance: {
				...activeAllowance,
				confirmedFocusedUseMilliseconds: 90_000,
				accountedThroughEpochMilliseconds: 250_000,
			},
		};
		const result = applyStatisticsFactBatch( document, createBatchOperation(
			'batch_2',
			400_000,
			[ createReconsideredFact( 'fact_2', 400_000 ) ],
		) );

		expect( result.scopes.scope_default?.totals ).toMatchObject( {
			estimatedReclaimedMilliseconds: 90_000,
			reconsideredVisitCount: 1,
		} );
		expect( result.scopes.scope_default?.latestBaseline?.focusedUseMilliseconds ).toBe( 90_000 );
		expect( Object.hasOwn( result.scopes.scope_default ?? {}, 'activeAllowance' ) ).toBe( false );
	} );

	it( 'keeps invariant totals without touching current measurements for an old revision', () => {
		const document = createMockActiveStatisticsDocument();
		const observedAtEpochMilliseconds = 200_000;
		const operation = createBatchOperation(
			'batch_old',
			observedAtEpochMilliseconds,
			[
				{
					type: 'pause-time',
					factId: 'fact_pause_old',
					scopeId: 'scope_default',
					waitId: 'wait_old',
					ownerParticipantId: 'participant_old',
					ownerEpoch: 1,
					checkpointHighWaterMilliseconds: 5_000,
					acceptedDurationMilliseconds: 5_000,
					observedAtEpochMilliseconds,
				},
				createReconsideredFact( 'fact_reconsidered_old', observedAtEpochMilliseconds ),
				{
					type: 'completed-wait',
					factId: 'fact_completed_old',
					scopeId: 'scope_default',
					waitId: 'wait_old',
					capturedWaitDurationMilliseconds: 10_000,
					completedAtEpochMilliseconds: observedAtEpochMilliseconds,
					completionLocalDate: '2026-09-03',
				},
				createAllowanceFact( 'fact_allowance_old', 'allowance_old', observedAtEpochMilliseconds ),
			],
			'revision_old',
		);
		const result = applyStatisticsFactBatch( document, operation );

		expect( result.scopes.scope_default?.totals ).toMatchObject( {
			estimatedReclaimedMilliseconds: 0,
			focusedPauseMilliseconds: 5_000,
			reconsideredVisitCount: 1,
			completedWaitCount: 1,
			allowanceGrantedCount: 1,
		} );
		expect( result.scopes.scope_default?.activeAllowance ).toEqual(
			document.scopes.scope_default?.activeAllowance,
		);
	} );

	it( 'finalizes a non-overlapping allowance before starting the next one', () => {
		const document = createMockActiveStatisticsDocument();
		const result = applyStatisticsFactBatch( document, createBatchOperation(
			'batch_next',
			400_000,
			[ createAllowanceFact( 'fact_next', 'allowance_2', 400_000 ) ],
		) );

		expect( result.scopes.scope_default?.latestBaseline?.focusedUseMilliseconds ).toBe( 0 );
		expect( result.scopes.scope_default?.activeAllowance?.allowanceId ).toBe( 'allowance_2' );
	} );

	it( 'rejects an overlapping current allowance grant', () => {
		const document = createMockActiveStatisticsDocument();

		expect( () => applyStatisticsFactBatch( document, createBatchOperation(
			'batch_overlap',
			300_000,
			[ createAllowanceFact( 'fact_overlap', 'allowance_2', 300_000 ) ],
		) ) ).toThrow( RangeError );
	} );

	it( 'creates only inactive totals for a delayed removed-scope batch', () => {
		const observedAtEpochMilliseconds = 500_000;
		const operation = createBatchOperation(
			'batch_deleted',
			observedAtEpochMilliseconds,
			[
				createReconsideredFact( 'fact_deleted_reconsidered', observedAtEpochMilliseconds, 'scope_deleted' ),
				createAllowanceFact(
					'fact_deleted_allowance',
					'allowance_deleted',
					observedAtEpochMilliseconds,
					'scope_deleted',
				),
			],
			'revision_deleted',
			'scope_deleted',
		);
		const result = applyStatisticsFactBatch( createMockStatisticsDocument(), operation );

		expect( result.scopes.scope_deleted ).toEqual( {
			totals: {
				estimatedReclaimedMilliseconds: 0,
				focusedPauseMilliseconds: 0,
				reconsideredVisitCount: 1,
				completedWaitCount: 0,
				allowanceGrantedCount: 1,
			},
		} );
	} );

	it.each( [ '__proto__', 'constructor', 'toString' ] )(
		'creates inactive totals safely for the supported scope key %s',
		( scopeId ) => {
			const observedAtEpochMilliseconds = 500_000;
			const operation = createBatchOperation(
				'batch_magic',
				observedAtEpochMilliseconds,
				[ createReconsideredFact( 'fact_magic', observedAtEpochMilliseconds, scopeId ) ],
				'revision_magic',
				scopeId,
			);
			const result = applyStatisticsFactBatch( createMockStatisticsDocument(), operation );

			expect( Object.hasOwn( result.scopes, scopeId ) ).toBe( true );
			expect( result.scopes[ scopeId ]?.totals.reconsideredVisitCount ).toBe( 1 );
		},
	);
} );
