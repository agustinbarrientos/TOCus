import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { InterruptionPageRequestType } from '../../types/runtime-message';
import { describe, expect, it } from 'vitest';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { ProtectionConfigurationDocumentSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';
import {
	EXAMPLE_CONFIGURATION,
	MemoryConfigurationStorage,
	MemoryRuntimeBrowser,
	MemoryProtectionStorage,
	completeFocusedPause,
	presentAllowanceExpiryInterruption,
	createRuntime,
} from './__fixtures__';

describe( 'website exception runtime', () => {
	it( 'releases an inactive path once while its parent remains protected and preserves the exact destination', async () => {
		const main = EXAMPLE_CONFIGURATION.sites[ 0 ];
		if ( main === undefined ) {
			throw new Error( 'Expected main website fixture.' );
		}
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			sites: [
				main,
				{
					...main,
					rule: { ...main.rule, pathPrefix: '/shorts' },
					schedule: {
						mode: ScheduleMode.CUSTOM,
						windows: [ { weekday: Weekday.MONDAY, startMinute: 0, endMinute: 1440 } ],
					},
				},
			],
		} );
		const browser = new MemoryRuntimeBrowser();
		const { runtime, coordinator } = createRuntime(
			{ value: Date.UTC( 2026, 8, 15, 12 ) },
			new MemoryConfigurationStorage( configuration ),
			browser,
		);
		await runtime.start();
		const destination = 'https://example.com/shorts/one?q=two#:~:text=hello';
		const carrier = `chrome-extension://extension-id/interruption.html#destination=${ destination }`;
		browser.tabs = [ { id: 7, incognito: false, url: carrier } ];
		await expect(
			runtime.handleNavigation( {
				tabId: 7,
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				url: carrier,
			} ),
		).resolves.toBe( destination );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).not.toBe( ProtectionStateType.WAITING );
		expect( browser.rules.some( ( rule ) => rule.action.type === 'allow' ) ).toBe( true );
	} );

	it.each( [
		ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
		ProtectionRuntimeNavigationPhase.HISTORY_STATE_UPDATED,
	] )( 'captures effective path timing for %s navigation', async ( phase ) => {
		const main = EXAMPLE_CONFIGURATION.sites[ 0 ];
		if ( main === undefined ) {
			throw new Error( 'Expected main website fixture.' );
		}
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			sites: [
				main,
				{
					...main,
					rule: { ...main.rule, pathPrefix: '/shorts' },
					timingConfiguration: {
						...EXAMPLE_CONFIGURATION.timingConfiguration,
						initialWaitMilliseconds: 20_000,
						allowanceMilliseconds: 120_000,
					},
				},
			],
		} );
		const browser = new MemoryRuntimeBrowser();
		const { runtime, coordinator } = createRuntime(
			{ value: Date.UTC( 2026, 8, 15, 12 ) },
			new MemoryConfigurationStorage( configuration ),
			browser,
		);
		await runtime.start();
		browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/shorts/one' } ];
		await runtime.handleNavigation( { tabId: 7, frameId: 0, phase, url: 'https://example.com/shorts/one' } );
		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.WAITING,
			capturedWaitDurationMilliseconds: 20_000,
			capturedAllowanceDurationMilliseconds: 120_000,
		} );
	} );
	it( 'keeps initiating policy through owner closure, worker restart and later configuration edits', async () => {
		const main = EXAMPLE_CONFIGURATION.sites[ 0 ];
		if ( main === undefined ) {
			throw new Error( 'Expected main website fixture.' );
		}
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			sites: [
				{
					...main,
					timingConfiguration: {
						...EXAMPLE_CONFIGURATION.timingConfiguration,
						allowanceMilliseconds: 120_000,
					},
				},
				{
					...main,
					rule: { ...main.rule, pathPrefix: '/shorts' },
					timingConfiguration: {
						...EXAMPLE_CONFIGURATION.timingConfiguration,
						initialWaitMilliseconds: 20_000,
						allowanceMilliseconds: 600_000,
						completionAction: CompletionAction.OPEN_AUTOMATICALLY,
					},
				},
			],
		} );
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const configurationStorage = new MemoryConfigurationStorage( configuration );
		const now = { value: Date.UTC( 2026, 8, 15, 12 ) };
		const { runtime, coordinator } = createRuntime( now, configurationStorage, browser, storage );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7, 3_000 );
		const initial = ( await coordinator.getStates() )?.scope_default;
		browser.tabs.push( { id: 8, incognito: false, url: 'https://example.com/shorts' } );
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://example.com/shorts' } );
		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			capturedWaitDurationMilliseconds: 20_000,
			confirmedFocusedDurationMilliseconds: 3_000,
		} );
		browser.tabs = browser.tabs.filter( ( tab ) => tab.id !== 7 );
		browser.focusedTabId = 8;
		await runtime.handleTabRemoved( 7 );
		configurationStorage.configuration = {
			...configuration,
			timingConfiguration: {
				...configuration.timingConfiguration,
				completionAction: CompletionAction.OPEN_AUTOMATICALLY,
				allowanceMilliseconds: 600_000,
			},
		};
		const restarted = createRuntime( now, configurationStorage, browser, storage );
		await restarted.runtime.start();
		expect( ( await restarted.coordinator.getStates() )?.scope_default ).toMatchObject( {
			waitId: initial?.type === ProtectionStateType.WAITING ? initial.waitId : '',
			capturedWaitDurationMilliseconds: 20_000,
			confirmedFocusedDurationMilliseconds: 3_000,
			capturedAllowanceDurationMilliseconds: 120_000,
			capturedCompletionAction: CompletionAction.SHOW_CONTINUE,
		} );
		await restarted.runtime.handlePageRequest(
			{ type: InterruptionPageRequestType.CONNECT, documentVisible: true },
			8,
			true,
		);
		await completeFocusedPause( restarted.runtime, 8, 20_000 );
		expect( ( await restarted.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.READY,
			capturedAllowanceDurationMilliseconds: 120_000,
		} );
		await restarted.runtime.handlePageRequest(
			{ type: InterruptionPageRequestType.CONTINUE, documentVisible: true },
			8,
			true,
		);
		expect( ( await restarted.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			expiresAtEpochMilliseconds: now.value + 120_000,
		} );
	} );

	it( 'leaves a running wait unchanged when an explicit allowed studio page is visited', async () => {
		const main = EXAMPLE_CONFIGURATION.sites[ 0 ];
		if ( main === undefined ) {
			throw new Error( 'Expected main website fixture.' );
		}
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			sites: [
				main,
				{
					...main,
					identityHost: 'studio.example.com',
					rule: { ...main.rule, host: 'studio.example.com', includeSubdomains: false, behavior: 'allow' },
				},
			],
		} );
		const browser = new MemoryRuntimeBrowser();
		const { runtime, coordinator } = createRuntime(
			{ value: Date.UTC( 2026, 8, 15, 12 ) },
			new MemoryConfigurationStorage( configuration ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const before = ( await coordinator.getStates() )?.scope_default;
		browser.tabs.push( { id: 8, incognito: false, url: 'https://studio.example.com/feed' } );
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://studio.example.com/feed' } );
		expect( ( await coordinator.getStates() )?.scope_default ).toEqual( before );
	} );

	it.each( [ true, false ] )(
		'revalidates an expiry overlay when its route changes with active child %s',
		async ( active ) => {
			const main = EXAMPLE_CONFIGURATION.sites[ 0 ];
			if ( main === undefined ) {
				throw new Error( 'Expected main website fixture.' );
			}
			const configuration = ProtectionConfigurationDocumentSchema.parse( {
				...EXAMPLE_CONFIGURATION,
				sites: [
					main,
					{
						...main,
						rule: { ...main.rule, pathPrefix: '/shorts' },
						timingConfiguration: {
							...EXAMPLE_CONFIGURATION.timingConfiguration,
							initialWaitMilliseconds: 20_000,
						},
						...( active
							? {}
							: {
								schedule: {
									mode: ScheduleMode.CUSTOM,
									windows: [ { weekday: Weekday.MONDAY, startMinute: 0, endMinute: 1 } ],
								},
							} ),
					},
				],
			} );
			const browser = new MemoryRuntimeBrowser();
			const now = { value: Date.UTC( 2026, 8, 15, 12 ) };
			const { runtime, coordinator } = createRuntime(
				now,
				new MemoryConfigurationStorage( configuration ),
				browser,
			);
			await presentAllowanceExpiryInterruption( runtime, now );
			await completeFocusedPause( runtime, 7, 3_000 );
			const before = ( await coordinator.getStates() )?.scope_default;
			browser.tabs = [ { id: 7, incognito: false, url: active ? 'https://example.com/shorts' : 'https://example.com/' } ];
			const navigation = {
				tabId: 7,
				frameId: 0,
				phase: active ? ProtectionRuntimeNavigationPhase.HISTORY_STATE_UPDATED
					: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
				url: 'https://example.com/shorts',
			};
			await runtime.handleNavigation( navigation );
			await runtime.handleNavigation( navigation );
			const after = ( await coordinator.getStates() )?.scope_default;
			expect( after ).toMatchObject(
				active
					? {
						type: ProtectionStateType.WAITING,
						waitId: before?.type === ProtectionStateType.WAITING ? before.waitId : '',
						capturedWaitDurationMilliseconds: 25_000,
						confirmedFocusedDurationMilliseconds: 3_000,
					}
					: { type: ProtectionStateType.IDLE },
			);
		},
	);
	it( 'retains runtime interception when the browser cannot compile a long path selector', async () => {
		const main = EXAMPLE_CONFIGURATION.sites[ 0 ];
		if ( main === undefined ) {
			throw new Error( 'Expected main website fixture.' );
		}
		const pathPrefix = `/${  'a'.repeat( 100 ) }`;
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			sites: [
				main,
				{
					...main,
					rule: { ...main.rule, pathPrefix },
					timingConfiguration: {
						...EXAMPLE_CONFIGURATION.timingConfiguration,
						initialWaitMilliseconds: 20_000,
					},
				},
			],
		} );
		const browser = new MemoryRuntimeBrowser();
		Object.assign( browser, {
			/**
			 *
			 * @param regex - Complete native selector.
			 * @return Whether the simulated browser can compile the selector.
			 */
			isNavigationRegexSupported: ( regex: string ) => Promise.resolve( ! regex.includes( pathPrefix ) ),
		} );
		const { runtime, coordinator } = createRuntime(
			{ value: Date.UTC( 2026, 8, 15, 12 ) },
			new MemoryConfigurationStorage( configuration ),
			browser,
		);
		await runtime.start();
		expect( browser.rules ).toEqual( [] );
		const destination = `https://example.com${ pathPrefix }?source=long#chapter`;
		browser.tabs = [ { id: 7, incognito: false, url: destination } ];
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: destination } );
		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.WAITING,
			capturedWaitDurationMilliseconds: 20_000,
			participants: [ { retainedDestination: destination } ],
		} );
	} );
} );
