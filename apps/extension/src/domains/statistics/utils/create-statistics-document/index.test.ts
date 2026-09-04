import { describe, expect, it } from 'vitest';
import { ProtectionMeasurementRevisionSchema } from '../../../protection/types/protection-value';
import {
	createEmptyScopeStatistics,
	createEmptyStatisticsTotals,
	createStatisticsDocument,
} from './index';

describe( 'createStatisticsDocument', () => {
	it( 'creates an empty aggregate document with the supplied generation', () => {
		expect( createStatisticsDocument( 'generation_1' ) ).toEqual( {
			schemaVersion: 1,
			generationId: 'generation_1',
			lastAppliedBatchId: null,
			scopes: {},
		} );
	} );

	it( 'validates the injected generation before creating a document', () => {
		expect( () => createStatisticsDocument( 'invalid generation' ) ).toThrow();
	} );

	it( 'returns independent scope collections', () => {
		const first = createStatisticsDocument( 'generation_1' );
		const second = createStatisticsDocument( 'generation_2' );

		expect( first.scopes ).not.toBe( second.scopes );
	} );

	it( 'creates zero totals and current or historical scope state', () => {
		const totals = {
			estimatedReclaimedMilliseconds: 0,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		};

		expect( createEmptyStatisticsTotals() ).toEqual( totals );
		expect( createEmptyScopeStatistics() ).toEqual( { totals } );
		expect( createEmptyScopeStatistics(
			ProtectionMeasurementRevisionSchema.parse( 'revision_1' ),
		) ).toEqual( {
			totals,
			currentMeasurementRevision: 'revision_1',
		} );
	} );
} );
