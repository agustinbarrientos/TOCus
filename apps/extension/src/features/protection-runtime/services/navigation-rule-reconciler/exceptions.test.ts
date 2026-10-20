import { describe, expect, it, vi } from 'vitest';
import type { Browser } from 'wxt/browser';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { createNavigationRuleReconciler } from './index';

describe( 'unsupported navigation selectors', () => {
	it( 'omits the whole overlapping website group while preserving unrelated interception and caching checks', async () => {
		let rules: Browser.declarativeNetRequest.Rule[] = [];
		const isNavigationRegexSupported = vi.fn( ( regex: string ) => Promise.resolve( ! regex.includes( 'a'.repeat( 100 ) ) ) );
		const reconciler = createNavigationRuleReconciler( {
			interruptionPageUrl: 'chrome-extension://test/pause.html',
			isNavigationRegexSupported,
			/**
			 *
			 * @param nextRules - Atomic replacement rules.
			 * @return Resolved replacement.
			 */
			replaceNavigationRules: ( nextRules ) => {
				rules = nextRules;
				return Promise.resolve();
			},
			/** @return Deterministic test time zone. */
			getTimeZone: () => 'UTC',
			/** @return Deterministic test clock. */
			now: () => Date.UTC( 2026, 8, 15, 12 ),
		} );
		const configuration = {
			...TestEmptyProtectionConfiguration,
			sites: [
				{
					identityHost: 'example.com',
					rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
				},
				{
					identityHost: 'example.com',
					rule: {
						host: 'example.com',
						includeSubdomains: true,
						scopeId: DefaultProtectionScopeId,
						pathPrefix: `/${  'a'.repeat( 100 ) }`,
						behavior: 'allow' as const,
					},
				},
				{
					identityHost: 'other.test',
					rule: { host: 'other.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
				},
			],
		};
		await reconciler.reconcile( configuration, {} );
		expect( rules ).toHaveLength( 1 );
		expect( new RegExp( rules[ 0 ]?.condition.regexFilter ?? '' ).test( 'https://other.test/' ) ).toBe( true );
		expect( isNavigationRegexSupported ).toHaveBeenCalledTimes( 3 );
		await reconciler.reconcile( configuration, {} );
		expect( isNavigationRegexSupported ).toHaveBeenCalledTimes( 3 );
		await reconciler.reconcile(
			{ ...configuration, sites: configuration.sites.filter( ( site ) => ! site.rule.pathPrefix ) },
			{},
		);
		expect( rules ).toHaveLength( 2 );
		await reconciler.reconcile( configuration, {} );
		expect( isNavigationRegexSupported ).toHaveBeenCalledTimes( 4 );
	} );
	it( 'removes connected private-domain groups when a broader public suffix overlaps an unsupported child', async () => {
		let rules: Browser.declarativeNetRequest.Rule[] = [];
		const reconciler = createNavigationRuleReconciler( {
			interruptionPageUrl: 'chrome-extension://test/pause.html',
			/**
			 *
			 * @param regex - Complete native selector.
			 * @return Whether the simulated browser can compile the selector.
			 */
			isNavigationRegexSupported: ( regex ) => Promise.resolve( ! regex.includes( 'a'.repeat( 100 ) ) ),
			/**
			 *
			 * @param nextRules - Atomic replacement rules.
			 * @return Resolved replacement.
			 */
			replaceNavigationRules: ( nextRules ) => {
				rules = nextRules;
				return Promise.resolve();
			},
			/** @return Deterministic test time zone. */
			getTimeZone: () => 'UTC',
			/** @return Deterministic test clock. */
			now: () => 1_800_000_000_000,
		} );
		await reconciler.reconcile(
			{
				...TestEmptyProtectionConfiguration,
				sites: [
					{
						identityHost: 'b.blogspot.com',
						rule: { host: 'b.blogspot.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId },
					},
					{
						identityHost: 'blogspot.com',
						rule: { host: 'blogspot.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
					},
					{
						identityHost: 'a.blogspot.com',
						rule: {
							host: 'a.blogspot.com',
							includeSubdomains: false,
							scopeId: DefaultProtectionScopeId,
							pathPrefix: `/${  'a'.repeat( 100 ) }`,
						},
					},
				],
			},
			{},
		);
		expect( rules ).toEqual( [] );
	} );
} );
