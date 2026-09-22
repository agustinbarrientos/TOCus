import { describe, expect, it } from 'vitest';
import type { Browser } from 'wxt/browser';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import type { ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	AllowanceProtectionStateSchema,
	ProtectionStateType,
} from '../../../../domains/protection/types/protection-state';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { createNavigationRuleReconciler } from './index';

/** Protected-site configuration used by navigation-rule fixtures. */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
	} ],
};

/** Trusted packaged interruption page used by redirect fixtures. */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/pause.html';

describe( 'createNavigationRuleReconciler', () => {
	it( 'uses website schedules independently while one browsing allowance covers both websites', async () => {
		let rules: Browser.declarativeNetRequest.Rule[] = [];
		let now = Date.UTC( 2026, 8, 14, 9 );
		const reconciler = createNavigationRuleReconciler( {
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Retains the emitted browser redirects.
			 * @param nextRules - Dynamic browser redirects to install.
			 * @return Resolved browser mutation.
			 */
			replaceNavigationRules: ( nextRules ) => {
				rules = nextRules; return Promise.resolve();
			},
			/**
			 * Returns the deterministic time zone.
			 * @return Test time zone.
			 */
			getTimeZone: () => 'UTC',
			/**
			 * Returns the mutable schedule instant.
			 * @return Test wall-clock instant.
			 */
			now: () => now,
		} );
		const configuration = {
			...CONFIGURATION,
			sites: [ ...CONFIGURATION.sites, {
				identityHost: 'second.test',
				rule: { host: 'second.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
				schedule: { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 600,
					endMinute: 660 } ] },
			} ],
		};

		await reconciler.reconcile( configuration, {} );
		expect( rules ).toHaveLength( 1 );
		now = Date.UTC( 2026, 8, 14, 10 );
		await reconciler.reconcile( configuration, {} );
		expect( rules ).toHaveLength( 1 );
		expect( rules[ 0 ]?.action ).toEqual( {
			type: 'redirect',
			redirect: { regexSubstitution: `${ INTERRUPTION_PAGE_URL }#destination=\\0` },
		} );
		expect( rules[ 0 ]?.condition.requestDomains ).toEqual( [ 'example.com', 'second.test' ] );
		const allowance = AllowanceProtectionStateSchema.parse( {
			type: ProtectionStateType.ALLOWANCE, scopeId: DefaultProtectionScopeId,
			allowanceId: 'allowance_shared', completedWaitId: null,
			startedAtEpochMilliseconds: now, expiresAtEpochMilliseconds: now + 300_000,
			readyParticipants: [], ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-09-14' },
		} );
		await reconciler.reconcile( configuration, { [ DefaultProtectionScopeId ]: allowance } );
		expect( rules ).toEqual( [] );
		now += 300_000;
		await reconciler.reconcile( configuration, { [ DefaultProtectionScopeId ]: allowance } );
		expect( rules ).toHaveLength( 1 );
	} );
	it( 'keeps scheduled rules active outside an allowance', async () => {
		let rules: Browser.declarativeNetRequest.Rule[] = [];
		const reconciler = createNavigationRuleReconciler( {
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Retains the latest test navigation rules.
			 * @param nextRules - Complete replacement rule set.
			 * @return Resolved browser operation.
			 */
			replaceNavigationRules: ( nextRules ) => {
				rules = nextRules;
				return Promise.resolve();
			},
			/**
			 * Returns the test time zone.
			 * @return UTC time-zone identifier.
			 */
			getTimeZone: () => 'UTC',
			/**
			 * Returns the test clock instant.
			 * @return Test epoch milliseconds.
			 */
			now: () => 100_000,
		} );

		await reconciler.reconcile( CONFIGURATION, {} );

		expect( rules ).toHaveLength( 1 );
	} );

	it( 'removes a scope rule for its unexpired allowance and restores it after expiry', async () => {
		let rules: Browser.declarativeNetRequest.Rule[] = [];
		let now = 100_000;
		const reconciler = createNavigationRuleReconciler( {
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Retains the latest test navigation rules.
			 * @param nextRules - Complete replacement rule set.
			 * @return Resolved browser operation.
			 */
			replaceNavigationRules: ( nextRules ) => {
				rules = nextRules;
				return Promise.resolve();
			},
			/**
			 * Returns the test time zone.
			 * @return UTC time-zone identifier.
			 */
			getTimeZone: () => 'UTC',
			/**
			 * Returns the mutable test clock instant.
			 * @return Test epoch milliseconds.
			 */
			now: () => now,
		} );
		const allowance = AllowanceProtectionStateSchema.parse( {
			type: ProtectionStateType.ALLOWANCE,
			scopeId: 'scope_default',
			allowanceId: 'allowance_a',
			completedWaitId: null,
			startedAtEpochMilliseconds: 1,
			expiresAtEpochMilliseconds: 300_001,
			readyParticipants: [],
			ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-09-02' },
		} );

		await reconciler.reconcile( CONFIGURATION, { scope_default: allowance } );
		expect( rules ).toEqual( [] );

		now = allowance.expiresAtEpochMilliseconds;
		await reconciler.reconcile( CONFIGURATION, { scope_default: allowance } );
		expect( rules ).toHaveLength( 1 );
	} );

	it( 'clears redirects when configuration or runtime state is unavailable', async () => {
		let ruleCount = -1;
		const reconciler = createNavigationRuleReconciler( {
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Retains the latest test navigation-rule count.
			 * @param rules - Complete replacement rule set.
			 * @return Resolved browser operation.
			 */
			replaceNavigationRules: ( rules ) => {
				ruleCount = rules.length;
				return Promise.resolve();
			},
			/**
			 * Returns the test time zone.
			 * @return UTC time-zone identifier.
			 */
			getTimeZone: () => 'UTC',
			/**
			 * Returns the test clock instant.
			 * @return Test epoch milliseconds.
			 */
			now: () => 0,
		} );

		await reconciler.reconcile( null, null );

		expect( ruleCount ).toBe( 0 );
	} );
} );
