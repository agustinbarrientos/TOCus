import { describe, expect, it } from 'vitest';
import { ProtectionFactSchema } from './protection-fact';

const reconsidered = {
	type: 'reconsidered-visit', factId: 'fact_reconsidered', scopeId: 'scope_default',
	waitId: 'wait_1', participantId: 'participant_1', departureCause: 'back',
	allowanceDurationMilliseconds: 120_000, observedAtEpochMilliseconds: 1_800_000_000_000,
};
const continued = {
	type: 'continued-visit', factId: 'fact_continued', scopeId: 'scope_default',
	allowanceId: 'allowance_1', participantId: 'participant_1', pageId: 'page_1',
	siteHost: 'example.com', observedLocalHour: 0, observedAtEpochMilliseconds: 1_800_000_000_000,
};

describe( 'website outcome facts', () => {
	it( 'accepts legacy reconsiderations and paired configured-site attribution', () => {
		expect( ProtectionFactSchema.safeParse( reconsidered ).success ).toBe( true );
		expect( ProtectionFactSchema.safeParse( { ...reconsidered,
			siteHost: 'example.com', observedLocalHour: 23 } ).success ).toBe( true );
	} );
	it( 'accepts a continued participant with a configured host and captured local hour', () => {
		expect( ProtectionFactSchema.safeParse( continued ).success ).toBe( true );
	} );
	it.each( [ -1, 24, 1.5, NaN, '12' ] )( 'rejects invalid outcome hour %s', ( hour ) => {
		expect( ProtectionFactSchema.safeParse( { ...continued, observedLocalHour: hour } ).success ).toBe( false );
		expect( ProtectionFactSchema.safeParse( { ...reconsidered,
			siteHost: 'example.com', observedLocalHour: hour } ).success ).toBe( false );
	} );
	it.each( [ { siteHost: 'example.com' }, { observedLocalHour: 12 } ] )(
		'rejects incomplete reconsideration attribution %j', ( attribution ) => {
			expect( ProtectionFactSchema.safeParse( { ...reconsidered, ...attribution } ).success ).toBe( false );
		},
	);
	it.each( [ 'https://example.com/', 'example.com/path', 'EXAMPLE.COM' ] )(
		'rejects a noncanonical configured host %s', ( siteHost ) => {
			expect( ProtectionFactSchema.safeParse( { ...continued, siteHost } ).success ).toBe( false );
		},
	);
} );
