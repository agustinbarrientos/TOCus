import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { createWebsiteDraft, serializeWebsiteDraft } from './index';

describe( 'website details draft', () => {
	it( 'keeps incomplete schedules editable and rejects persistence until their fields are complete', () => {
		const draft = createWebsiteDraft( [ { identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } } ] );
		draft.detailsByHost[ 'example.com' ] = { displayName: '', schedule: { mode: ScheduleMode.CUSTOM,
			windows: [ { id: 0, weekday: Weekday.MONDAY, start: '', end: '', fullDay: false } ] } };
		expect( () => serializeWebsiteDraft( draft ) ).toThrow();
		draft.detailsByHost[ 'example.com' ] = {
			displayName: '', schedule: { mode: ScheduleMode.CUSTOM,
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
		draft.detailsByHost[ 'example.com' ] = { displayName: '  ', schedule: null };
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ {
			identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId },
		} ] );
	} );
} );
