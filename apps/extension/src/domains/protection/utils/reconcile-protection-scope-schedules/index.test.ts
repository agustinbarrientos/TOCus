import { describe, expect, it } from 'vitest';
import { reconcileProtectionScopeSchedules } from './index';
import {
	ScheduleMode,
	Weekday,
	type NormalizedSchedule,
} from '../../types/protection-schedule';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../types/protection-value';
import { type ProtectedSiteConfigurationSet } from '../../types/protected-site-configuration';

const INDEPENDENT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_independent' );
const SHARED_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'x.com',
	rule: {
		host: 'x.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
const INDEPENDENT_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};
const SECOND_INDEPENDENT_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'youtu.be',
	rule: {
		host: 'youtu.be',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};
const CUSTOM_SCHEDULE: NormalizedSchedule = {
	mode: ScheduleMode.CUSTOM,
	windows: [ {
		weekday: Weekday.MONDAY,
		startMinute: 540,
		endMinute: 1_020,
	} ],
};

describe( 'reconcileProtectionScopeSchedules', () => {
	it( 'retains schedules for the shared scope and every referenced independent scope', () => {
		expect( reconcileProtectionScopeSchedules(
			[ SHARED_SITE, INDEPENDENT_SITE ],
			{
				[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
				[ INDEPENDENT_SCOPE_ID ]: CUSTOM_SCHEDULE,
			},
		) ).toEqual( {
			[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
			[ INDEPENDENT_SCOPE_ID ]: CUSTOM_SCHEDULE,
		} );
	} );

	it( 'creates an Always schedule for a newly referenced scope', () => {
		expect( reconcileProtectionScopeSchedules(
			[ INDEPENDENT_SITE ],
			{ [ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE },
		) ).toEqual( {
			[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
			[ INDEPENDENT_SCOPE_ID ]: { mode: ScheduleMode.ALWAYS },
		} );
	} );

	it( 'removes schedules whose independent scope is no longer referenced', () => {
		expect( reconcileProtectionScopeSchedules(
			[],
			{
				[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
				[ INDEPENDENT_SCOPE_ID ]: CUSTOM_SCHEDULE,
			},
		) ).toEqual( {
			[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
		} );
	} );

	it( 'retains an independent schedule until its final site reference is removed', () => {
		expect( reconcileProtectionScopeSchedules(
			[ SECOND_INDEPENDENT_SITE ],
			{
				[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
				[ INDEPENDENT_SCOPE_ID ]: CUSTOM_SCHEDULE,
			},
		) ).toEqual( {
			[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
			[ INDEPENDENT_SCOPE_ID ]: CUSTOM_SCHEDULE,
		} );
	} );
} );
