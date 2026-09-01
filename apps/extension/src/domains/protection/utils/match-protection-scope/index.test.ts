import { describe, expect, it } from 'vitest';
import { ProtectionScopeIdSchema } from '../../types/protection-value';
import {
	ProtectedUrlMatchResultSchema,
	ProtectedUrlMatchStatus,
} from '../../types/protected-url-match';
import { protectionMatchProtectsScope } from './index';

describe( 'protectionMatchProtectsScope', () => {
	it( 'matches only a Protected result owned by the requested scope', () => {
		const match = ProtectedUrlMatchResultSchema.parse( {
			status: ProtectedUrlMatchStatus.PROTECTED,
			rule: {
				host: 'example.com',
				includeSubdomains: true,
				scopeId: 'scope-a',
			},
		} );

		expect( protectionMatchProtectsScope(
			match,
			ProtectionScopeIdSchema.parse( 'scope-a' ),
		) ).toBe( true );
		expect( protectionMatchProtectsScope(
			match,
			ProtectionScopeIdSchema.parse( 'scope-b' ),
		) ).toBe( false );
	} );

	it.each( [
		{ status: ProtectedUrlMatchStatus.UNPROTECTED },
		{
			status: ProtectedUrlMatchStatus.UNSUPPORTED,
			reason: 'unsupported-scheme',
		},
	] )( 'rejects a $status result', ( input ) => {
		expect( protectionMatchProtectsScope(
			ProtectedUrlMatchResultSchema.parse( input ),
			ProtectionScopeIdSchema.parse( 'scope-a' ),
		) ).toBe( false );
	} );
} );
