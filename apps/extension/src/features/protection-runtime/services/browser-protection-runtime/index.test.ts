import { describe, expect, it, vi } from 'vitest';
import { type Browser } from 'wxt/browser';
import {
	createProtectionCoordinator,
	type LoadedProtectionState,
	type ProtectionCoordinator,
	type ProtectionStorageService,
} from '../../../../domains/protection';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	createIdleState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import {
	DefaultProtectionScopeId,
	PageIdSchema,
	ParticipantIdSchema,
} from '../../../../domains/protection/types/protection-value';
import {
	EnglishToolbarBadgeCopy,
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
} from '../../utils/toolbar-badge-projection';
import {
	InterruptionPageRequestType,
	InterruptionPageResponseState,
	type InterruptionPageResponse,
} from '../../types/runtime-message';
import {
	ProtectedPageMessageType,
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from '../../types/protected-page-message';
import { createBrowserProtectionRuntime } from './index';
import { type BrowserProtectionRuntime } from './types';
import {
	type ProtectionClockDeadlines,
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeTab,
} from '../../types/browser-runtime';

/**
 * Mutable wall-clock holder used by runtime integration tests.
 */
interface MutableClock {
	value: number;
}

/**
 * Initialized runtime services returned to integration tests.
 */
interface RuntimeTestHarness {
	coordinator: ProtectionCoordinator;
	runtime: BrowserProtectionRuntime;
}

/** Single-site configuration used by focused runtime scenarios. */
const EXAMPLE_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		},
	} ],
};

/** Shared-scope configuration used by grouped-site runtime scenarios. */
const GROUPED_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...EXAMPLE_CONFIGURATION,
	sites: [
		...EXAMPLE_CONFIGURATION.sites,
		{
			identityHost: 'another.test',
			rule: {
				host: 'another.test',
				includeSubdomains: true,
				scopeId: 'scope_default',
			},
		},
	],
} );

/** Multiple-scope configuration used by independent-site runtime scenarios. */
const MULTI_SCOPE_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...GROUPED_CONFIGURATION,
	sites: [
		...GROUPED_CONFIGURATION.sites,
		{
			identityHost: 'independent.test',
			rule: {
				host: 'independent.test',
				includeSubdomains: true,
				scopeId: 'scope_independent',
			},
		},
	],
	schedulesByScope: {
		scope_default: { mode: 'always' },
		scope_independent: { mode: 'always' },
	},
} );

/**
 * In-memory state persistence used by runtime integration tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectionStorage implements ProtectionStorageService {
	state: LoadedProtectionState = {};

	throwOnLoad = false;

	throwOnSave = false;

	/**
	 * Loads the latest in-memory domain documents.
	 * @return Stored domain documents.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<LoadedProtectionState> {
		if ( this.throwOnLoad ) {
			return Promise.reject( new Error( 'Protection state unavailable.' ) );
		}

		return Promise.resolve( this.state );
	}

	/**
	 * Retains the prepared session and durable documents.
	 * @param input - Complete prepared protection state.
	 * @return Promise resolved after the write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.throwOnSave ) {
			return Promise.reject( new Error( 'Protection state could not be saved.' ) );
		}

		const state = input as { durable: unknown; session: unknown };
		this.state = { durable: state.durable, session: state.session };
		return Promise.resolve();
	}
}

/**
 * In-memory protected-site configuration storage.
 * @since 0.1.0 Initial implementation.
 */
class MemoryConfigurationStorage implements ProtectionConfigurationStorageService {
	accessibleConfiguration: ProtectionConfigurationDocument | null = null;

	filterCalls = 0;

	throwOnLoad = false;

	/**
	 * Creates configuration storage with one initial document.
	 * @param configuration - Initial local configuration.
	 */
	constructor( public configuration: ProtectionConfigurationDocument | null ) {}

