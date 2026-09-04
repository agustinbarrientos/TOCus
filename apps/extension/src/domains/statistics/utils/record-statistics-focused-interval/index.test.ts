import { describe, expect, it } from 'vitest';
import { createMockActiveStatisticsDocument } from '../../types/__fixtures__';
import { RecordFocusedIntervalOperationSchema } from '../../types/statistics-operation';
import { recordStatisticsFocusedInterval } from './index';

/**
 * Creates one valid focused-interval operation.
 * @return Focused-interval operation fixture.
 * @since 0.1.0 Initial implementation.
 */
function createFocusedIntervalOperation() {
	return RecordFocusedIntervalOperationSchema.parse( {
		type: 'record-focused-interval',
		generationId: 'generation_1',
		scopeId: 'scope_default',
		measurementRevision: 'revision_1',
		allowanceId: 'allowance_1',
		startedAtEpochMilliseconds: 120_000,
		endedAtEpochMilliseconds: 450_000,
	} );
}

describe( 'recordStatisticsFocusedInterval', () => {
	it( 'records only the unaccounted overlap within the allowance', () => {
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
				confirmedFocusedUseMilliseconds: 20_000,
				accountedThroughEpochMilliseconds: 150_000,
			},
		};
		const result = recordStatisticsFocusedInterval(
			document,
			createFocusedIntervalOperation(),
		);

		expect( result.scopes.scope_default?.activeAllowance ).toEqual( {
			...activeAllowance,
			confirmedFocusedUseMilliseconds: 270_000,
			accountedThroughEpochMilliseconds: 400_000,
		} );
	} );

	it( 'does not count an interval twice', () => {
		const operation = createFocusedIntervalOperation();
		const first = recordStatisticsFocusedInterval(
			createMockActiveStatisticsDocument(),
			operation,
		);

		expect( recordStatisticsFocusedInterval( first, operation ) ).toEqual( first );
	} );

	it.each( [
		{ generationId: 'generation_old' },
		{ scopeId: 'scope_missing' },
		{ measurementRevision: 'revision_old' },
		{ allowanceId: 'allowance_missing' },
	] )( 'discards stale interval identity $generationId$scopeId$measurementRevision$allowanceId', ( override ) => {
		const document = createMockActiveStatisticsDocument();
		const operation = RecordFocusedIntervalOperationSchema.parse( {
			...createFocusedIntervalOperation(),
			...override,
		} );

		expect( recordStatisticsFocusedInterval( document, operation ) ).toBe( document );
	} );

	it( 'discards an interval with no unaccounted allowance overlap', () => {
		const document = createMockActiveStatisticsDocument();
		const operation = RecordFocusedIntervalOperationSchema.parse( {
			...createFocusedIntervalOperation(),
			startedAtEpochMilliseconds: 400_000,
			endedAtEpochMilliseconds: 450_000,
		} );

		expect( recordStatisticsFocusedInterval( document, operation ) ).toBe( document );
	} );

	it( 'rejects a focused interval whose end precedes its start', () => {
		expect( () => RecordFocusedIntervalOperationSchema.parse( {
			...createFocusedIntervalOperation(),
			startedAtEpochMilliseconds: 200_000,
			endedAtEpochMilliseconds: 100_000,
		} ) ).toThrow();
	} );
} );
