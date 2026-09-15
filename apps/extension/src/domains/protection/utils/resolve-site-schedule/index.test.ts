import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { ScheduleMode, Weekday } from '../../types/protection-schedule';
import { resolveSiteSchedule } from './index';

describe( 'resolveSiteSchedule', () => {
	const site = { identityHost: 'www.example.com',
		rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
	it( 'uses the global active hours when the configured matching rule has no override', () => {
		expect( resolveSiteSchedule( { ...TestEmptyProtectionConfiguration, sites: [ site ] }, 'example.com' ) )
			.toEqual( TestEmptyProtectionConfiguration.schedule );
	} );
	it( 'uses a site override without changing global hours or timer ownership', () => {
		const schedule = { mode: ScheduleMode.CUSTOM,
			windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 600 } ] };
		const configuration = { ...TestEmptyProtectionConfiguration, sites: [ { ...site, schedule } ] };
		expect( resolveSiteSchedule( configuration, 'example.com' ) ).toEqual( schedule );
		expect( configuration.schedule ).toEqual( TestEmptyProtectionConfiguration.schedule );
		expect( configuration.sites[ 0 ]?.rule.scopeId ).toBe( DefaultProtectionScopeId );
	} );
	it( 'does not fall back to global protection after a matching rule has been removed', () => {
		expect( resolveSiteSchedule( TestEmptyProtectionConfiguration, 'example.com' ) ).toBeUndefined();
	} );
} );
