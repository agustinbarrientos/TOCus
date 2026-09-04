import { ToolbarBadgeBackgroundColor } from '@tocus/theme/runtime-colors';
import { type Browser } from 'wxt/browser';
import { isProtectionNavigationRuleId } from '../../utils/protection-navigation-rules';
import {
	ProtectedPageMessageSchema,
	ProtectedPageMessageType,
	ProtectedPagePresentationStatusSchema,
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from '../../types/protected-page-message';
import { type ToolbarBadgeProjection } from '../../utils/toolbar-badge-projection';
import {
	type ProtectionClockDeadlines,
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeTab,
} from '../../types/browser-runtime';
import {
	type BrowserProtectionAdapterApi,
	type BrowserProtectionToolbarAction,
} from './types';

/**
 * Namespace reserved for authoritative protection-clock alarms.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionClockAlarmNamePrefix = 'tocus.protection.clock.';

/**
 * Extension script injected into protected pages.
 * @since 0.1.0 Initial implementation.
 */
const PROTECTED_PAGE_SCRIPT_PATH = '/protected-page.js';

/**
 * Extension font stylesheet injected into protected pages.
 * @since 0.1.0 Initial implementation.
 */
const PROTECTED_PAGE_FONT_PATH = 'assets/protected-page-font.css';

/**
 * Reports whether an alarm name belongs to one encoded protection-clock deadline.
 * @param name - Browser alarm name.
 * @return Whether the name contains the reserved prefix and a safe epoch-millisecond suffix.
 * @since 0.1.0 Initial implementation.
 */
export function isProtectionClockAlarmName( name: string ): boolean {
	if ( ! name.startsWith( ProtectionClockAlarmNamePrefix ) ) {
		return false;
	}

	const suffix = name.slice( ProtectionClockAlarmNamePrefix.length );
	const epochMilliseconds = Number( suffix );

	return /^\d+$/u.test( suffix ) && Number.isSafeInteger( epochMilliseconds );
}

/**
 * Selects the toolbar API exposed by the current manifest version.
 * @param browserApi - Narrow injected browser operations.
 * @return Manifest V3 action, Manifest V2 browser action, or undefined when neither API is available.
 * @since 0.1.0 Initial implementation.
 */
function getToolbarAction( browserApi: BrowserProtectionAdapterApi ): BrowserProtectionToolbarAction | undefined {
	return browserApi.action ?? browserApi.browserAction;
}

/**
 * Runs one nonessential toolbar operation without exposing browser-specific failures to navigation.
 * @param operation - Deferred toolbar operation that may fail synchronously or asynchronously.
 * @return Promise resolved after the operation succeeds or its failure is isolated.
 * @since 0.1.0 Initial implementation.
 */
async function isolateToolbarOperationFailure( operation: () => Promise<void> | void ): Promise<void> {
	try {
		await operation();
	} catch {
		return;
	}
}

/**
 * Creates the browser-facing adapter used by the protection runtime.
 * @param browserApi - Narrow injected browser operations.
 * @return Browser effects consumed by the protection runtime.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserProtectionAdapter(
	browserApi: BrowserProtectionAdapterApi,
): ProtectionRuntimeBrowser {
	/**
	 * Creates the stable name for one exact protection-clock deadline.
	 * @param epochMilliseconds - Exact wall-clock deadline encoded into the name.
	 * @return Stable extension-owned alarm name.
	 * @since 0.1.0 Initial implementation.
	 */
	function createProtectionClockAlarmName( epochMilliseconds: number ): string {
		return `${ ProtectionClockAlarmNamePrefix }${ String( epochMilliseconds ) }`;
	}

	/**
	 * Synchronizes every active deadline while preserving alarms that were scheduled early enough.
	 * @param deadlines - Distinct future expiry, warning, and badge deadlines.
	 * @return Promise resolved after extension-owned clock alarms match the requested deadlines.
	 * @since 0.1.0 Initial implementation.
	 */
	async function synchronizeProtectionClock( deadlines: ProtectionClockDeadlines ): Promise<void> {
		const currentAlarms = await browserApi.alarms.getAll();
		const currentClockAlarmNames = new Set(
			currentAlarms
				.map( ( alarm ) => alarm.name )
				.filter( isProtectionClockAlarmName ),
		);
		const desiredAlarms = new Map(
			deadlines.map( ( deadline ) => [ createProtectionClockAlarmName( deadline ), deadline ] ),
		);

		await Promise.all( [
			...Array.from( currentClockAlarmNames )
				.filter( ( name ) => ! desiredAlarms.has( name ) )
				.map( ( name ) => browserApi.alarms.clear( name ) ),
			...Array.from( desiredAlarms )
				.filter( ( [ name ] ) => ! currentClockAlarmNames.has( name ) )
				.map( ( [ name, deadline ] ) => browserApi.alarms.create( name, { when: deadline } ) ),
		] );
	}

	/**
	 * Replaces every reserved protection redirect in one browser transaction without disturbing unrelated dynamic rules.
	 * @param rules - Complete deterministic navigation-rule set.
	 * @return Promise resolved after atomic browser replacement.
	 * @since 0.1.0 Initial implementation.
	 */
	async function replaceNavigationRules(
		rules: Browser.declarativeNetRequest.Rule[],
	): Promise<void> {
		const currentRules = await browserApi.declarativeNetRequest.getDynamicRules();

		await browserApi.declarativeNetRequest.updateDynamicRules( {
			addRules: rules,
			removeRuleIds: currentRules
				.filter( ( rule ) => isProtectionNavigationRuleId( rule.id ) )
				.map( ( rule ) => rule.id ),
		} );
	}

	/**
	 * Returns the active tab only while its browser window owns operating-system focus.
	 * @return Focused browser tab identifier or null.
	 * @since 0.1.0 Initial implementation.
	 */
	async function getFocusedTabId(): Promise<number | null> {
		const focusedWindow = await browserApi.windows.getLastFocused();

		if ( ! focusedWindow.focused || focusedWindow.id === undefined ) {
			return null;
		}

		const activeTabs = await browserApi.tabs.query( {
			active: true,
			windowId: focusedWindow.id,
		} );

		return activeTabs[ 0 ]?.id ?? null;
	}

	/**
	 * Lists open browser tabs with live identifiers and any locally accessible URL.
	 * @return Browser tabs suitable for local protection matching.
	 * @since 0.1.0 Initial implementation.
	 */
	async function listTabs(): Promise<ReadonlyArray<ProtectionRuntimeTab>> {
		const tabs = await browserApi.tabs.query( {} );

		return tabs.flatMap( ( tab ) => {
			if ( tab.id === undefined ) {
				return [];
			}

			return [ {
				id: tab.id,
				...( tab.incognito === undefined ? {} : { incognito: tab.incognito } ),
				...( tab.pendingUrl === undefined ? {} : { pendingUrl: tab.pendingUrl } ),
				...( tab.url === undefined ? {} : { url: tab.url } ),
				...( tab.windowId === undefined ? {} : { windowId: tab.windowId } ),
			} ];
		} );
	}

	/**
	 * Reads the local state of an already injected protected-page presentation.
	 * @param tabId - Browser tab containing the protected page.
	 * @return Validated presentation status, or null when no listener is available.
	 * @since 0.1.0 Initial implementation.
	 */
	async function getProtectedPagePresentation(
		tabId: number,
	): Promise<ProtectedPagePresentationStatus | null> {
		try {
			const response = await browserApi.tabs.sendMessage( tabId, {
				type: ProtectedPageMessageType.GET_PRESENTATION_STATUS,
			} );
			const result = ProtectedPagePresentationStatusSchema.safeParse( response );

			return result.success ? result.data : null;
		} catch {
			return null;
		}
	}

	/**
	 * Reports whether a presentation command requires an injected page listener.
	 * @param message - Validated protected-page command.
	 * @return Whether absence of a listener requires on-demand injection.
	 * @since 0.1.0 Initial implementation.
	 */
	function requiresProtectedPageInjection( message: ProtectedPageMessage ): boolean {
		return message.type === ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING ||
			message.type === ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER ||
			message.type === ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD;
	}

	/**
	 * Injects the packaged page listener and attempts to register its local font without touching page styles.
	 * @param tabId - Authorized browser tab receiving packaged extension resources.
	 * @return Promise resolved after the listener is available.
	 * @since 0.1.0 Initial implementation.
	 */
	async function injectProtectedPagePresentation( tabId: number ): Promise<void> {
		const [ scriptResult ] = await Promise.allSettled( [
			browserApi.scripting.executeScript( {
				files: [ PROTECTED_PAGE_SCRIPT_PATH ],
				target: { tabId },
			} ),
			browserApi.scripting.insertCSS( {
				files: [ PROTECTED_PAGE_FONT_PATH ],
				target: { tabId },
			} ),
		] );

		if ( scriptResult.status === 'rejected' ) {
			throw new Error( 'Failed to inject the protected-page interruption listener.', {
				cause: scriptResult.reason,
			} );
		}
	}

	/**
	 * Applies one warning or interruption-layer command to a protected page.
	 * @param tabId - Browser tab containing the protected page.
	 * @param input - Protected-page command awaiting boundary validation.
	 * @return Promise resolved after presentation or an absent removal is ignored.
	 * @since 0.1.0 Initial implementation.
	 */
	async function updateProtectedPagePresentation(
		tabId: number,
		input: ProtectedPageMessage,
	): Promise<void> {
		const message = ProtectedPageMessageSchema.parse( input );

		if ( requiresProtectedPageInjection( message ) ) {
			const status = await getProtectedPagePresentation( tabId );

			if ( status === null ) {
				await injectProtectedPagePresentation( tabId );
			}
		}

		try {
			await browserApi.tabs.sendMessage( tabId, message );
		} catch ( error ) {
			if ( ! requiresProtectedPageInjection( message ) ) {
				return;
			}

			throw error;
		}
	}

	/**
	 * Navigates one live tab to its retained HTTP or HTTPS destination.
	 * @param tabId - Browser-assigned tab identifier.
	 * @param url - Retained navigation destination.
	 * @return Promise resolved after the browser accepts the update.
	 * @since 0.1.0 Initial implementation.
	 */
	async function navigateTab( tabId: number, url: string ): Promise<void> {
		await browserApi.tabs.update( tabId, { url } );
	}

	/**
	 * Dismisses one interruption through browser-native history when the browser supports it.
	 * @param tabId - Browser-assigned tab identifier.
	 * @return Promise resolved after back navigation is accepted or immediately when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	async function dismissInterruption( tabId: number ): Promise<void> {
		if ( browserApi.tabs.goBack === undefined ) {
			await browserApi.tabs.update( tabId, { url: 'about:blank' } );
			return;
		}

		try {
			await browserApi.tabs.goBack( tabId );
		} catch {
			await browserApi.tabs.update( tabId, { url: 'about:blank' } );
		}
	}

	/**
	 * Applies one semantic projection to the global browser action API.
	 * @param projection - Compact text, accessible title, and semantic phase.
	 * @return Promise resolved after every independent toolbar update is attempted.
	 * @since 0.1.0 Initial implementation.
	 */
	async function updateToolbarBadge(
		projection: ToolbarBadgeProjection,
	): Promise<void> {
		const toolbarAction = getToolbarAction( browserApi );

		if ( toolbarAction === undefined ) {
			return;
		}

		await Promise.all( [
			isolateToolbarOperationFailure( () => toolbarAction.setBadgeText( {
				text: projection.text,
			} ) ),
			isolateToolbarOperationFailure( () => toolbarAction.setBadgeBackgroundColor( {
				color: ToolbarBadgeBackgroundColor,
			} ) ),
			isolateToolbarOperationFailure( () => toolbarAction.setTitle( {
				title: projection.title,
			} ) ),
		] );
	}

	return {
		synchronizeProtectionClock,
		replaceNavigationRules,
		getFocusedTabId,
		listTabs,
		getProtectedPagePresentation,
		navigateTab,
		updateProtectedPagePresentation,
		dismissInterruption,
		updateToolbarBadge,
	};
}

export * from './types';
