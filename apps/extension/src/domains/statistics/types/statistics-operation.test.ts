import { describe, expect, it } from 'vitest';
import {
	RecordFocusedIntervalOperationSchema,
	ResetStatisticsOperationSchema,
	StatisticsOperationType,
} from './statistics-operation';

/**
 * Valid legacy focus interval without protected-site attribution.
 * @since 0.1.0 Initial implementation.
 */
const VALID_FOCUSED_INTERVAL = {
	type: StatisticsOperationType.RECORD_FOCUSED_INTERVAL,
	generationId: 'generation_1',
	scopeId: 'scope_default',
	measurementRevision: 'revision_1',
	allowanceId: 'allowance_1',
	startedAtEpochMilliseconds: 100_000,
	endedAtEpochMilliseconds: 150_000,
};

describe( 'RecordFocusedIntervalOperationSchema', () => {
	it( 'accepts intervals persisted before site attribution was available', () => {
		expect( RecordFocusedIntervalOperationSchema.parse( VALID_FOCUSED_INTERVAL ) ).toEqual(
			VALID_FOCUSED_INTERVAL,
		);
	} );

	it( 'retains the canonical protected-site host on a focused interval', () => {
		const interval = { ...VALID_FOCUSED_INTERVAL, siteHost: 'example.com' };

		expect( RecordFocusedIntervalOperationSchema.parse( interval ) ).toEqual( interval );
	} );

	it.each( [ 'https://example.com/path', 'Example.com', 'example.com/path' ] )(
		'rejects noncanonical site attribution %s',
		( siteHost ) => {
			expect( RecordFocusedIntervalOperationSchema.safeParse( {
				...VALID_FOCUSED_INTERVAL,
				siteHost,
			} ).success ).toBe( false );
		},
	);
} );

describe( 'StatisticsMeasurementRevisionsByScopeSchema', () => {
	it.each( [ 'not-a-record', null, [], new Date( 0 ) ] )(
		'rejects a non-plain measurement-revision record %#',
		( measurementRevisionsByScope ) => {
			expect( ResetStatisticsOperationSchema.safeParse( {
				type: 'reset',
				generationId: 'generation_2',
				measurementRevisionsByScope,
			} ).success ).toBe( false );
		},
	);

	it( 'parses a null-prototype measurement-revision record', () => {
		const measurementRevisionsByScope = Object.fromEntries( [
			[ '__proto__', 'revision_magic' ],
		] );

		Reflect.setPrototypeOf( measurementRevisionsByScope, null );

		const result = ResetStatisticsOperationSchema.parse( {
			type: 'reset',
			generationId: 'generation_2',
			measurementRevisionsByScope,
		} );

		expect( Object.hasOwn( result.measurementRevisionsByScope, '__proto__' ) ).toBe( true );
	} );
} );
