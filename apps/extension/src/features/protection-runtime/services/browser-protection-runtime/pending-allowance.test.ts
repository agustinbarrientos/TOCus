import { describe, expect, it } from 'vitest';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { ProtectionFactType } from '../../../../domains/protection/types/protection-fact';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { InterruptionPageRequestType, InterruptionPageResponseState } from '../../types/runtime-message';
import { ProtectedPageMessageType } from '../../types/protected-page-message';
import {
	EXAMPLE_CONFIGURATION,
	GROUPED_CONFIGURATION,
	MULTI_SCOPE_CONFIGURATION,
	MemoryConfigurationStorage,
	MemoryProtectionStorage,
	MemoryRuntimeBrowser,
	completeFocusedPause,
	createRuntime,
	presentAllowanceExpiryInterruption,
} from './__fixtures__';

describe( 'pending completed pause', () => {
	it( 'waits beyond the full visit duration before Continue starts the entire allowance', async () => {
		const startedAt = Date.UTC( 2026, 8, 2, 12 );
		const now = { value: startedAt };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await expect( completeFocusedPause( runtime, 7 ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: null,
		} );
		now.value += 600_000;
		await runtime.handleClockTick();

		await expect( runtime.handlePageRequest( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: null,
		} );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.READY );
		expect( browser.rules ).not.toEqual( [] );
		expect( browser.badge ).toMatchObject( { phase: 'inactive', text: '' } );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		expect( browser.navigations ).toEqual( [ { tabId: 7, url: 'chrome-extension://extension-id/interruption.html' } ] );

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			startedAtEpochMilliseconds: startedAt + 600_000,
			expiresAtEpochMilliseconds: startedAt + 900_000,
			readyParticipants: [],
		} );
		expect( browser.navigations.at( -1 ) ).toEqual( { tabId: 7, url: 'https://example.com/' } );
	} );

	it( 'lets another grouped tab join Ready and creates only one interval across continuations', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( GROUPED_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );
		browser.tabs.push( { id: 8, incognito: false, url: 'https://another.test/feed' } );
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://another.test/feed' } );

		await expect( runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 8, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: null,
		} );
		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.READY,
			ladder: { completedWaits: 1 },
		} );
		expect( browser.navigations.at( -1 ) ).toEqual( { tabId: 8, url: 'chrome-extension://extension-id/interruption.html' } );
		now.value += 600_000;
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 8, true );
		const allowance = ( await coordinator.getStates() )?.scope_default;
		now.value += 30_000;
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 8, true );

		expect( ( await coordinator.getStates() )?.scope_default ).toEqual( { ...allowance, readyParticipants: [] } );
		const facts = ( await coordinator.getStatisticsDelivery() )?.outbox.flatMap( ( batch ) => batch.facts ) ?? [];
		expect( facts.filter( ( fact ) => fact.type === ProtectionFactType.ALLOWANCE_GRANTED ) ).toHaveLength( 1 );
	} );

	it( 'keeps independent scope navigation waiting while the completed scope remains Ready', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( MULTI_SCOPE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );
		browser.tabs.push( { id: 8, incognito: false, url: 'https://independent.test/feed' } );
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://independent.test/feed' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.READY );
		expect( ( await coordinator.getStates() )?.scope_independent?.type ).toBe( ProtectionStateType.WAITING );
	} );

	it( 'restores a pending page after a long suspension without starting its allowance', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const first = createRuntime( now, configurationStorage, browser, storage );

		await first.runtime.start();
		await first.runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( first.runtime, 7 );
		now.value += 600_000;
		const restarted = createRuntime( now, configurationStorage, browser, storage );
		await restarted.runtime.start();

		await expect( restarted.runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: null,
		} );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		await restarted.runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );
		expect( ( await restarted.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			startedAtEpochMilliseconds: now.value,
			expiresAtEpochMilliseconds: now.value + 300_000,
		} );
	} );

	it( 'keeps the focused pending page badge empty while another scope has a running visit', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( MULTI_SCOPE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );
		browser.tabs.push( { id: 8, incognito: false, url: 'https://independent.test/feed' } );
		browser.focusedTabId = 8;
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://independent.test/feed' } );
		await completeFocusedPause( runtime, 8 );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 8, true );
		expect( browser.badge ).toMatchObject( { text: 'V5m' } );
		browser.focusedTabId = 7;
		await runtime.handleFocusChanged();

		expect( browser.badge ).toMatchObject( { phase: 'inactive', text: '' } );
	} );

	it( 'releases a pending page when its configured scope is removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );
		configurationStorage.configuration = TestEmptyProtectionConfiguration;
		await runtime.handleConfigurationChanged();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.rules ).toEqual( [] );
		expect( browser.navigations.at( -1 ) ).toEqual( { tabId: 7, url: 'https://example.com/' } );
	} );

	it( 'starts the visit immediately when valid automatic entry completes the pause', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configuration = {
			...EXAMPLE_CONFIGURATION,
			timingConfiguration: {
				...EXAMPLE_CONFIGURATION.timingConfiguration,
				completionAction: CompletionAction.OPEN_AUTOMATICALLY,
			},
		};
		const { coordinator, runtime } = createRuntime( now, new MemoryConfigurationStorage( configuration ), browser );

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		now.value += 10_000;
		await completeFocusedPause( runtime, 7 );

		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			startedAtEpochMilliseconds: now.value,
			expiresAtEpochMilliseconds: now.value + 300_000,
		} );
		expect( browser.navigations.at( -1 ) ).toEqual( { tabId: 7, url: 'https://example.com/' } );
	} );

	it( 'starts a full allowance when Continue dismisses a completed injected pause', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await presentAllowanceExpiryInterruption( runtime, now );
		await completeFocusedPause( runtime, 7, 15_000 );
		expect( browser.protectedPageUpdates ).not.toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER, resumePlayback: true },
		} );
		now.value += 600_000;
		await runtime.handleClockTick();
		await expect( runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: null,
		} );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			startedAtEpochMilliseconds: now.value,
			expiresAtEpochMilliseconds: now.value + 300_000,
		} );
		expect( browser.protectedPagePresentations.get( 7 )?.interruptionLayerPresented ).toBe( false );
	} );

	it( 'starts the next allowance when an injected pause completes with automatic entry', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await presentAllowanceExpiryInterruption( runtime, now );
		configurationStorage.configuration = {
			...EXAMPLE_CONFIGURATION,
			timingConfiguration: {
				...EXAMPLE_CONFIGURATION.timingConfiguration,
				completionAction: CompletionAction.OPEN_AUTOMATICALLY,
			},
		};
		now.value += 15_000;
		await completeFocusedPause( runtime, 7, 15_000 );

		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			startedAtEpochMilliseconds: now.value,
			expiresAtEpochMilliseconds: now.value + 300_000,
			readyParticipants: [],
		} );
		expect( browser.protectedPagePresentations.get( 7 )?.interruptionLayerPresented ).toBe( false );
		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER, resumePlayback: true },
		} );
	} );
} );
