import { describe, expect, it } from 'vitest';
import {
	StatisticsRuntimeRequestSchema,
	StatisticsRuntimeRequestType,
} from './runtime-message';

describe( 'StatisticsRuntimeRequestSchema', () => {
	it( 'parses every supported statistics command', () => {
		expect( StatisticsRuntimeRequestSchema.parse( {
			type: StatisticsRuntimeRequestType.READ_STATISTICS,
		} ) ).toEqual( { type: 'read-statistics' } );
		expect( StatisticsRuntimeRequestSchema.parse( {
			type: StatisticsRuntimeRequestType.RESET_STATISTICS,
		} ) ).toEqual( { type: 'reset-statistics' } );
	} );

	it.each( [
		'prepare-scope-statistics-deletion',
		'cancel-scope-statistics-deletion',
		'delete-scope-statistics',
	] )( 'rejects the removed %s command', ( type ) => {
		expect( StatisticsRuntimeRequestSchema.safeParse( {
			type,
			scopeId: 'scope_example',
		} ).success ).toBe( false );
	} );

	it( 'rejects unsupported commands and additional request data', () => {
		expect( StatisticsRuntimeRequestSchema.safeParse( {
			type: 'delete-statistics',
		} ).success ).toBe( false );
		expect( StatisticsRuntimeRequestSchema.safeParse( {
			type: StatisticsRuntimeRequestType.READ_STATISTICS,
			unexpected: true,
		} ).success ).toBe( false );
	} );
} );
