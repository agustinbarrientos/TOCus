import { describe, expect, it } from 'vitest';
import { type Browser } from 'wxt/browser';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	AllowanceProtectionStateSchema,
	ProtectionStateType,
} from '../../../../domains/protection/types/protection-state';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { createNavigationRuleReconciler } from './index';

/** Protected-site configuration used by navigation-rule fixtures. */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
	} ],
};

describe( 'createNavigationRuleReconciler', () => {
	it( 'keeps scheduled rules active outside an allowance', async () => {
		let rules: Browser.declarativeNetRequest.Rule[] = [];
		const reconciler = createNavigationRuleReconciler( {
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
