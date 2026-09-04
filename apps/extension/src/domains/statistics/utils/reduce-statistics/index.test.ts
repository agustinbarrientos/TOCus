import { describe, expect, it } from 'vitest';
import { createMockStatisticsDocument } from '../../types/__fixtures__';
import { reduceStatistics } from './index';

describe( 'reduceStatistics', () => {
	it( 'validates documents and operations at the public boundary', () => {
		expect( () => reduceStatistics( {}, { type: 'reset' } ) ).toThrow();
		expect( () => reduceStatistics( createMockStatisticsDocument(), {
			type: 'record-focused-interval',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			startedAtEpochMilliseconds: 200_000,
			endedAtEpochMilliseconds: 100_000,
		} ) ).toThrow();
	} );

	it( 'routes every statistics operation through one validated sequence', () => {
		const observedAtEpochMilliseconds = 100_000;
		const withAllowance = reduceStatistics( createMockStatisticsDocument(), {
			type: 'apply-fact-batch',
			batch: {
				batchId: 'batch_1',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				observedAtEpochMilliseconds,
				facts: [ {
					type: 'allowance-granted',
					factId: 'fact_1',
					scopeId: 'scope_default',
					allowanceId: 'allowance_1',
					startedAtEpochMilliseconds: observedAtEpochMilliseconds,
					expiresAtEpochMilliseconds: 400_000,
					allowanceDurationMilliseconds: 300_000,
				} ],
			},
		} );
		const withFocusedUse = reduceStatistics( withAllowance, {
			type: 'record-focused-interval',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			startedAtEpochMilliseconds: 100_000,
			endedAtEpochMilliseconds: 160_000,
		} );
		const finalized = reduceStatistics( withFocusedUse, {
			type: 'finalize-active-allowance',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			finalizedAtEpochMilliseconds: 400_000,
		} );
		const reconciled = reduceStatistics( finalized, {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope: { scope_default: 'revision_2' },
		} );
		const reset = reduceStatistics( reconciled, {
			type: 'reset',
			generationId: 'generation_2',
			measurementRevisionsByScope: { scope_default: 'revision_2' },
		} );

		expect( reset ).toEqual( {
			schemaVersion: 1,
			generationId: 'generation_2',
			lastAppliedBatchId: 'batch_1',
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: 0,
						focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 0,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
					currentMeasurementRevision: 'revision_2',
				},
			},
		} );
	} );

	it( 'does not mutate a document or operation', () => {
		const document = createMockStatisticsDocument();
		const operation = {
			type: 'reconcile-measurement-revisions',
			measurementRevisionsByScope: { scope_default: 'revision_2' },
		};
		const documentBefore = structuredClone( document );
		const operationBefore = structuredClone( operation );

		reduceStatistics( document, operation );

		expect( document ).toEqual( documentBefore );
		expect( operation ).toEqual( operationBefore );
	} );

	it.each( [
		{ generationId: 'generation_old' },
		{ scopeId: 'scope_missing' },
		{ allowanceId: 'allowance_missing' },
	] )( 'discards stale finalization identity $generationId$scopeId$allowanceId', ( override ) => {
		const document = createMockStatisticsDocument();
		const operation = {
			type: 'finalize-active-allowance',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			finalizedAtEpochMilliseconds: 400_000,
			...override,
		};

		expect( reduceStatistics( document, operation ) ).toEqual( document );
	} );
} );
