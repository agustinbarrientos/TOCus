import { describe, expect, it } from 'vitest';
import { ResetStatisticsOperationSchema } from './statistics-operation';

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
