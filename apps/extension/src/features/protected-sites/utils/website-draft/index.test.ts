import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { DefaultTimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import { createWebsiteDraft, serializeWebsiteDraft } from './index';

describe( 'website details draft', () => {
	it( 'keeps sibling policy details separate and retains timing and no-pause during unrelated edits', () => {
		const root = { identityHost: 'youtube.com', rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
		const child = { ...root, rule: { ...root.rule, pathPrefix: '/shorts', behavior: 'allow' as const }, timingConfiguration: DefaultTimingConfiguration };
		const draft = createWebsiteDraft( [ root, child ] );
		expect( Object.keys( draft.detailsByRuleKey ) ).toHaveLength( 2 );
		const rootDetails = draft.detailsByRuleKey[ getProtectedSiteRuleKey( root.rule ) ];
		if ( ! rootDetails ) {
			throw new Error( 'The root must own draft details.' );
		}
		rootDetails.displayName = 'Videos';
		expect( serializeWebsiteDraft( draft )[ 1 ] ).toEqual( child );
	} );

	it( 'keeps incomplete schedules editable and rejects persistence until their fields are complete', () => {
		const draft = createWebsiteDraft( [ { identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } } ] );
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } ) ] = { behavior: 'pause', timingConfiguration: null, displayName: '', schedule: { mode: ScheduleMode.CUSTOM,
			windows: [ { id: 0, weekday: Weekday.MONDAY, start: '', end: '', fullDay: false } ] } };
		expect( () => serializeWebsiteDraft( draft ) ).toThrow();
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } ) ] = {
			behavior: 'pause', timingConfiguration: null, displayName: '', schedule: { mode: ScheduleMode.CUSTOM,
				windows: [ { id: 0, weekday: Weekday.MONDAY, start: '09:00', end: '17:00', fullDay: false } ] },
		};
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ {
			identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
			schedule: { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 540,
				endMinute: 1020 } ] },
		} ] );
	} );

	it( 'clears the custom schedule and name without changing the shared matching rule', () => {
		const draft = createWebsiteDraft( [ { identityHost: 'example.com', displayNameOverride: 'Reading',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
			schedule: { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.FRIDAY, startMinute: 540,
				endMinute: 1020 } ] } } ] );
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } ) ] = { displayName: '  ', schedule: null, behavior: 'pause', timingConfiguration: null };
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ {
			identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId },
		} ] );
	} );
} );

describe( 'complete website policies', () => {
	it( 'clears explicit timing and no-pause behavior while retaining the exact stored target', () => {
		const site = { identityHost: 'studio.youtube.com', rule: { host: 'youtube.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts', behavior: 'allow' as const },
		timingConfiguration: DefaultTimingConfiguration };
		const draft = createWebsiteDraft( [ site ] );
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( site.rule ) ] = {
			displayName: '', schedule: null, behavior: 'pause', timingConfiguration: null,
		};
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ { identityHost: 'studio.youtube.com',
			rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts' } } ] );
	} );

	it( 'retains a site policy when its editable details are absent', () => {
		const site = { identityHost: 'youtube.com', rule: { host: 'youtube.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts', behavior: 'allow' as const },
		timingConfiguration: DefaultTimingConfiguration };
		const draft = createWebsiteDraft( [ site ] );
		draft.detailsByRuleKey = {};
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ site ] );
	} );
} );
