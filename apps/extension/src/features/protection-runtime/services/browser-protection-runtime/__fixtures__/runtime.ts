import { type Browser } from 'wxt/browser';
import {
	createProtectionCoordinator,
	type LoadedProtectionState,
	type ProtectionCoordinator,
	type ProtectionStorageService,
} from '../../../../../domains/protection';
import { type ProtectionConfigurationStorageService } from '../../../../../domains/protection/services/protection-configuration-storage';
import { TestEmptyProtectionConfiguration } from '../../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../../domains/protection/types/protection-value';
import {
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
} from '../../../utils/toolbar-badge-projection';
import { TestEnglishLocalizationBundle } from '../../../../../localization/__fixtures__';
import {
	InterruptionPageRequestType,
	InterruptionPageResponseState,
	type InterruptionPageResponse,
} from '../../../types/runtime-message';
import {
	ProtectedPageMessageType,
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from '../../../types/protected-page-message';
import { createBrowserProtectionRuntime } from '../index';
import { type BrowserProtectionRuntime } from '../types';
import {
	type ProtectionClockDeadlines,
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeTab,
} from '../../../types/browser-runtime';
import { type StatisticsRuntime } from '../../../../statistics/services/statistics-runtime';
import { createInertStatisticsRuntime } from './statistics-runtime';

/**
 * Mutable wall-clock holder used by runtime integration tests.
 * @since 0.1.0 Initial implementation.
 */
export interface MutableClock {
	value: number;
}

/**
 * Promise whose completion is controlled by one runtime integration test.
 * @since 0.1.0 Initial implementation.
 */
export class DeferredPromise {
	/**
	 * Promise settled through the fixture's resolve method.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly promise: Promise<void>;

	/**
	 * Captured promise settlement operation.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolvePromise: ( () => void ) | null = null;

	/**
	 * Creates one unresolved promise.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor() {
		this.promise = new Promise<void>( ( resolve ) => {
			this.resolvePromise = resolve;
		} );
	}

	/**
	 * Resolves the pending promise once.
	 * @since 0.1.0 Initial implementation.
	 */
	resolve(): void {
		this.resolvePromise?.();
		this.resolvePromise = null;
	}
}

/**
 * Lets queued promise continuations settle through one browser task.
 * @return Promise resolved on the next task.
 * @since 0.1.0 Initial implementation.
 */
export function waitForQueuedWork(): Promise<void> {
	return new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
}

/**
 * Initialized runtime services returned to integration tests.
 * @since 0.1.0 Initial implementation.
 */
export interface RuntimeTestHarness {
	coordinator: ProtectionCoordinator;
	runtime: BrowserProtectionRuntime;
}

/**
 * Single-site configuration used by focused runtime scenarios.
 * @since 0.1.0 Initial implementation.
 */
export const EXAMPLE_CONFIGURATION: ProtectionConfigurationDocument = {
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

/**
 * Shared-scope configuration used by grouped-site runtime scenarios.
 * @since 0.1.0 Initial implementation.
 */
export const GROUPED_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
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

/**
 * Multiple-scope configuration used by independent-site runtime scenarios.
 * @since 0.1.0 Initial implementation.
 */
export const MULTI_SCOPE_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
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
	measurementRevisionsByScope: {
		scope_default: 'revision_default',
		scope_independent: 'revision_independent',
	},
} );

/**
 * In-memory state persistence used by runtime integration tests.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryProtectionStorage implements ProtectionStorageService {
	/**
	 * Current in-memory protection state.
	 * @since 0.1.0 Initial implementation.
	 */
	state: LoadedProtectionState = {};

	/**
	 * Whether protection-state reads reject.
	 * @since 0.1.0 Initial implementation.
	 */
	throwOnLoad = false;

	/**
	 * Whether protection-state writes reject.
	 * @since 0.1.0 Initial implementation.
	 */
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

	/**
	 * Retains only a durable statistics-acknowledgement document.
	 * @param input - Current durable protection state.
	 * @return Promise resolved after the durable write.
	 * @since 0.1.0 Initial implementation.
	 */
	saveDurableStatisticsDelivery( input: unknown ): Promise<void> {
		this.state = { ...this.state, durable: input };
		return Promise.resolve();
	}
}

