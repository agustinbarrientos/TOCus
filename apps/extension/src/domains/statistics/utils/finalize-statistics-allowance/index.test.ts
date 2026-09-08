import { describe, expect, it } from 'vitest';
import { FinalizeActiveAllowanceOperationSchema } from '../../types/statistics-operation';
import { createMockActiveScopeStatistics } from '../../types/__fixtures__';
import {
	finalizeExpiredStatisticsAllowance,
	finalizeMatchingStatisticsAllowance,
} from './index';

describe( 'finalizeExpiredStatisticsAllowance', () => {
	it.each( [ 0, 10_000, 300_000, 360_000 ] )( 'retains the longest per-site visit after a %i ms visit', ( focusedUseMilliseconds ) => {
		const fixture = createMockActiveScopeStatistics();
		if ( fixture.activeAllowance === undefined ) {
			throw new Error( 'Expected an active allowance fixture.' );
		}
		const scope = {
			...fixture,
			longestVisitsBySite: { 'youtube.com': 300_000, 'github.com': 120_000 },
			activeAllowance: {
				...fixture.activeAllowance,
				expiresAtEpochMilliseconds: 460_000,
				accountedThroughEpochMilliseconds: 460_000,
				confirmedFocusedUseMilliseconds: focusedUseMilliseconds,
				focusedUseBySite: { 'youtube.com': focusedUseMilliseconds },
			},
		};

		expect( finalizeExpiredStatisticsAllowance( scope, 460_000 ) ).toMatchObject( {
			longestVisitsBySite: {
				'youtube.com': focusedUseMilliseconds === 360_000 ? 360_000 : 300_000,
				'github.com': 120_000,
			},
		} );
	} );

	it( 'keeps existing site maxima when a legacy allowance has no site attribution', () => {
		const scope = {
			...createMockActiveScopeStatistics(),
			longestVisitsBySite: { 'youtube.com': 300_000 },
		};

		expect( finalizeExpiredStatisticsAllowance( scope, 400_000 ) ).toMatchObject( {
			longestVisitsBySite: { 'youtube.com': 300_000 },
		} );
	} );

	it( 'keeps an active allowance before its expiry', () => {
		const scope = createMockActiveScopeStatistics();

		expect( finalizeExpiredStatisticsAllowance( scope, 399_999 ) ).toBe( scope );
	} );

	it( 'finalizes an expired allowance including a zero-use baseline', () => {
		const scope = createMockActiveScopeStatistics();

		expect( finalizeExpiredStatisticsAllowance( scope, 400_000 ) ).toEqual( {
			totals: scope.totals,
			hasFinalizedBaseline: true,
			currentMeasurementRevision: 'revision_1',
			latestBaseline: {
				measurementRevision: 'revision_1',
				focusedUseMilliseconds: 0,
			},
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
			hasFinalizedBaseline: true,
			currentMeasurementRevision: 'revision_1',
			latestBaseline: {
				measurementRevision: 'revision_1',
				focusedUseMilliseconds: 0,
			},
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
