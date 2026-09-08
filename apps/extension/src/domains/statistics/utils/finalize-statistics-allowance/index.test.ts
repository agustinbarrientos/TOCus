import { describe, expect, it } from 'vitest';
import { FinalizeActiveAllowanceOperationSchema } from '../../types/statistics-operation';
import { createMockActiveScopeStatistics } from '../../types/__fixtures__';
import {
	finalizeExpiredStatisticsAllowance,
	finalizeMatchingStatisticsAllowance,
} from './index';

describe( 'finalizeExpiredStatisticsAllowance', () => {
	it.each( [ 0, 10_000, 300_000, 360_000 ] )( 'clears measurement after a %i ms visit without changing totals', ( focusedUseMilliseconds ) => {
		const fixture = createMockActiveScopeStatistics();
		if ( fixture.activeAllowance === undefined ) {
			throw new Error( 'Expected an active allowance fixture.' );
		}
		const scope = {
			...fixture,
			activeAllowance: {
				...fixture.activeAllowance,
				expiresAtEpochMilliseconds: 460_000,
				accountedThroughEpochMilliseconds: 460_000,
				confirmedFocusedUseMilliseconds: focusedUseMilliseconds,
			},
		};

		expect( finalizeExpiredStatisticsAllowance( scope, 460_000 ) ).toEqual( {
			totals: scope.totals,
			currentMeasurementRevision: 'revision_1',
		} );
	} );

	it( 'does not change a scope after its allowance has already been finalized', () => {
		const scope = finalizeExpiredStatisticsAllowance( createMockActiveScopeStatistics(), 400_000 );
		expect( finalizeExpiredStatisticsAllowance( scope, 500_000 ) ).toBe( scope );
	} );

	it( 'keeps an active allowance before its expiry', () => {
		const scope = createMockActiveScopeStatistics();

		expect( finalizeExpiredStatisticsAllowance( scope, 399_999 ) ).toBe( scope );
	} );

	it( 'finalizes an expired allowance with no recorded use', () => {
		const scope = createMockActiveScopeStatistics();

		expect( finalizeExpiredStatisticsAllowance( scope, 400_000 ) ).toEqual( {
			totals: scope.totals,
			currentMeasurementRevision: 'revision_1',
		} );
		expect( Object.hasOwn(
			finalizeExpiredStatisticsAllowance( scope, 400_000 ),
			'activeAllowance',
		) ).toBe( false );
	} );
} );

describe( 'finalizeMatchingStatisticsAllowance', () => {
	it( 'finalizes one matching allowance after expiry', () => {
		const scope = createMockActiveScopeStatistics();
		const operation = FinalizeActiveAllowanceOperationSchema.parse( {
			type: 'finalize-active-allowance',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			finalizedAtEpochMilliseconds: 400_000,
		} );

		expect( finalizeMatchingStatisticsAllowance( scope, operation ) ).toEqual( {
			totals: scope.totals,
			currentMeasurementRevision: 'revision_1',
		} );
	} );

	it( 'discards stale allowance identity', () => {
		const scope = createMockActiveScopeStatistics();
		const operation = FinalizeActiveAllowanceOperationSchema.parse( {
			type: 'finalize-active-allowance',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_other',
			finalizedAtEpochMilliseconds: 400_000,
		} );

		expect( finalizeMatchingStatisticsAllowance( scope, operation ) ).toBe( scope );
	} );

	it( 'rejects matching finalization before expiry', () => {
		const scope = createMockActiveScopeStatistics();
		const operation = FinalizeActiveAllowanceOperationSchema.parse( {
			type: 'finalize-active-allowance',
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			finalizedAtEpochMilliseconds: 399_999,
		} );

		expect( () => finalizeMatchingStatisticsAllowance( scope, operation ) ).toThrow( RangeError );
	} );
} );