	/**
	 * Loads current local configuration.
	 * @return Current test configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		if ( this.throwOnLoad ) {
			return Promise.reject( new Error( 'Configuration unavailable.' ) );
		}

		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores current local configuration.
	 * @param input - Complete local configuration.
	 * @return Promise resolved after the write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.configuration = input as ProtectionConfigurationDocument;
		return Promise.resolve();
	}

	/**
	 * Applies the current permission-aware runtime projection.
	 * @param configuration - Validated persisted configuration.
	 * @return Accessible configuration override or the original configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	filterForRuntime = (
		configuration: ProtectionConfigurationDocument,
	): Promise<ProtectionConfigurationDocument> => {
		this.filterCalls += 1;
		return Promise.resolve( this.accessibleConfiguration ?? configuration );
	};
}

/**
 * Browser-effect test double used by runtime integration tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryRuntimeBrowser implements ProtectionRuntimeBrowser {
	badge: ToolbarBadgeProjection | null = null;

	dismissedTabs: number[] = [];

	focusedTabId: number | null = 7;

	navigations: Array<{ tabId: number; url: string }> = [];

	protectedPageUpdates: Array<{ tabId: number; message: ProtectedPageMessage }> = [];

	protectedPagePresentations = new Map<number, ProtectedPagePresentationStatus>();

	rules: Browser.declarativeNetRequest.Rule[] = [];

	protectionClockDeadlines: ProtectionClockDeadlines = [];

	tabs: ProtectionRuntimeTab[] = [ { id: 7, url: 'https://example.com/watch?v=1' } ];

	/**
	 * Returns the current protected-page presentation for one tab.
	 * @param tabId - Browser tab identifier.
	 * @return Current presentation state or absent-listener marker.
	 * @since 0.1.0 Initial implementation.
	 */
	getProtectedPagePresentation = (
		tabId: number,
	): Promise<ProtectedPagePresentationStatus | null> => Promise.resolve(
		this.protectedPagePresentations.get( tabId ) ?? null,
	);

	/**
	 * Records every active protection-clock deadline.
	 * @param deadlines - Distinct future allowance deadlines.
	 * @return Resolved browser operation.
	 */
	synchronizeProtectionClock = ( deadlines: ProtectionClockDeadlines ): Promise<void> => {
		this.protectionClockDeadlines = deadlines;
		return Promise.resolve();
	};

	/**
	 * Replaces all extension-owned dynamic rules.
	 * @param rules - Complete replacement rule set.
	 * @return Resolved browser operation.
	 */
	replaceNavigationRules = ( rules: Browser.declarativeNetRequest.Rule[] ): Promise<void> => {
		this.rules = rules;
		return Promise.resolve();
	};

	/**
	 * Returns the currently focused test tab.
	 * @return Focused test tab identifier.
	 */
	getFocusedTabId = (): Promise<number | null> => Promise.resolve( this.focusedTabId );

	/**
	 * Lists current test tabs.
	 * @return Current test tabs.
	 */
	listTabs = (): Promise<ReadonlyArray<ProtectionRuntimeTab>> => Promise.resolve( this.tabs );

	/**
	 * Records an accepted tab navigation.
	 * @param tabId - Navigated tab identifier.
	 * @param url - Accepted retained destination.
	 * @return Resolved browser operation.
	 */
	navigateTab = ( tabId: number, url: string ): Promise<void> => {
		this.navigations.push( { tabId, url } );
		this.tabs = this.tabs.map( ( tab ) => tab.id === tabId ? { ...tab, url } : tab );
		return Promise.resolve();
	};

	/**
	 * Records one dismissed interruption page.
	 * @param tabId - Dismissed tab identifier.
	 * @return Resolved browser operation.
	 */
	dismissInterruption = ( tabId: number ): Promise<void> => {
		this.dismissedTabs.push( tabId );
		return Promise.resolve();
	};