/**
 * In-memory protected-site configuration storage.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryConfigurationStorage implements ProtectionConfigurationStorageService {
	/**
	 * Optional permission-filtered configuration override.
	 * @since 0.1.0 Initial implementation.
	 */
	accessibleConfiguration: ProtectionConfigurationDocument | null = null;

	/**
	 * Number of permission-filtered configuration reads.
	 * @since 0.1.0 Initial implementation.
	 */
	filterCalls = 0;

	/**
	 * Whether permission filtering rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	throwOnFilter = false;

	/**
	 * Whether configuration reads reject.
	 * @since 0.1.0 Initial implementation.
	 */
	throwOnLoad = false;

	/**
	 * Creates configuration storage with one initial document.
	 * @param configuration - Initial local configuration.
	 * @since 0.1.0 Initial implementation.
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

		if ( this.throwOnFilter ) {
			return Promise.reject( new Error( 'Permission filtering unavailable.' ) );
		}

		return Promise.resolve( this.accessibleConfiguration ?? configuration );
	};
}

/**
 * Browser-effect test double used by runtime integration tests.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryRuntimeBrowser implements ProtectionRuntimeBrowser {
	/**
	 * Latest toolbar badge projection.
	 * @since 0.1.0 Initial implementation.
	 */
	badge: ToolbarBadgeProjection | null = null;

	/**
	 * Browser tabs dismissed by interruption cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	dismissedTabs: number[] = [];

	/**
	 * Current focused browser tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	focusedTabId: number | null = 7;

	/**
	 * Accepted browser tab navigations.
	 * @since 0.1.0 Initial implementation.
	 */
	navigations: Array<{ tabId: number; url: string }> = [];

	/**
	 * Protected-page presentation messages sent by the runtime.
	 * @since 0.1.0 Initial implementation.
	 */
	protectedPageUpdates: Array<{ tabId: number; message: ProtectedPageMessage }> = [];

	/**
	 * Current protected-page presentation by tab.
	 * @since 0.1.0 Initial implementation.
	 */
	protectedPagePresentations = new Map<number, ProtectedPagePresentationStatus>();

	/**
	 * Current extension-owned navigation rules.
	 * @since 0.1.0 Initial implementation.
	 */
	rules: Browser.declarativeNetRequest.Rule[] = [];

	/**
	 * Current protection-clock deadlines.
	 * @since 0.1.0 Initial implementation.
	 */
	protectionClockDeadlines: ProtectionClockDeadlines = [];

	/**
	 * Current browser tab snapshot.
	 * @since 0.1.0 Initial implementation.
	 */
	tabs: ProtectionRuntimeTab[] = [ {
		id: 7,
		incognito: false,
		url: 'https://example.com/watch?v=1',
	} ];

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
	 * @since 0.1.0 Initial implementation.
	 */
	synchronizeProtectionClock = ( deadlines: ProtectionClockDeadlines ): Promise<void> => {
		this.protectionClockDeadlines = deadlines;
		return Promise.resolve();
	};

	/**
	 * Replaces all extension-owned dynamic rules.
	 * @param rules - Complete replacement rule set.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
	 */
	replaceNavigationRules = ( rules: Browser.declarativeNetRequest.Rule[] ): Promise<void> => {
		this.rules = rules;
		return Promise.resolve();
	};

	/**
	 * Returns the currently focused test tab.
	 * @return Focused test tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedTabId = (): Promise<number | null> => Promise.resolve( this.focusedTabId );

	/**
	 * Lists current test tabs.
	 * @return Current test tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs = (): Promise<ReadonlyArray<ProtectionRuntimeTab>> => Promise.resolve( this.tabs );

	/**
	 * Records an accepted tab navigation.
	 * @param tabId - Navigated tab identifier.
	 * @param url - Accepted retained destination.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
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
	 * @since 0.1.0 Initial implementation.
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
	 * @since 0.1.0 Initial implementation.
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
 * @param toolbarBadgeCopy - Localized toolbar badge copy.
 * @param statisticsRuntime - Optional statistics observer under test.
 * @return Initialized browser protection runtime and its coordinator.
 * @since 0.1.0 Initial implementation.
 */
export function createRuntime(
	now: MutableClock,
	configurationStorage: MemoryConfigurationStorage,
	browser: MemoryRuntimeBrowser,
	storage: MemoryProtectionStorage = new MemoryProtectionStorage(),
	toolbarBadgeCopy: ToolbarBadgeCopy = TestEnglishLocalizationBundle.toolbar,
	statisticsRuntime: StatisticsRuntime = createInertStatisticsRuntime(),
): RuntimeTestHarness {
	/**
	 * Creates the deterministic test session identifier.
	 * @return Test session identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function createSessionContinuityId(): string {
		return 'session_runtime';
	}

	let factBatchIdentifier = 0;

	/**
	 * Creates one deterministic protection-fact batch identifier.
	 * @return Fresh test fact-batch identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function createProtectionFactBatchId(): string {
		factBatchIdentifier += 1;
		return `fact_batch_runtime_${ String( factBatchIdentifier ) }`;
	}

	const coordinator = createProtectionCoordinator( {
		storage,
		createProtectionFactBatchId,
		createSessionContinuityId,
	} );
	let identifier = 0;

	/**
	 * Creates one deterministic runtime identifier fragment.
	 * @return Fresh test identifier fragment.
	 * @since 0.1.0 Initial implementation.
	 */
	function createStableId(): string {
		identifier += 1;
		return `runtime_${ String( identifier ) }`;
	}

	/**
	 * Returns the test time zone.
	 * @return UTC time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function getTimeZone(): string {
		return 'UTC';
	}

	/**
	 * Returns the mutable test clock instant.
	 * @return Current test epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
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
		statisticsRuntime,
		toolbarBadgeCopy,
	} );

	return { coordinator, runtime };
}

/**
 * Completes the current focused pause and returns its Ready projection.
 * @param runtime - Browser protection runtime under test.
 * @param tabId - Interruption-page tab identifier.
 * @param durationMilliseconds - Displayed focused duration submitted by the page.
 * @return Authoritative interruption-page response after the checkpoint.
 * @since 0.1.0 Initial implementation.
 */
export function completeFocusedPause(
	runtime: BrowserProtectionRuntime,
	tabId: number,
	durationMilliseconds = 10_000,
): Promise<InterruptionPageResponse> {
	return runtime.handlePageRequest( {
		type: InterruptionPageRequestType.CHECKPOINT,
		documentVisible: true,
		displayedFocusedDurationMilliseconds: durationMilliseconds,
	}, tabId, true );
}

/**
 * Advances one protected page from its first visit through allowance expiry.
 * @param runtime - Browser protection runtime under test.
 * @param now - Mutable wall-clock holder.
 * @param tabId - Protected browser tab identifier.
 * @return Promise resolved after the injected interruption layer is presented.
 * @throws {Error} When the first pause does not reach Ready.
 * @since 0.1.0 Initial implementation.
 */
export async function presentAllowanceExpiryInterruption(
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
	}, tabId, true );
	now.value = ready.allowanceExpiresAtEpochMilliseconds;
	await runtime.handleClockTick();
}
