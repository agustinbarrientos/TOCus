import { describe, expect, it } from 'vitest';
import { createDeparture, createReadyContinuation } from './__fixtures__/protection-event';
import { DepartureCause, ProtectionEventSchema } from './protection-event';

describe( 'fact-producing event calendar attribution', () => {
	it.each( [ createDeparture( DepartureCause.ACTIVE_SESSION_TAB_CLOSE ), createReadyContinuation() ] )( 'requires the captured date on $type', ( event ) => {
		const missingDate = { ...event };
		Reflect.deleteProperty( missingDate, 'observedLocalDate' );

		expect( ProtectionEventSchema.safeParse( missingDate ).success ).toBe( false );
		expect( ProtectionEventSchema.safeParse( { ...event, observedLocalDate: '2026-09-14' } ).success ).toBe( true );
		expect( ProtectionEventSchema.safeParse( { ...event, observedLocalDate: '2026-02-30' } ).success ).toBe( false );
	} );
} );
