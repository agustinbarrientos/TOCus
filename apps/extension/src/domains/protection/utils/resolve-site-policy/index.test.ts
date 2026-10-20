import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__';
import { ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
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


describe( 'main website coverage inheritance', () => {
	const broad: ProtectedSiteConfiguration = { identityHost: 'youtube.com', rule: root.rule };
	const exact: ProtectedSiteConfiguration = { ...broad, rule: { ...broad.rule, includeSubdomains: false },
		schedule: monday, timingConfiguration: customTiming };
	const broadTiming = { ...customTiming, initialWaitMilliseconds: 25_000 };
	const childTiming = { ...customTiming, initialWaitMilliseconds: 30_000 };
	const exactPath: ProtectedSiteConfiguration = { ...shorts,
		rule: { ...shorts.rule, includeSubdomains: false } };
	const studio: ProtectedSiteConfiguration = { identityHost: 'studio.youtube.com', rule: {
		...root.rule, host: 'studio.youtube.com', includeSubdomains: false,
	} };

	it.each( [ false, true ] )( 'keeps root policies independent with reversed storage order %s', ( reverse ) => {
		const roots = [ broad, exact ];
		if ( reverse ) {
			roots.reverse();
		}
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration, sites: roots,
		} );
		expect( resolveSitePolicy( configuration, broad.rule ) ).toEqual( {
			site: broad, schedule: configuration.schedule, timingConfiguration: configuration.timingConfiguration,
		} );
		expect( resolveSitePolicy( configuration, exact.rule ) ).toEqual( {
			site: exact, schedule: monday, timingConfiguration: customTiming,
		} );
		const match = matchProtectedUrl( 'https://www.youtube.com/', configuration.sites.map( ( site ) => site.rule ) );
		expect( match ).toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: broad.rule } );
		if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
			throw new Error( 'Expected descendant navigation to select the broad root.' );
		}
		expect( resolveSitePolicy( configuration, match.rule ) ).toEqual( {
			site: broad, schedule: configuration.schedule, timingConfiguration: configuration.timingConfiguration,
		} );
	} );

	it.each( [ false, true ] )( 'chooses the most specific covering root with reversed storage order %s', ( reverse ) => {
		const main = { ...broad, schedule: weekdays, timingConfiguration: broadTiming };
		const roots = [ main, exact ];
		if ( reverse ) {
			roots.reverse();
		}
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration, sites: [ ...roots, exactPath, shorts, studio ],
		} );
		expect( resolveSitePolicy( configuration, exactPath.rule ) ).toEqual( {
			site: exactPath, schedule: monday, timingConfiguration: customTiming,
		} );
		for ( const child of [ shorts, studio ] ) {
			expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
				site: child, schedule: weekdays, timingConfiguration: broadTiming,
			} );
		}
	} );

	it( 'uses globals outside exact-root coverage when no broad main website exists', () => {
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration, sites: [ exact, exactPath, shorts, studio ],
		} );
		expect( resolveSitePolicy( configuration, exactPath.rule ) ).toEqual( {
			site: exactPath, schedule: monday, timingConfiguration: customTiming,
		} );
		for ( const child of [ shorts, studio ] ) {
			expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
				site: child, schedule: configuration.schedule, timingConfiguration: configuration.timingConfiguration,
			} );
		}
	} );

	it( 'keeps explicit child fields independent from all root overrides', () => {
		const child = { ...shorts, schedule: weekdays, timingConfiguration: childTiming };
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			sites: [ { ...broad, schedule: monday, timingConfiguration: broadTiming }, exact, child ],
		} );
		expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
			site: child, schedule: weekdays, timingConfiguration: childTiming,
		} );
	} );

	it( 'resolves each field through only the selected covering root and then globals', () => {
		const exactMain = { ...broad, rule: exact.rule, schedule: monday };
		const broadMain = { ...broad, timingConfiguration: broadTiming };
		const explicitSchedule = { ...studio, schedule: weekdays };
		const explicitTiming = { ...shorts, rule: { ...shorts.rule, pathPrefix: '/feed' },
			timingConfiguration: childTiming };
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			sites: [ exactMain, broadMain, exactPath, shorts, explicitSchedule, explicitTiming ],
		} );
		for ( const child of [ exactMain, exactPath ] ) {
			expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
				site: child, schedule: monday, timingConfiguration: configuration.timingConfiguration,
			} );
		}
		for ( const child of [ broadMain, shorts ] ) {
			expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
				site: child, schedule: configuration.schedule, timingConfiguration: broadTiming,
			} );
		}
		expect( resolveSitePolicy( configuration, explicitSchedule.rule ) ).toEqual( {
			site: explicitSchedule, schedule: weekdays, timingConfiguration: broadTiming,
		} );
		expect( resolveSitePolicy( configuration, explicitTiming.rule ) ).toEqual( {
			site: explicitTiming, schedule: configuration.schedule, timingConfiguration: childTiming,
		} );
	} );
} );


