import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__';
import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { ScheduleMode, Weekday } from '../../types/protection-schedule';
import { matchProtectedUrl } from '../protected-url-matcher';
import { evaluateSchedule } from '../schedule-evaluator';
import { resolveSitePolicy } from './index';

const root = { identityHost: 'studio.youtube.com', rule: {
	host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId,
} };
const shorts = { identityHost: 'youtube.com', rule: { ...root.rule, pathPrefix: '/shorts' } };
const monday = { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 0, endMinute: 1440 } ] };
const weekdays = { mode: ScheduleMode.CUSTOM, windows: [
	Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY,
].map( ( weekday ) => ( { weekday, startMinute: 0, endMinute: 1440 } ) ) };
const customTiming = { ...TestEmptyProtectionConfiguration.timingConfiguration, initialWaitMilliseconds: 20_000 };

describe( 'resolveSitePolicy', () => {
	it( 'selects the Monday-only Shorts schedule before evaluating an active weekday parent', () => {
		const configuration = {
			...TestEmptyProtectionConfiguration,
			sites: [ { ...root, schedule: weekdays }, { ...shorts, schedule: monday } ],
		};
		const match = matchProtectedUrl(
			'https://www.youtube.com/shorts/123', configuration.sites.map( ( site ) => site.rule ),
		);
		expect( match ).toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: shorts.rule } );
		if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
			throw new Error( 'Expected Shorts target.' );
		}
		const policy = resolveSitePolicy( configuration, match.rule );
		expect( policy?.schedule ).toEqual( monday );
		expect( evaluateSchedule( policy?.schedule, Date.parse( '2026-10-19T12:00:00Z' ), 'UTC' ) )
			.toEqual( { status: ScheduleEvaluationStatus.ACTIVE } );
		expect( evaluateSchedule( policy?.schedule, Date.parse( '2026-10-20T12:00:00Z' ), 'UTC' ) )
			.toEqual( { status: ScheduleEvaluationStatus.INACTIVE } );
		expect( evaluateSchedule( weekdays, Date.parse( '2026-10-20T12:00:00Z' ), 'UTC' ) )
			.toEqual( { status: ScheduleEvaluationStatus.ACTIVE } );
	} );

	it( 'inherits main website timing and schedule while preserving legacy identity coverage', () => {
		const main = { ...root, timingConfiguration: customTiming, schedule: monday };
		const configuration = {
			...TestEmptyProtectionConfiguration, sites: [ shorts, main ],
		};
		expect( resolveSitePolicy( configuration, shorts.rule ) ).toEqual( {
			site: shorts, schedule: monday, timingConfiguration: customTiming,
		} );
		expect( resolveSitePolicy( configuration, main.rule )?.timingConfiguration ).toEqual( customTiming );
	} );

	it( 'keeps explicit child policy independent from changed main website and global values', () => {
		const child = { ...shorts, timingConfiguration: customTiming, schedule: monday };
		const configuration = {
			...TestEmptyProtectionConfiguration, sites: [ { ...root, schedule: weekdays }, child ],
		};
		expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
			site: child, schedule: monday, timingConfiguration: customTiming,
		} );
	} );

	it( 'uses global policy for path-only groups without inheriting an intermediate path', () => {
		const nested = { ...shorts, rule: { ...shorts.rule, pathPrefix: '/shorts/saved' } };
		const configuration = {
			...TestEmptyProtectionConfiguration,
			sites: [ { ...shorts, schedule: monday, timingConfiguration: customTiming }, nested ],
		};
		expect( resolveSitePolicy( configuration, nested.rule ) ).toEqual( {
			site: nested, schedule: configuration.schedule, timingConfiguration: configuration.timingConfiguration,
		} );
		expect( matchProtectedUrl( 'https://youtube.com/', configuration.sites.map( ( site ) => site.rule ) ) )
			.toEqual( { status: ProtectedUrlMatchStatus.UNPROTECTED } );
	} );

	it( 'resolves subdomains through the main root and returns undefined for removed targets', () => {
		const studio: ProtectedSiteConfiguration = { identityHost: 'studio.youtube.com', rule: {
			...root.rule, host: 'studio.youtube.com', includeSubdomains: false, behavior: 'allow',
		} };
		const configuration = {
			...TestEmptyProtectionConfiguration, sites: [ { ...root, timingConfiguration: customTiming }, studio ],
		};
		expect( resolveSitePolicy( configuration, studio.rule )?.timingConfiguration ).toEqual( customTiming );
		expect( resolveSitePolicy( configuration, shorts.rule ) ).toBeUndefined();
	} );
} );


it( 'inherits a main website with legacy exact host coverage', () => {
	const main = { ...root, identityHost: 'youtube.com',
		rule: { ...root.rule, includeSubdomains: false }, timingConfiguration: customTiming };
	const child = { ...shorts, rule: { ...shorts.rule, includeSubdomains: false } };
	const configuration = { ...TestEmptyProtectionConfiguration, sites: [ main, child ] };
	expect( resolveSitePolicy( configuration, child.rule )?.timingConfiguration ).toEqual( customTiming );
} );
