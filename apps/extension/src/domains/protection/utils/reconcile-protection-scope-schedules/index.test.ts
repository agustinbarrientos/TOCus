import { describe, expect, it } from 'vitest';
import { reconcileProtectionScopeSchedules } from './index';
import {
	ScheduleMode,
	Weekday,
	type NormalizedSchedule,
} from '../../types/protection-schedule';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../types/protection-value';
import { type ProtectedSiteConfigurationSet } from '../../types/protected-site-configuration';

/**
 * Independent protection scope used by schedule reconciliation fixtures.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_independent' );

/**
 * Site assigned to the shared default protection scope.
 * @since 0.1.0 Initial implementation.
 */
const SHARED_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'x.com',
	rule: {
		host: 'x.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
/**
 * Site assigned to the independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};
/**
 * Second site assigned to the same independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
const SECOND_INDEPENDENT_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'youtu.be',
	rule: {
		host: 'youtu.be',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};
/**
 * Custom schedule retained by reconciliation fixtures.
 * @since 0.1.0 Initial implementation.
 */
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

	it.each( [ '__proto__', 'constructor', 'toString', 'hasOwnProperty' ] )(
		'creates an Always schedule for a newly referenced prototype-named scope %s',
		( rawScopeId ) => {
			const scopeId = ProtectionScopeIdSchema.parse( rawScopeId );
			const schedulesByScope = reconcileProtectionScopeSchedules(
				[ {
					identityHost: 'youtube.com',
					rule: {
						host: 'youtube.com',
						includeSubdomains: true,
						scopeId,
					},
				} ],
				{ [ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE },
			);

			expect( schedulesByScope ).toEqual( {
				[ DefaultProtectionScopeId ]: CUSTOM_SCHEDULE,
				[ scopeId ]: { mode: ScheduleMode.ALWAYS },
			} );
			expect( Object.hasOwn( schedulesByScope, scopeId ) ).toBe( true );
		},
	);

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
