import { describe, expect, it, vi } from 'vitest';
import { type Browser } from 'wxt/browser';
import { AllowanceIdSchema } from '../../../../domains/protection/types/protection-value';
import { ProtectionNavigationRuleIdStart } from '../../utils/protection-navigation-rules';
import { ToolbarBadgePhase } from '../../utils/toolbar-badge-projection';
import {
	ProtectedPageMessageType,
} from '../../types/protected-page-message';
import { createBrowserProtectionAdapter, ProtectionClockAlarmNamePrefix } from './index';
import {
	type BrowserProtectionAdapterApi,
	type BrowserProtectionToolbarAction,
} from './types';

/**
 * Creates one complete redirect rule for adapter boundary tests.
 * @param id - Rule identifier.
 * @return Complete dynamic redirect rule.
 * @since 0.1.0 Initial implementation.
 */
function createRule( id: number ): Browser.declarativeNetRequest.Rule {
	return {
		id,
		priority: 1,
		action: {
			type: 'redirect',
			redirect: { extensionPath: '/interruption.html' },
		},
		condition: {
			resourceTypes: [ 'main_frame' ],
			urlFilter: '||example.com^',
		},
	};
}

/**
 * Creates an observable toolbar API for adapter boundary tests.
 * @return Toolbar action with mocked browser operations.
 * @since 0.1.0 Initial implementation.
 */
function createToolbarAction(): BrowserProtectionToolbarAction {
	return {
		setBadgeBackgroundColor: vi.fn().mockResolvedValue( undefined ),
		setBadgeText: vi.fn().mockResolvedValue( undefined ),
		setTitle: vi.fn().mockResolvedValue( undefined ),
	};
}

/**
 * Creates an observable browser API with safe default results.
 * @return Narrow browser boundary used by the adapter.
 * @since 0.1.0 Initial implementation.
 */
function createBrowserApi(): BrowserProtectionAdapterApi {
	return {
		alarms: {
			clear: vi.fn().mockResolvedValue( false ),
			create: vi.fn().mockResolvedValue( undefined ),
			getAll: vi.fn().mockResolvedValue( [] ),
		},
		declarativeNetRequest: {
			getDynamicRules: vi.fn().mockResolvedValue( [] ),
			updateDynamicRules: vi.fn().mockResolvedValue( undefined ),
		},
		scripting: {
			executeScript: vi.fn().mockResolvedValue( [] ),
			insertCSS: vi.fn().mockResolvedValue( undefined ),
		},
		tabs: {
			query: vi.fn().mockResolvedValue( [] ),
			sendMessage: vi.fn().mockResolvedValue( undefined ),
			update: vi.fn().mockResolvedValue( undefined ),
		},
		windows: {
			getLastFocused: vi.fn().mockResolvedValue( {
				focused: true,
				id: 4,
			} ),
		},
		action: createToolbarAction(),
	};
}

