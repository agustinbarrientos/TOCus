import { describe, expect, it } from 'vitest';
import { createMockStatisticsDocument } from '../../types/__fixtures__';
import { StatisticsDocumentSchema } from '../../types/statistics-document';
import { ResetStatisticsOperationSchema } from '../../types/statistics-operation';
import { projectStatistics } from '../project-statistics';
import { resetStatistics } from './index';

describe( 'resetStatistics', () => {
	it( 'clears all statistics under a fresh generation and current revision map', () => {
		const document = StatisticsDocumentSchema.parse( {
			...createMockStatisticsDocument(),
			lastAppliedBatchId: 'batch_last',
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
			},
		} );
		const operation = ResetStatisticsOperationSchema.parse( {
			type: 'reset',
			generationId: 'generation_2',
			measurementRevisionsByScope: {
				scope_default: 'revision_1',
				scope_other: 'revision_other',
			},
		} );

		expect( resetStatistics( document, operation ) ).toEqual( {
			schemaVersion: 1,
			generationId: 'generation_2',
			lastAppliedBatchId: 'batch_last',
			scopes: {
				scope_default: {
					totals: {
						estimatedReclaimedMilliseconds: 0,
						focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 0,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
					currentMeasurementRevision: 'revision_1',
				},
				scope_other: {
					totals: {
						estimatedReclaimedMilliseconds: 0,
						focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 0,
						completedWaitCount: 0,
						allowanceGrantedCount: 0,
					},
					currentMeasurementRevision: 'revision_other',
				},
			},
		} );
	} );

	it( 'rejects reset without a fresh generation', () => {
		const document = createMockStatisticsDocument();
		const operation = ResetStatisticsOperationSchema.parse( {
			type: 'reset',
			generationId: 'generation_1',
			measurementRevisionsByScope: { scope_default: 'revision_1' },
		} );

		expect( () => resetStatistics( document, operation ) ).toThrow( RangeError );
	} );

	it( 'clears finalized-baseline provenance', () => {
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
		const operation = ResetStatisticsOperationSchema.parse( {
			type: 'reset',
			generationId: 'generation_2',
			measurementRevisionsByScope: { scope_default: 'revision_1' },
		} );
		const result = resetStatistics( document, operation );

		expect( result.scopes.scope_default ).not.toHaveProperty( 'hasFinalizedBaseline' );
		expect( projectStatistics( result ) ).toMatchObject( {
			status: 'available',
			estimatedReclaimedMilliseconds: null,
		} );
	} );

	it( 'rebuilds a current scope safely under the supported __proto__ key', () => {
		const document = createMockStatisticsDocument();
		const operation = ResetStatisticsOperationSchema.parse( {
			type: 'reset',
			generationId: 'generation_2',
			measurementRevisionsByScope: Object.fromEntries( [ [ '__proto__', 'revision_magic' ] ] ),
		} );
		const result = resetStatistics( document, operation );

		expect( Object.hasOwn( result.scopes, '__proto__' ) ).toBe( true );
		expect( result.scopes.__proto__?.currentMeasurementRevision ).toBe( 'revision_magic' );
	} );
} );