	/**
	 * Records one protected-page presentation command.
	 * @param tabId - Browser tab identifier.
	 * @param message - Presentation command.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
	 */
	updateProtectedPagePresentation = (
		tabId: number,
		message: ProtectedPageMessage,
	): Promise<void> => {
		this.protectedPageUpdates.push( { tabId, message } );
		const presentation = this.protectedPagePresentations.get( tabId ) ?? {
			allowanceWarningId: null,
			interruptionLayerPresented: false,
		};

		if ( message.type === ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER ) {
			this.protectedPagePresentations.set( tabId, {
				allowanceWarningId: null,
				interruptionLayerPresented: true,
			} );
		} else if ( message.type === ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER ) {
			this.protectedPagePresentations.set( tabId, {
				...presentation,
				interruptionLayerPresented: false,
			} );
		}

		return Promise.resolve();
	};

	/**
	 * Records the latest global toolbar projection.
	 * @param projection - Current toolbar projection.
	 * @return Resolved browser operation.
	 */
	updateToolbarBadge = ( projection: ToolbarBadgeProjection ): Promise<void> => {
		this.badge = projection;
		return Promise.resolve();
	};
}

/**
 * Creates one initialized runtime with deterministic clocks and identifiers.
 * @param now - Mutable wall-clock holder.
 * @param configurationStorage - Local configuration storage.
 * @param browser - Browser-effect test double.
 * @param storage - Runtime state persistence shared across worker lifetimes.
 * @param toolbarBadgeCopy - Optional localized toolbar badge copy.
 * @return Initialized browser protection runtime and its coordinator.
 * @since 0.1.0 Initial implementation.
 */
function createRuntime(
	now: MutableClock,
	configurationStorage: MemoryConfigurationStorage,
	browser: MemoryRuntimeBrowser,
	storage: MemoryProtectionStorage = new MemoryProtectionStorage(),
	toolbarBadgeCopy?: ToolbarBadgeCopy,
): RuntimeTestHarness {
	/**
	 * Creates the deterministic test session identifier.
	 * @return Test session identifier.
	 */
	function createSessionContinuityId(): string {
		return 'session_runtime';
	}

	const coordinator = createProtectionCoordinator( {
		storage,
		createSessionContinuityId,
	} );
	let identifier = 0;

	/**
	 * Creates one deterministic runtime identifier fragment.
	 * @return Fresh test identifier fragment.
	 */
	function createStableId(): string {
		identifier += 1;
		return `runtime_${ String( identifier ) }`;
	}

	/**
	 * Returns the test time zone.
	 * @return UTC time-zone identifier.
	 */
	function getTimeZone(): string {
		return 'UTC';
	}

	/**
	 * Returns the mutable test clock instant.
	 * @return Current test epoch milliseconds.
	 */
	function getCurrentTime(): number {
		return now.value;
	}

	const runtime = createBrowserProtectionRuntime( {
		browser,
		configurationStorage,
		filterConfiguration: configurationStorage.filterForRuntime,
		coordinator,
		interruptionPageUrl: 'chrome-extension://extension-id/interruption.html',
		createStableId,
		getTimeZone,
		now: getCurrentTime,
		...( toolbarBadgeCopy === undefined ? {} : { toolbarBadgeCopy } ),
	} );

	return { coordinator, runtime };
}

/**
 * Completes the current focused pause and returns its Ready projection.
 * @param runtime - Browser protection runtime under test.
 * @param tabId - Interruption-page tab identifier.
 * @param durationMilliseconds - Displayed focused duration submitted by the page.
 * @return Authoritative interruption-page response after the checkpoint.
 */
function completeFocusedPause(
	runtime: BrowserProtectionRuntime,
	tabId: number,
	durationMilliseconds = 10_000,
): Promise<InterruptionPageResponse> {
	return runtime.handlePageRequest( {
		type: InterruptionPageRequestType.CHECKPOINT,
		documentVisible: true,
		displayedFocusedDurationMilliseconds: durationMilliseconds,
	}, tabId );
}