describe( 'no-pause parent inheritance', () => {
	it.each( [
		{ ownTiming: false, ownSchedule: false },
		{ ownTiming: true, ownSchedule: false },
		{ ownTiming: false, ownSchedule: true },
		{ ownTiming: true, ownSchedule: true },
	] )( 'uses globals beyond only the child overrides: timing $ownTiming, schedule $ownSchedule', ( {
		ownTiming, ownSchedule,
	} ) => {
		const parent = { ...root, rule: { ...root.rule, behavior: 'allow' as const },
			schedule: monday, timingConfiguration: customTiming };
		const childTiming = { ...customTiming, initialWaitMilliseconds: 30_000 };
		const child = { ...shorts, ...( ownTiming ? { timingConfiguration: childTiming } : {} ),
			...( ownSchedule ? { schedule: weekdays } : {} ) };
		const configuration = { ...TestEmptyProtectionConfiguration, sites: [ parent, child ] };
		expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
			site: child,
			schedule: ownSchedule ? weekdays : configuration.schedule,
			timingConfiguration: ownTiming ? childTiming : configuration.timingConfiguration,
		} );
		expect( resolveSitePolicy( configuration, parent.rule ) ).toEqual( {
			site: parent, schedule: monday, timingConfiguration: customTiming,
		} );
		expect( parent.rule.behavior ).toBe( 'allow' );
	} );

	it.each( [ false, true ] )( 'does not fall through an allowed exact parent to a paused broad peer, reversed: %s', ( reverse ) => {
		const broad = { ...root, schedule: weekdays, timingConfiguration: customTiming };
		const exact = { ...root, identityHost: 'youtube.com', rule: { ...root.rule, includeSubdomains: false, behavior: 'allow' as const },
			schedule: monday, timingConfiguration: { ...customTiming, initialWaitMilliseconds: 30_000 } };
		const exactChild = { ...shorts, rule: { ...shorts.rule, includeSubdomains: false } };
		const parents = reverse ? [ exact, broad ] : [ broad, exact ];
		const configuration = { ...TestEmptyProtectionConfiguration, sites: [ ...parents, exactChild, shorts ] };
		expect( resolveSitePolicy( configuration, exactChild.rule ) ).toEqual( {
			site: exactChild, schedule: configuration.schedule, timingConfiguration: configuration.timingConfiguration,
		} );
		expect( resolveSitePolicy( configuration, shorts.rule ) ).toEqual( {
			site: shorts, schedule: weekdays, timingConfiguration: customTiming,
		} );
	} );

	it.each( [ false, true ] )( 'preserves an active exact parent beside an allowed broad peer, reversed: %s', ( reverse ) => {
		const broad = { ...root, rule: { ...root.rule, behavior: 'allow' as const },
			schedule: weekdays, timingConfiguration: customTiming };
		const exact = { ...root, identityHost: 'youtube.com', rule: { ...root.rule, includeSubdomains: false },
			schedule: monday, timingConfiguration: { ...customTiming, initialWaitMilliseconds: 30_000 } };
		const exactChild = { ...shorts, rule: { ...shorts.rule, includeSubdomains: false } };
		const parents = reverse ? [ exact, broad ] : [ broad, exact ];
		const configuration = { ...TestEmptyProtectionConfiguration, sites: [ ...parents, exactChild, shorts ] };
		expect( resolveSitePolicy( configuration, exactChild.rule ) ).toEqual( {
			site: exactChild, schedule: monday, timingConfiguration: exact.timingConfiguration,
		} );
		expect( resolveSitePolicy( configuration, shorts.rule ) ).toEqual( {
			site: shorts, schedule: configuration.schedule, timingConfiguration: configuration.timingConfiguration,
		} );
	} );

	it.each( [ 'allow', 'pause' ] as const )( 'resolves a product path through its own %s parent before the company root', ( behavior ) => {
		const company = { identityHost: 'google.com', rule: { host: 'google.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId }, schedule: weekdays, timingConfiguration: customTiming };
		const parent = { identityHost: 'mail.google.com', rule: { host: 'mail.google.com', includeSubdomains: false,
			scopeId: DefaultProtectionScopeId, behavior }, schedule: monday,
		timingConfiguration: { ...customTiming, initialWaitMilliseconds: 30_000 } };
		const child = { identityHost: parent.identityHost, rule: { host: parent.rule.host, includeSubdomains: false,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/inbox' } };
		for ( const parents of [ [ company, parent ], [ parent, company ] ] ) {
			const configuration = { ...TestEmptyProtectionConfiguration, sites: [ ...parents, child ] };
			expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
				site: child, schedule: behavior === 'allow' ? configuration.schedule : monday,
				timingConfiguration: behavior === 'allow' ? configuration.timingConfiguration : parent.timingConfiguration,
			} );
		}
	} );

	it( 'keeps company inheritance when an exact product root cannot cover a broad path', () => {
		const company = { identityHost: 'google.com', rule: { host: 'google.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId }, schedule: monday, timingConfiguration: customTiming };
		const parent = { identityHost: 'mail.google.com', rule: { host: 'mail.google.com', includeSubdomains: false,
			scopeId: DefaultProtectionScopeId, behavior: 'allow' as const } };
		const child = { identityHost: parent.identityHost, rule: { host: parent.rule.host, includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/inbox' } };
		const configuration = { ...TestEmptyProtectionConfiguration, sites: [ company, parent, child ] };
		expect( resolveSitePolicy( configuration, child.rule ) ).toEqual( {
			site: child, schedule: monday, timingConfiguration: customTiming,
		} );
	} );
} );