describe( 'createBrowserProtectionAdapter', () => {
	it( 'schedules each missing semantic protection-clock alarm independently', async () => {
		const browserApi = createBrowserApi();
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.synchronizeProtectionClock( [
			1_788_368_460_000,
			1_788_368_690_000,
			1_788_368_700_000,
		] );

		expect( browserApi.alarms.create ).toHaveBeenCalledTimes( 3 );
		expect( browserApi.alarms.create ).toHaveBeenCalledWith(
			`${ ProtectionClockAlarmNamePrefix }1788368700000`,
			{ when: 1_788_368_700_000 },
		);
		expect( browserApi.alarms.create ).toHaveBeenCalledWith(
			`${ ProtectionClockAlarmNamePrefix }1788368690000`,
			{ when: 1_788_368_690_000 },
		);
		expect( browserApi.alarms.create ).toHaveBeenCalledWith(
			`${ ProtectionClockAlarmNamePrefix }1788368460000`,
			{ when: 1_788_368_460_000 },
		);
		expect( browserApi.alarms.clear ).not.toHaveBeenCalled();
	} );

	it( 'preserves a pre-scheduled expiry alarm through the final warning window', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.alarms.getAll ).mockResolvedValue( [ {
			name: `${ ProtectionClockAlarmNamePrefix }1788368405000`,
			scheduledTime: 1_788_368_435_000,
		} ] );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.synchronizeProtectionClock( [ 1_788_368_405_000 ] );

		expect( browserApi.alarms.create ).not.toHaveBeenCalled();
		expect( browserApi.alarms.clear ).not.toHaveBeenCalled();
	} );

	it( 'clears only obsolete semantic protection-clock alarms', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.alarms.getAll ).mockResolvedValue( [
			{
				name: `${ ProtectionClockAlarmNamePrefix }1788368400000`,
				scheduledTime: 1_788_368_400_000,
			},
			{
				name: `${ ProtectionClockAlarmNamePrefix }1788368410000`,
				scheduledTime: 1_788_368_410_000,
			},
			{
				name: `${ ProtectionClockAlarmNamePrefix }1788368420000`,
				scheduledTime: 1_788_368_420_000,
			},
			{
				name: 'unrelated-alarm',
				scheduledTime: 1_788_368_400_000,
			},
			{
				name: `${ ProtectionClockAlarmNamePrefix }not-a-deadline`,
				scheduledTime: 1_788_368_400_000,
			},
			{
				name: `${ ProtectionClockAlarmNamePrefix }9007199254740992`,
				scheduledTime: 1_788_368_400_000,
			},
		] );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.synchronizeProtectionClock( [] );

		expect( browserApi.alarms.clear ).toHaveBeenCalledTimes( 3 );
		expect( browserApi.alarms.create ).not.toHaveBeenCalled();
	} );

	it( 'atomically replaces only reserved protection navigation rules', async () => {
		const browserApi = createBrowserApi();
		const unrelatedRule = createRule( 29 );
		const currentRules = [
			createRule( ProtectionNavigationRuleIdStart ),
			unrelatedRule,
		];
		const nextRules = [ createRule( ProtectionNavigationRuleIdStart + 1 ) ];
		vi.mocked( browserApi.declarativeNetRequest.getDynamicRules ).mockResolvedValue( currentRules );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.replaceNavigationRules( nextRules );

		expect( browserApi.declarativeNetRequest.updateDynamicRules ).toHaveBeenCalledOnce();
		expect( browserApi.declarativeNetRequest.updateDynamicRules ).toHaveBeenCalledWith( {
			addRules: nextRules,
			removeRuleIds: [ ProtectionNavigationRuleIdStart ],
		} );
	} );

	it( 'returns the active tab only when its browser window is focused', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.query ).mockResolvedValue( [ { id: 17, url: 'https://example.com/' } ] );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.getFocusedTabId() ).resolves.toBe( 17 );
		expect( browserApi.tabs.query ).toHaveBeenCalledWith( {
			active: true,
			windowId: 4,
		} );
	} );

	it( 'reports no focused tab after the whole browser loses focus', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.windows.getLastFocused ).mockResolvedValue( {
			focused: false,
			id: 4,
		} );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.getFocusedTabId() ).resolves.toBeNull();
		expect( browserApi.windows.getLastFocused ).toHaveBeenCalledOnce();
		expect( browserApi.tabs.query ).not.toHaveBeenCalled();
	} );

	it( 'reports no focused tab when the focused window has no live identifier', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.windows.getLastFocused ).mockResolvedValue( { focused: true } );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.getFocusedTabId() ).resolves.toBeNull();
		expect( browserApi.windows.getLastFocused ).toHaveBeenCalledOnce();
		expect( browserApi.tabs.query ).not.toHaveBeenCalled();
	} );

	it( 'reports no focused tab when a focused window has no active tab', async () => {
		const browserApi = createBrowserApi();
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.getFocusedTabId() ).resolves.toBeNull();
		expect( browserApi.tabs.query ).toHaveBeenCalledWith( {
			active: true,
			windowId: 4,
		} );
	} );

	it( 'lists only open tabs with browser-assigned identifiers', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.query ).mockResolvedValue( [
			{
				id: 7,
				incognito: false,
				pendingUrl: 'https://example.com/pending',
				url: 'https://example.com/watch',
				windowId: 3,
			},
			{ url: 'https://unidentified.example/' },
			{ id: 9, incognito: true },
			{ id: 10 },
		] );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.listTabs() ).resolves.toEqual( [
			{
				id: 7,
				incognito: false,
				pendingUrl: 'https://example.com/pending',
				url: 'https://example.com/watch',
				windowId: 3,
			},
			{ id: 9, incognito: true },
			{ id: 10 },
		] );
		expect( browserApi.tabs.query ).toHaveBeenCalledWith( {} );
	} );

	it( 'navigates the requested tab to its retained destination', async () => {
		const browserApi = createBrowserApi();
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.navigateTab( 12, 'https://example.com/retained?source=local' );

		expect( browserApi.tabs.update ).toHaveBeenCalledWith( 12, {
			url: 'https://example.com/retained?source=local',
		} );
	} );

	it( 'dismisses an interruption through browser-native back navigation when available', async () => {
		const browserApi = createBrowserApi();
		browserApi.tabs.goBack = vi.fn().mockResolvedValue( undefined );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.dismissInterruption( 12 );

		expect( browserApi.tabs.goBack ).toHaveBeenCalledWith( 12 );
	} );

	it( 'reads an existing protected-page presentation without injecting a script', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage ).mockResolvedValue( {
			allowanceWarningId: 'allowance_1',
			interruptionLayerPresented: true,
		} );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.getProtectedPagePresentation( 12 ) ).resolves.toEqual( {
			allowanceWarningId: 'allowance_1',
			interruptionLayerPresented: true,
		} );
		expect( browserApi.tabs.sendMessage ).toHaveBeenCalledWith( 12, {
			type: ProtectedPageMessageType.GET_PRESENTATION_STATUS,
		} );
		expect( browserApi.scripting.executeScript ).not.toHaveBeenCalled();
	} );

	it.each( [
		{ label: 'missing receiver', response: new Error( 'No receiver.' ) },
		{ label: 'malformed response', response: { interruptionLayerPresented: false } },
	] )( 'reports no protected-page presentation for a $label', async ( { response } ) => {
		const browserApi = createBrowserApi();

		if ( response instanceof Error ) {
			vi.mocked( browserApi.tabs.sendMessage ).mockRejectedValue( response );
		} else {
			vi.mocked( browserApi.tabs.sendMessage ).mockResolvedValue( response );
		}

		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.getProtectedPagePresentation( 12 ) ).resolves.toBeNull();
	} );

	it( 'injects the packaged page script and local font before presenting a first warning', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage )
			.mockRejectedValueOnce( new Error( 'No receiver.' ) )
			.mockResolvedValueOnce( undefined );
		const adapter = createBrowserProtectionAdapter( browserApi );
		const message = {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: AllowanceIdSchema.parse( 'allowance_1' ),
			expiresAtEpochMilliseconds: 1_800_000_000_000,
		} as const;

		await adapter.updateProtectedPagePresentation( 12, message );

		expect( browserApi.scripting.executeScript ).toHaveBeenCalledWith( {
			files: [ '/protected-page.js' ],
			target: { tabId: 12 },
		} );
		expect( browserApi.scripting.insertCSS ).toHaveBeenCalledWith( {
			files: [ 'assets/protected-page-font.css' ],
			target: { tabId: 12 },
		} );
		expect( browserApi.tabs.sendMessage ).toHaveBeenLastCalledWith( 12, message );
	} );

	it( 'injects the packaged page script before arming a first allowance expiry guard', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage )
			.mockRejectedValueOnce( new Error( 'No receiver.' ) )
			.mockResolvedValueOnce( undefined );
		const adapter = createBrowserProtectionAdapter( browserApi );
		const message = {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: AllowanceIdSchema.parse( 'allowance_1' ),
			expiresAtEpochMilliseconds: 1_800_000_000_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} as const;

		await adapter.updateProtectedPagePresentation( 12, message );

		expect( browserApi.scripting.executeScript ).toHaveBeenCalledWith( {
			files: [ '/protected-page.js' ],
			target: { tabId: 12 },
		} );
		expect( browserApi.tabs.sendMessage ).toHaveBeenLastCalledWith( 12, message );
	} );

	it( 'continues with the system font when packaged font insertion is unsupported', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage )
			.mockRejectedValueOnce( new Error( 'No receiver.' ) )
			.mockResolvedValueOnce( undefined );
		vi.mocked( browserApi.scripting.insertCSS ).mockRejectedValue( new Error( 'CSS unavailable.' ) );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateProtectedPagePresentation( 12, {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} ) ).resolves.toBeUndefined();
		expect( browserApi.tabs.sendMessage ).toHaveBeenLastCalledWith( 12, {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );
	} );

	it( 'rejects presentation when the packaged listener cannot be injected', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage ).mockRejectedValueOnce( new Error( 'No receiver.' ) );
		vi.mocked( browserApi.scripting.executeScript ).mockRejectedValue( new Error( 'Injection denied.' ) );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateProtectedPagePresentation( 12, {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} ) ).rejects.toThrow( 'Failed to inject the protected-page interruption listener.' );
		expect( browserApi.tabs.sendMessage ).toHaveBeenCalledOnce();
	} );

	it( 'does not reinject a listener that already reports its presentation state', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage )
			.mockResolvedValueOnce( {
				allowanceWarningId: null,
				interruptionLayerPresented: false,
			} )
			.mockRejectedValueOnce( new Error( 'Page moved after the status check.' ) );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateProtectedPagePresentation( 12, {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} ) ).rejects.toThrow( 'Page moved after the status check.' );
		expect( browserApi.scripting.executeScript ).not.toHaveBeenCalled();
		expect( browserApi.scripting.insertCSS ).not.toHaveBeenCalled();
	} );

	it( 'does not inject anything when removing an absent protected-page presentation', async () => {
		const browserApi = createBrowserApi();
		vi.mocked( browserApi.tabs.sendMessage ).mockRejectedValue( new Error( 'No receiver.' ) );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateProtectedPagePresentation( 12, {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} ) ).resolves.toBeUndefined();
		expect( browserApi.scripting.executeScript ).not.toHaveBeenCalled();
		expect( browserApi.scripting.insertCSS ).not.toHaveBeenCalled();
	} );

	it( 'falls back to a blank local tab when browser-native history is unavailable', async () => {
		const browserApi = createBrowserApi();
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.dismissInterruption( 12 ) ).resolves.toBeUndefined();
		expect( browserApi.tabs.update ).toHaveBeenCalledWith( 12, { url: 'about:blank' } );
	} );

	it( 'falls back to a blank local tab when browser-native history rejects', async () => {
		const browserApi = createBrowserApi();
		browserApi.tabs.goBack = vi.fn().mockRejectedValue( new Error( 'No previous page.' ) );
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.dismissInterruption( 12 ) ).resolves.toBeUndefined();
		expect( browserApi.tabs.update ).toHaveBeenCalledWith( 12, { url: 'about:blank' } );
	} );

	it( 'uses the Manifest V3 action for a phase-specific toolbar badge', async () => {
		const browserApi = createBrowserApi();
		const manifestV2Action = createToolbarAction();
		browserApi.browserAction = manifestV2Action;
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.updateToolbarBadge( {
			phase: ToolbarBadgePhase.WAITING,
			text: 'P8s',
			title: 'Pause: 8 seconds remaining',
		} );

		expect( browserApi.action?.setBadgeText ).toHaveBeenCalledWith( { text: 'P8s' } );
		expect( browserApi.action?.setBadgeBackgroundColor ).toHaveBeenCalledWith( {
			color: '#744331',
		} );
		expect( browserApi.action?.setTitle ).toHaveBeenCalledWith( {
			title: 'Pause: 8 seconds remaining',
		} );
		expect( manifestV2Action.setBadgeText ).not.toHaveBeenCalled();
	} );

	it( 'falls back to the Manifest V2 browser action', async () => {
		const browserApi = createBrowserApi();
		const manifestV2Action = createToolbarAction();
		browserApi.action = undefined;
		browserApi.browserAction = manifestV2Action;
		const adapter = createBrowserProtectionAdapter( browserApi );

		await adapter.updateToolbarBadge( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			text: 'V5m',
			title: 'Visit window: 5 minutes remaining',
		} );

		expect( manifestV2Action.setBadgeText ).toHaveBeenCalledWith( { text: 'V5m' } );
		expect( manifestV2Action.setBadgeBackgroundColor ).toHaveBeenCalledWith( {
			color: '#744331',
		} );
		expect( manifestV2Action.setTitle ).toHaveBeenCalledWith( {
			title: 'Visit window: 5 minutes remaining',
		} );
	} );

	it( 'isolates individual toolbar API failures from the runtime', async () => {
		const browserApi = createBrowserApi();
		const completedOperations: string[] = [];
		browserApi.action = {
			/**
			 * Simulates one rejected browser operation.
			 * @return Rejected browser operation.
			 * @since 0.1.0 Initial implementation.
			 */
			setBadgeText: () => Promise.reject( new Error( 'Badge text unavailable.' ) ),

			/**
			 * Simulates one synchronously rejected browser operation.
			 * @throws {Error} Always, to verify synchronous failure isolation.
			 * @since 0.1.0 Initial implementation.
			 */
			setBadgeBackgroundColor: () => {
				throw new Error( 'Badge color unavailable.' );
			},

			/**
			 * Records that an independent toolbar operation still runs.
			 * @return Resolved browser operation.
			 * @since 0.1.0 Initial implementation.
			 */
			setTitle: () => {
				completedOperations.push( 'title' );
				return Promise.resolve();
			},
		};
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateToolbarBadge( {
			phase: ToolbarBadgePhase.WAITING,
			text: 'P8s',
			title: 'Pause: 8 seconds remaining',
		} ) ).resolves.toBeUndefined();
		expect( completedOperations ).toEqual( [ 'title' ] );
	} );

	it( 'keeps badge text and title usable when a browser ignores badge colors', async () => {
		const browserApi = createBrowserApi();
		const toolbarAction = createToolbarAction();
		vi.mocked( toolbarAction.setBadgeBackgroundColor ).mockRejectedValue( new Error( 'Badge color unavailable.' ) );
		browserApi.action = toolbarAction;
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateToolbarBadge( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			text: 'V5m',
			title: 'Visit window: 5 minutes remaining',
		} ) ).resolves.toBeUndefined();
		expect( toolbarAction.setBadgeText ).toHaveBeenCalledWith( { text: 'V5m' } );
		expect( toolbarAction.setTitle ).toHaveBeenCalledWith( {
			title: 'Visit window: 5 minutes remaining',
		} );
	} );

	it( 'ignores toolbar updates when neither action API is available', async () => {
		const browserApi = createBrowserApi();
		browserApi.action = undefined;
		browserApi.browserAction = undefined;
		const adapter = createBrowserProtectionAdapter( browserApi );

		await expect( adapter.updateToolbarBadge( {
			phase: ToolbarBadgePhase.INACTIVE,
			text: '',
			title: 'TOCus',
		} ) ).resolves.toBeUndefined();
	} );
} );