/**
 * Advances one protected page from its first visit through allowance expiry.
 * @param runtime - Browser protection runtime under test.
 * @param now - Mutable wall-clock holder.
 * @param tabId - Protected browser tab identifier.
 * @return Promise resolved after the injected interruption layer is presented.
 * @throws {Error} When the first pause does not reach Ready.
 */
async function presentAllowanceExpiryInterruption(
	runtime: BrowserProtectionRuntime,
	now: MutableClock,
	tabId = 7,
): Promise<void> {
	await runtime.start();
	await runtime.handleNavigation( { tabId, frameId: 0, url: 'https://example.com/' } );
	const ready = await completeFocusedPause( runtime, tabId );

	if ( ready.state !== InterruptionPageResponseState.READY ) {
		throw new Error( 'Expected the first pause to complete.' );
	}

	await runtime.handlePageRequest( {
		type: InterruptionPageRequestType.CONTINUE,
		documentVisible: true,
	}, tabId );
	now.value = ready.allowanceExpiresAtEpochMilliseconds;
	await runtime.handleClockTick();
}

describe( 'createBrowserProtectionRuntime', () => {
	it( 'excludes sites without current host access from matching and redirects', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.accessibleConfiguration = TestEmptyProtectionConfiguration;
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} );

		expect( configurationStorage.filterCalls ).toBeGreaterThan( 0 );
		expect( browser.rules ).toEqual( [] );
		expect( browser.navigations ).toEqual( [] );
		expect( ( await coordinator.getStates() )?.scope_default ).toBeUndefined();
	} );

	it( 'fails open when permission filtering returns malformed configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.filterForRuntime = vi.fn().mockResolvedValue( {
			version: 'invalid',
		} );
		const { runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
	} );

	it( 'keeps browser operations inert before runtime startup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.handleClockTick();
		await runtime.handleFocusChanged();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await runtime.handleTabRemoved( 7 );

		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
		expect( browser.rules ).toEqual( [] );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'fails open when persisted protection state cannot be restored', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		storage.throwOnLoad = true;
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
		);

		await runtime.start();

		expect( browser.rules ).toEqual( [] );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'restores protection after a required browser permission is granted again', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );

		await runtime.failOpen();
		expect( browser.rules ).toEqual( [] );

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );
	} );

	it( 'accepts explicit localized toolbar copy at runtime composition', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const localizedCopy: ToolbarBadgeCopy = {
			...EnglishToolbarBadgeCopy,
			inactive: { text: '', title: 'TOCus localizado' },
		};
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			new MemoryProtectionStorage(),
			localizedCopy,
		);

		await runtime.start();

		expect( browser.badge ).toEqual( {
			phase: 'inactive',
			text: '',
			title: 'TOCus localizado',
		} );
	} );

	it( 'recovers its operation queue after persistence rejects a protected visit', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const storage = new MemoryProtectionStorage();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
			storage,
		);
		await runtime.start();
		storage.throwOnSave = true;

		await expect( runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/',
		} ) ).rejects.toThrow( 'Protection state dispatch failed: storage-write-failed.' );

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		storage.throwOnSave = false;
		await expect( runtime.failOpen() ).resolves.toBeUndefined();
	} );

	it( 'connects a protected navigation through Waiting, Ready, Continue, and toolbar badges', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );

		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/watch?v=1',
		} );
		const waiting = await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 );

		expect( waiting ).toEqual( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 0,
			progressing: true,
		} );
		expect( browser.badge ).toMatchObject( { text: 'P10s', title: 'TOCus: Pause: 10 seconds remaining' } );

		const ready = await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 10_000,
		}, 7 );

		expect( ready ).toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: now.value + 300_000,
		} );
		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: 'V5m', title: 'TOCus: Visit window: 5 minutes remaining' } );
		expect( browser.protectionClockDeadlines ).toEqual( [
			now.value + 60_000,
			now.value + 290_000,
			now.value + 300_000,
		] );

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );

		expect( browser.navigations ).toEqual( [
			{
				tabId: 7,
				url: 'chrome-extension://extension-id/interruption.html',
			},
			{
				tabId: 7,
				url: 'https://example.com/watch?v=1',
			},
		] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.ALLOWANCE );
	} );

	it( 'ignores subframes and leaves scheduled-out navigation unprotected', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( {
			...EXAMPLE_CONFIGURATION,
			schedulesByScope: {
				scope_default: { mode: 'custom', windows: [ {
					weekday: 'Monday',
					startMinute: 0,
					endMinute: 1,
				} ] },
			},
		} );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		expect( browser.rules ).toEqual( [] );
		await runtime.handleNavigation( { tabId: 7, frameId: 1, url: 'https://example.com/frame' } );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( ( await coordinator.getStates() )?.scope_default ).toBeUndefined();
	} );

	it( 'releases a navigation caught by a stale rule after its schedule ends', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			schedulesByScope: {
				scope_default: {
					mode: 'custom',
					windows: [ { weekday: 'Wednesday', startMinute: 720, endMinute: 721 } ],
				},
			},
		} );
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( configuration ),
			browser,
		);
		await runtime.start();
		now.value += 120_000;
		browser.tabs = [ { id: 7, url: 'chrome-extension://extension-id/interruption.html' } ];

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.tabs ).toEqual( [ { id: 7, url: 'https://example.com/' } ] );
	} );

	it( 'releases a navigation caught by a stale rule after its site is removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.configuration = TestEmptyProtectionConfiguration;
		browser.tabs = [ { id: 7, url: 'chrome-extension://extension-id/interruption.html' } ];

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.tabs ).toEqual( [ { id: 7, url: 'https://example.com/' } ] );
	} );

	it( 'ends an active wait when navigation observes that its scope was removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		configurationStorage.configuration = TestEmptyProtectionConfiguration;

		await runtime.handleNavigation( {
			tabId: 7,
			frameId: 0,
			url: 'https://unprotected.test/',
		} );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.rules ).toEqual( [] );
	} );

	it( 'does not duplicate an existing wait for the same retained navigation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		const state = ( await coordinator.getStates() )?.scope_default;

		expect( state?.type ).toBe( ProtectionStateType.WAITING );
		expect( state?.type === ProtectionStateType.WAITING ? state.participants : [] ).toHaveLength( 1 );
		expect( browser.navigations ).toEqual( [ {
			tabId: 7,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'abandons a pending wait when its browser tab closes', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		await runtime.handleTabRemoved( 7 );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'releases an active wait when its protection scope is removed', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		configurationStorage.configuration = TestEmptyProtectionConfiguration;
		await runtime.handleConfigurationChanged();
		await runtime.handleClockTick();

		expect( browser.rules ).toEqual( [] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'shares one visit allowance across grouped sites and newly opened tabs', async () => {
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
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );
		await runtime.handleTabRemoved( 7 );
		browser.tabs = [ { id: 8, url: 'https://another.test/feed' } ];
		browser.focusedTabId = 8;

		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://another.test/feed' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( browser.tabs ).toEqual( [ { id: 8, url: 'https://another.test/feed' } ] );
		expect( browser.navigations ).toHaveLength( 2 );
	} );

	it( 'keeps an independent site outside another scope allowance', async () => {
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
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );
		browser.tabs.push( { id: 8, url: 'https://independent.test/feed' } );
		browser.focusedTabId = 8;

		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://independent.test/feed' } );

		const states = await coordinator.getStates();

		expect( states?.scope_default?.type ).toBe( ProtectionStateType.ALLOWANCE );
		expect( states?.scope_independent?.type ).toBe( ProtectionStateType.WAITING );
		expect( browser.badge ).toMatchObject( { text: 'P10s' } );
	} );

	it( 'pauses focused progress while the browser application is not focused', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		browser.focusedTabId = null;
		await runtime.handleFocusChanged();

		const paused = await completeFocusedPause( runtime, 7 );

		expect( paused ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			focusedProgressMilliseconds: 0,
			progressing: false,
		} );
		browser.focusedTabId = 7;
		await runtime.handleFocusChanged();

		expect( await completeFocusedPause( runtime, 7 ) ).toMatchObject( {
			state: InterruptionPageResponseState.READY,
		} );
	} );

	it( 'releases a waiting page when its local schedule ends', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			schedulesByScope: {
				scope_default: {
					mode: 'custom',
					windows: [ { weekday: 'Wednesday', startMinute: 720, endMinute: 721 } ],
				},
			},
		} );
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( configuration ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		now.value += 120_000;

		await runtime.handleClockTick();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.tabs ).toEqual( [ { id: 7, url: 'https://example.com/' } ] );
		expect( browser.rules ).toEqual( [] );
	} );

	it( 'releases a waiting participant whose site leaves a shared scope', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( GROUPED_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		configurationStorage.configuration = ProtectionConfigurationDocumentSchema.parse( {
			...GROUPED_CONFIGURATION,
			sites: GROUPED_CONFIGURATION.sites.filter( ( site ) => site.identityHost === 'another.test' ),
		} );

		await runtime.handleConfigurationChanged();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.tabs ).toEqual( [ { id: 7, url: 'https://example.com/' } ] );
	} );

	it( 'gently interrupts a live protected page when its allowance expires', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const ready = await completeFocusedPause( runtime, 7 );

		if ( ready.state !== InterruptionPageResponseState.READY ) {
			throw new Error( 'Expected the first pause to complete.' );
		}

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );
		now.value = ready.allowanceExpiresAtEpochMilliseconds;
		await runtime.handleClockTick();

		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 15_000,
		} );
		await completeFocusedPause( runtime, 7, 15_000 );
		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER },
		} );
		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} );
		expect( browser.dismissedTabs ).toEqual( [] );
	} );

	it( 'removes every injected interruption layer during direct fail-open', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await presentAllowanceExpiryInterruption( runtime, now );
		browser.tabs.push( { id: 8, url: 'https://unrelated.test/' } );
		browser.protectedPagePresentations.set( 8, {
			allowanceWarningId: null,
			interruptionLayerPresented: true,
		} );

		await runtime.failOpen();

		expect( browser.protectedPagePresentations.get( 7 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
		expect( browser.protectedPagePresentations.get( 8 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
		expect( browser.protectedPageUpdates.filter(
			( update ) => update.message.type === ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		) ).toEqual( expect.arrayContaining( [
			{
				tabId: 7,
				message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
			},
			{
				tabId: 8,
				message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
			},
		] ) );
	} );

	it( 'removes an owned expiry layer when configuration becomes unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await presentAllowanceExpiryInterruption( runtime, now );
		configurationStorage.configuration = null;

		await runtime.handleConfigurationChanged();

		expect( browser.protectedPagePresentations.get( 7 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
	} );

	it( 'removes an owned expiry layer before its configured scope is discarded', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await presentAllowanceExpiryInterruption( runtime, now );
		configurationStorage.configuration = TestEmptyProtectionConfiguration;

		await runtime.handleConfigurationChanged();

		expect( browser.protectedPagePresentations.get( 7 ) ).toMatchObject( {
			interruptionLayerPresented: false,
		} );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'interrupts another protected allowance tab when it receives focus', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( GROUPED_CONFIGURATION ),
			browser,
		);

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const ready = await completeFocusedPause( runtime, 7 );

		if ( ready.state !== InterruptionPageResponseState.READY ) {
			throw new Error( 'Expected the first pause to complete.' );
		}

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );
		browser.tabs.push( { id: 8, url: 'https://another.test/feed' } );
		now.value = ready.allowanceExpiresAtEpochMilliseconds;
		await runtime.handleClockTick();

		browser.focusedTabId = 8;
		await runtime.handleFocusChanged();

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 8,
			message: { type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER },
		} );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 8 ) ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			progressing: true,
		} );
	} );

	it( 'expires an elapsed allowance before reconciling browser focus', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const ready = await completeFocusedPause( runtime, 7 );

		if ( ready.state !== InterruptionPageResponseState.READY ) {
			throw new Error( 'Expected the first pause to complete.' );
		}

		await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7 );
		now.value = ready.allowanceExpiresAtEpochMilliseconds;

		await runtime.handleFocusChanged();

		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 15_000,
			progressing: true,
		} );
	} );

	it( 'reconciles a persisted Ready page when the background runtime restarts', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const firstRuntime = createRuntime( now, configurationStorage, browser, storage ).runtime;

		await firstRuntime.start();
		await firstRuntime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( firstRuntime, 7 );

		const restartedRuntime = createRuntime( now, configurationStorage, browser, storage ).runtime;
		await restartedRuntime.start();

		expect( await restartedRuntime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toMatchObject( {
			state: InterruptionPageResponseState.READY,
		} );
	} );

	it( 'removes a restored Waiting participant whose tab moved while runtime was asleep', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const firstRuntime = createRuntime( now, configurationStorage, browser, storage ).runtime;

		await firstRuntime.start();
		await firstRuntime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		browser.tabs = [ { id: 7, url: 'https://unrelated.test/' } ];
		browser.navigations = [];

		const restarted = createRuntime( now, configurationStorage, browser, storage );
		await restarted.runtime.start();

		expect( ( await restarted.coordinator.getStates() )?.scope_default?.type ).toBe(
			ProtectionStateType.IDLE,
		);
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'starts a protected wait when non-authoritative snapshots are temporarily unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		const originalGetStates = coordinator.getStates.bind( coordinator );
		let getStatesInvocation = 0;
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockImplementation( async () => {
			getStatesInvocation += 1;

			return getStatesInvocation === 1 || getStatesInvocation === 3
				? null
				: originalGetStates();
		} );

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		getStates.mockRestore();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.WAITING );
	} );

	it( 'abandons a retained wait before an unprotected top-level navigation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/first' } );

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://unprotected.test/' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( browser.navigations ).toEqual( [
			{
				tabId: 7,
				url: 'chrome-extension://extension-id/interruption.html',
			},
			{
				tabId: 7,
				url: 'https://unprotected.test/',
			},
		] );
	} );

	it( 'finishes navigation cleanup when the post-departure snapshot becomes unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/first' } );
		const originalGetStates = coordinator.getStates.bind( coordinator );
		let getStatesInvocation = 0;
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockImplementation( async () => {
			getStatesInvocation += 1;

			return getStatesInvocation === 6 ? null : originalGetStates();
		} );

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://unprotected.test/' } );
		getStates.mockRestore();

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	} );

	it( 'tolerates unavailable state snapshots during tab cleanup and focus reconciliation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		const getStates = vi.spyOn( coordinator, 'getStates' );
		getStates.mockResolvedValueOnce( null );

		await runtime.handleTabRemoved( 99 );
		getStates.mockResolvedValueOnce( null );
		await runtime.handleFocusChanged();

		expect( browser.rules ).toHaveLength( 1 );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'keeps focus reconciliation inert while authoritative state is unavailable', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockResolvedValue( null );

		await runtime.handleFocusChanged();
		getStates.mockRestore();

		expect( browser.rules ).toHaveLength( 1 );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'keeps an active allowance out of Waiting focus reconciliation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		await completeFocusedPause( runtime, 7 );

		await runtime.handleFocusChanged();

		expect( browser.badge ).toMatchObject( { text: 'V5m' } );
	} );

	it( 'pauses a participant when its tab disappears between focus observations', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const listTabs = vi.spyOn( browser, 'listTabs' );
		listTabs.mockResolvedValueOnce( browser.tabs );
		listTabs.mockResolvedValueOnce( [] );

		await runtime.handleFocusChanged();
		listTabs.mockRestore();

		const state = ( await coordinator.getStates() )?.scope_default;

		expect( state?.type ).toBe( ProtectionStateType.WAITING );
		expect( state?.type === ProtectionStateType.WAITING
			? state.participants[ 0 ]?.focusEligible
			: true ).toBe( false );
	} );

	it( 'ignores invalid and stale participant tabs during focus reconciliation', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const { coordinator, runtime } = createRuntime(
			now,
			new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION ),
			browser,
		);
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		const statesByScope = await coordinator.getStates();
		const waitingState = statesByScope?.scope_default;

		if ( waitingState?.type !== ProtectionStateType.WAITING ) {
			throw new Error( 'Expected a Waiting state before focus reconciliation.' );
		}

		const participant = waitingState.participants[ 0 ];

		if ( participant === undefined ) {
			throw new Error( 'Expected a retained Waiting participant.' );
		}

		const observedStates = {
			...statesByScope,
			scope_default: {
				...waitingState,
				participants: [
					{
						...participant,
						participantId: ParticipantIdSchema.parse( 'participant_invalid_page' ),
						pageId: PageIdSchema.parse( 'page_external' ),
						focusEligible: false,
					},
					participant,
				],
			},
			scope_idle: createIdleState(),
		};
		const originalGetStates = coordinator.getStates.bind( coordinator );
		let getStatesInvocation = 0;
		const getStates = vi.spyOn( coordinator, 'getStates' ).mockImplementation( async () => {
			getStatesInvocation += 1;

			if ( getStatesInvocation === 5 ) {
				return null;
			}

			return getStatesInvocation <= 4 ? observedStates : originalGetStates();
		} );

		await runtime.handleFocusChanged();
		getStates.mockRestore();

		expect( browser.badge ).toMatchObject( { text: 'P10s' } );
	} );

	it( 'removes browser projections when focus reconciliation cannot validate configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.configuration = null;

		await runtime.handleFocusChanged();

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
	} );

	it( 'fails open when navigation cannot validate a previously available configuration', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		configurationStorage.configuration = null;

		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'releases every interruption tab when configuration fails during tab cleanup', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( GROUPED_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		browser.tabs.push( { id: 8, url: 'https://another.test/feed' } );
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://another.test/feed' } );
		configurationStorage.configuration = null;
		browser.tabs = browser.tabs.filter( ( tab ) => tab.id !== 8 );

		await runtime.handleTabRemoved( 8 );

		expect( browser.tabs ).toEqual( [ { id: 7, url: 'https://example.com/' } ] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );

	it( 'starts a fresh wait after fail-open configuration recovery', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		const { coordinator, runtime } = createRuntime( now, configurationStorage, browser );
		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
		configurationStorage.throwOnLoad = true;

		await runtime.handleClockTick();

		expect( browser.tabs ).toEqual( [ { id: 7, url: 'https://example.com/' } ] );
		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
		configurationStorage.throwOnLoad = false;
		await runtime.handleConfigurationChanged();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( ( await coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.WAITING );
		expect( browser.tabs ).toEqual( [ {
			id: 7,
			url: 'chrome-extension://extension-id/interruption.html',
		} ] );
	} );

	it( 'fails open when local configuration cannot be loaded', async () => {
		const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
		const browser = new MemoryRuntimeBrowser();
		const configurationStorage = new MemoryConfigurationStorage( EXAMPLE_CONFIGURATION );
		configurationStorage.throwOnLoad = true;
		const { runtime } = createRuntime( now, configurationStorage, browser );

		await runtime.start();
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );

		expect( browser.rules ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { text: '' } );
		expect( await runtime.handlePageRequest( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7 ) ).toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	} );
} );
