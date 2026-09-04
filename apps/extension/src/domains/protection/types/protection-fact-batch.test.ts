import { describe, expect, it } from 'vitest';
import { ProtectionFactBatchSchema } from './protection-fact-batch';

/**
 * Valid same-scope protection fact-batch fixture.
 * @since 0.1.0 Initial implementation.
 */
const VALID_BATCH = {
	batchId: 'batch_1',
	scopeId: 'scope_default',
	measurementRevision: 'revision_1',
	observedAtEpochMilliseconds: 1_000,
	facts: [
		{
			type: 'reconsidered-visit',
			factId: 'fact_1',
			scopeId: 'scope_default',
			waitId: 'wait_1',
			participantId: 'participant_1',
			departureCause: 'active-session-tab-close',
			observedAtEpochMilliseconds: 1_000,
		},
	],
};

describe( 'ProtectionFactBatchSchema', () => {
	it( 'parses one non-empty same-scope fact batch', () => {
		expect( ProtectionFactBatchSchema.parse( VALID_BATCH ) ).toEqual( VALID_BATCH );
	} );

	it( 'rejects a fact from a different scope', () => {
		const result = ProtectionFactBatchSchema.safeParse( {
			...VALID_BATCH,
			facts: [ {
				...VALID_BATCH.facts[ 0 ],
				scopeId: 'scope_other',
			} ],
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'rejects duplicate fact identifiers', () => {
		const result = ProtectionFactBatchSchema.safeParse( {
			...VALID_BATCH,
			facts: [ VALID_BATCH.facts[ 0 ], VALID_BATCH.facts[ 0 ] ],
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'rejects a fact captured at a different observation time', () => {
		const result = ProtectionFactBatchSchema.safeParse( {
			...VALID_BATCH,
			observedAtEpochMilliseconds: 2_000,
		} );

		expect( result.success ).toBe( false );
	} );

	it.each( [ '__proto__', 'constructor', 'toString' ] )(
		'preserves the supported object-property scope identifier %s',
		( scopeId ) => {
			const result = ProtectionFactBatchSchema.safeParse( {
				...VALID_BATCH,
				scopeId,
				facts: [ { ...VALID_BATCH.facts[ 0 ], scopeId } ],
			} );

			expect( result.success ).toBe( true );
		},
	);
} );
