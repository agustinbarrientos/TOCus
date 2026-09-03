import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorDispatchStatus,
	ProtectionCoordinatorFailureReason,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	createNavigationParticipant,
	createWaitingState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import {
	ProtectionDecisionSchema,
	ProtectionDecisionType,
	type ProtectionDecision,
} from '../../../../domains/protection/types/protection-decision';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	AllowanceProtectionStateSchema,
	type AllowanceProtectionState,
} from '../../../../domains/protection/types/protection-state';
import {
	ProtectionParticipantOrigin,
	type AllowanceExpiryProtectionParticipant,
	type ProtectionParticipant,
} from '../../../../domains/protection/types/protection-participant';
import {
	DefaultProtectionScopeId,
	PageIdSchema,
	ParticipantIdSchema,
	type ProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import {
	ProtectedPageMessageType,
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from '../../types/protected-page-message';
import {
	EnglishToolbarBadgeCopy,
	ToolbarBadgePhase,
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
} from '../../utils/toolbar-badge-projection';
import {
	type ProtectionClockDeadlines,
	type ProtectionRuntimeBrowser,
	type ProtectionRuntimeTab,
} from '../../types/browser-runtime';
import { createBrowserProtectionProjector } from './index';
import { type BrowserProtectionProjector } from './types';

/** Extension-owned interruption URL used by browser-effect fixtures. */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/** Fixed wall-clock instant used by projector fixtures. */
const NOW_EPOCH_MILLISECONDS = 1_000_000;

/** Protected-site configuration used by projector fixtures. */
const CONFIGURATION: ProtectionConfigurationDocument = {
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

afterEach( () => {
	vi.restoreAllMocks();
} );

/**
 * Mutable authoritative state boundary used by projector tests.
 * @since 0.1.0 Initial implementation.
 */
class ProjectorCoordinatorFixture {
	/**
	 * Creates a coordinator fixture with one initial state snapshot.
	 * @param states - Initial authoritative states or unavailable marker.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public states: ProtectionCoordinatorStateSnapshot | null ) {}

	/**
	 * Returns the current authoritative state fixture.
	 * @return Current state snapshot or unavailable marker.
	 * @since 0.1.0 Initial implementation.
	 */
	getStates(): Promise<ProtectionCoordinatorStateSnapshot | null> {
		return Promise.resolve( this.states );
	}
}

/**
 * In-memory browser effects used by projector tests.
 * @since 0.1.0 Initial implementation.
 */
class ProjectorBrowserFixture implements ProtectionRuntimeBrowser {
	/** Last global toolbar projection. */
	badge: ToolbarBadgeProjection | null = null;

	/** Tabs dismissed through browser-native history. */
	dismissedTabIds: number[] = [];

	/** Active tab in the focused browser window. */
	focusedTabId: number | null = null;

	/** Accepted tab navigations in call order. */
	navigations: Array<{ tabId: number; url: string }> = [];

	/** Current protected-page presentation status by tab. */
	protectedPagePresentations = new Map<number, ProtectedPagePresentationStatus | null>();

	/** Protected-page presentation commands in call order. */
	protectedPageUpdates: Array<{ message: ProtectedPageMessage; tabId: number }> = [];

	/** Number of open-tab observation attempts. */
	listTabsCallCount = 0;

	/** Number of semantic alarm synchronization attempts. */
	synchronizeProtectionClockCallCount = 0;

	/** Number of global badge projection attempts. */
	updateToolbarBadgeCallCount = 0;

	/** Latest semantic protection-clock deadlines. */
	protectionClockDeadlines: ProtectionClockDeadlines = [];

	/** Whether exact alarm projection rejects. */
	rejectAllowanceExpiry = false;

	/** Whether dynamic navigation-rule replacement rejects. */
	rejectNavigationRules = false;

	/** Whether open-tab observation rejects. */
	rejectTabObservation = false;

	/** Whether protected-page presentation observation rejects. */
	rejectProtectedPageObservation = false;

	/** Whether browser-native dismissal rejects. */
	rejectDismissal = false;

	/** Whether explicit tab navigation rejects. */
	rejectNavigation = false;

	/** Whether a protected-page presentation command rejects. */
	rejectProtectedPageUpdate = false;

	/** URL adopted by a tab immediately before a rejected dismissal. */
	dismissalFailureMovesTabToUrl: string | null = null;

	/** URL adopted by a tab immediately before a rejected navigation. */
	navigationFailureMovesTabToUrl: string | null = null;

	/** URL adopted by a tab immediately before a rejected protected-page update. */
	protectedPageFailureMovesTabToUrl: string | null = null;

	/** Whether global toolbar projection rejects. */
	rejectToolbarBadge = false;

	/** Current extension-owned navigation rules. */
	rules: Parameters<ProtectionRuntimeBrowser[ 'replaceNavigationRules' ]>[ 0 ] = [];

	/** Current open browser tabs. */
	tabs: ProtectionRuntimeTab[] = [];

	/**
	 * Dismisses one interruption page in the fixture.
	 * @param tabId - Browser tab identifier.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
	 */
	dismissInterruption = ( tabId: number ): Promise<void> => {
		if ( this.rejectDismissal ) {
			if ( this.dismissalFailureMovesTabToUrl !== null ) {
				const movedUrl = this.dismissalFailureMovesTabToUrl;

				this.tabs = this.tabs.map( ( tab ) => tab.id === tabId
					? { ...tab, url: movedUrl }
					: tab );
			}

			return Promise.reject( new Error( 'Dismissal failed.' ) );
		}

		this.dismissedTabIds.push( tabId );
		return Promise.resolve();
	};

	/**
	 * Returns the current protected-page presentation for one tab.
	 * @param tabId - Browser tab identifier.
	 * @return Current local presentation or absent-listener marker.
	 * @since 0.1.0 Initial implementation.
	 */
	getProtectedPagePresentation = (
		tabId: number,
	): Promise<ProtectedPagePresentationStatus | null> => this.rejectProtectedPageObservation
		? Promise.reject( new Error( 'Protected-page observation failed.' ) )
		: Promise.resolve( this.protectedPagePresentations.get( tabId ) ?? null );

	/**
	 * Returns the active tab in the focused browser window.
	 * @return Focused tab identifier or null.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedTabId = (): Promise<number | null> => Promise.resolve( this.focusedTabId );

	/**
	 * Lists current open browser tabs.
	 * @return Current open tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs = (): Promise<ReadonlyArray<ProtectionRuntimeTab>> => {
		this.listTabsCallCount += 1;
		return this.rejectTabObservation
			? Promise.reject( new Error( 'Tab observation failed.' ) )
			: Promise.resolve( this.tabs );
	};

	/**
	 * Records one accepted tab navigation.
	 * @param tabId - Browser tab identifier.
	 * @param url - Accepted destination.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
	 */
	navigateTab = ( tabId: number, url: string ): Promise<void> => {
		if ( this.rejectNavigation ) {
			if ( this.navigationFailureMovesTabToUrl !== null ) {
				const movedUrl = this.navigationFailureMovesTabToUrl;

				this.tabs = this.tabs.map( ( tab ) => tab.id === tabId
					? { ...tab, url: movedUrl }
					: tab );
			}

			return Promise.reject( new Error( 'Navigation failed.' ) );
		}

		this.navigations.push( { tabId, url } );
		this.tabs = this.tabs.map( ( tab ) => tab.id === tabId ? { ...tab, url } : tab );
		return Promise.resolve();
	};

	/**
	 * Captures one protected-page presentation command.
	 * @param tabId - Browser tab identifier.
	 * @param message - Warning or interruption-layer command.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
	 */
	updateProtectedPagePresentation = (
		tabId: number,
		message: ProtectedPageMessage,
	): Promise<void> => {
		if ( this.rejectProtectedPageUpdate ) {
			if ( this.protectedPageFailureMovesTabToUrl !== null ) {
				const movedUrl = this.protectedPageFailureMovesTabToUrl;

				this.tabs = this.tabs.map( ( tab ) => tab.id === tabId
					? { ...tab, url: movedUrl }
					: tab );
			}

			return Promise.reject( new Error( 'Protected-page update failed.' ) );
		}

		this.protectedPageUpdates.push( { message, tabId } );

		return Promise.resolve();
	};

	/**
	 * Synchronizes the semantic protection-clock deadlines.
	 * @param deadlines - Earliest expiry, warning, and badge deadlines.
	 * @return Promise settled according to the fixture failure mode.
	 * @since 0.1.0 Initial implementation.
	 */
	synchronizeProtectionClock = ( deadlines: ProtectionClockDeadlines ): Promise<void> => {
		this.synchronizeProtectionClockCallCount += 1;
		this.protectionClockDeadlines = deadlines;
		return this.rejectAllowanceExpiry
			? Promise.reject( new Error( 'Alarm projection failed.' ) )
			: Promise.resolve();
	};

	/**
	 * Replaces extension-owned dynamic navigation rules.
	 * @param rules - Complete replacement rule set.
	 * @return Promise settled according to the fixture failure mode.
	 * @since 0.1.0 Initial implementation.
	 */
	replaceNavigationRules = (
		rules: Parameters<ProtectionRuntimeBrowser[ 'replaceNavigationRules' ]>[ 0 ],
	): Promise<void> => {
		this.rules = rules;
		return this.rejectNavigationRules
			? Promise.reject( new Error( 'Navigation-rule projection failed.' ) )
			: Promise.resolve();
	};

	/**
	 * Replaces the global toolbar projection.
	 * @param projection - Complete browser-neutral badge projection.
	 * @return Promise settled according to the fixture failure mode.
	 * @since 0.1.0 Initial implementation.
	 */
	updateToolbarBadge = ( projection: ToolbarBadgeProjection ): Promise<void> => {
		this.updateToolbarBadgeCallCount += 1;
		this.badge = projection;
		return this.rejectToolbarBadge
			? Promise.reject( new Error( 'Toolbar projection failed.' ) )
			: Promise.resolve();
	};
}

/**
 * Creates one valid allowance state for projector tests.
 * @param scopeId - Protection scope identifier.
 * @param expiresAtEpochMilliseconds - Exact allowance expiry.
 * @return Validated allowance state.
 * @since 0.1.0 Initial implementation.
 */
function createAllowanceState(
	scopeId: ProtectionScopeId,
	expiresAtEpochMilliseconds: number,
): AllowanceProtectionState {
	return AllowanceProtectionStateSchema.parse( {
		type: 'allowance',
		scopeId,
		allowanceId: `allowance_${ scopeId }`,
		completedWaitId: null,
		startedAtEpochMilliseconds: expiresAtEpochMilliseconds - 300_000,
		expiresAtEpochMilliseconds,
		readyParticipants: [],
		ladder: {
			completedWaits: 0,
			greatestObservedLocalDate: '2026-09-02',
		},
	} );
}

/**
 * Creates one Waiting-state snapshot for explicit navigation participants.
 * @param participants - Navigation participants retained by the Waiting state.
 * @return Authoritative coordinator snapshot.
 * @since 0.1.0 Initial implementation.
 */
function createWaitingSnapshot(
	participants: ProtectionParticipant[],
): ProtectionCoordinatorStateSnapshot {
	return {
		[ DefaultProtectionScopeId ]: {
			...createWaitingState(),
			scopeId: DefaultProtectionScopeId,
			participants,
			ownerParticipantId: null,
			ownerEpoch: 0,
		},
	};
}

/**
 * Creates one expiry-origin participant attached to a live protected document.
 * @param tabId - Browser tab identifier encoded in the page identity.
 * @param focusEligible - Whether the page can own focused wait progress.
 * @return Validated-compatible expiry participant fixture.
 * @since 0.1.0 Initial implementation.
 */
function createExpiryParticipant(
	tabId: number,
	focusEligible = true,
): AllowanceExpiryProtectionParticipant {
	return {
		origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
		participantId: ParticipantIdSchema.parse( `participant_${ String( tabId ) }` ),
		pageId: PageIdSchema.parse( `page_tab_${ String( tabId ) }_expiry` ),
		retainedDestination: null,
		focusEligible,
		joinSequence: 0,
	};
}

/**
 * Creates one validated page decision.
 * @param input - Raw decision fixture.
 * @return Validated protection decision.
 * @since 0.1.0 Initial implementation.
 */
function createDecision( input: unknown ): ProtectionDecision {
	return ProtectionDecisionSchema.parse( input );
}

/**
 * Creates a browser projector around deterministic test boundaries.
 * @param browser - In-memory browser effects.
 * @param coordinator - Authoritative state fixture.
 * @param toolbarBadgeCopy - Optional localized toolbar copy.
 * @return Browser projector under test.
 * @since 0.1.0 Initial implementation.
 */
function createProjector(
	browser: ProjectorBrowserFixture,
	coordinator: ProjectorCoordinatorFixture,
	toolbarBadgeCopy?: ToolbarBadgeCopy,
): BrowserProtectionProjector {
	/**
	 * Returns the fixed test time zone.
	 * @return UTC time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function getTimeZone(): string {
		return 'UTC';
	}

	/**
	 * Returns the fixed test clock instant.
	 * @return Test epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	function now(): number {
		return NOW_EPOCH_MILLISECONDS;
	}

	return createBrowserProtectionProjector( {
		browser,
		coordinator,
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		...( toolbarBadgeCopy === undefined ? {} : { toolbarBadgeCopy } ),
		getTimeZone,
		now,
	} );
}

describe( 'createBrowserProtectionProjector', () => {
	it( 'forwards orphaned interruption recovery to page projection', async () => {
		const browser = new ProjectorBrowserFixture();
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );

		browser.tabs = [ { id: 31, url: INTERRUPTION_PAGE_URL } ];

		await projector.releaseInterruptionPresentation( 31 );

		expect( browser.dismissedTabIds ).toEqual( [ 31 ] );
	} );

	it( 'projects redirects, independent protection-clock deadlines, and one global badge', async () => {
		const browser = new ProjectorBrowserFixture();
		const nearerExpiry = NOW_EPOCH_MILLISECONDS + 59_000;
		const coordinator = new ProjectorCoordinatorFixture( {
			scope_default: createAllowanceState( DefaultProtectionScopeId, NOW_EPOCH_MILLISECONDS + 300_000 ),
			scope_nearer: createAllowanceState( 'scope_nearer' as ProtectionScopeId, nearerExpiry ),
			scope_elapsed: createAllowanceState( 'scope_elapsed' as ProtectionScopeId, NOW_EPOCH_MILLISECONDS ),
		} );
		const projector = createProjector( browser, coordinator );

		await projector.reconcile( CONFIGURATION );

		expect( browser.rules ).toEqual( [] );
		expect( browser.protectionClockDeadlines ).toEqual( [
			nearerExpiry - 10_000,
			nearerExpiry,
			NOW_EPOCH_MILLISECONDS + 60_000,
			NOW_EPOCH_MILLISECONDS + 290_000,
			NOW_EPOCH_MILLISECONDS + 300_000,
		] );
		expect( browser.badge ).toMatchObject( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			text: 'V5m',
		} );
	} );

	it( 'schedules the next custom-schedule transition without an active protection state', async () => {
		const browser = new ProjectorBrowserFixture();
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );
		const configuration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: 'custom',
					windows: [ { weekday: 'Thursday', startMinute: 17, endMinute: 18 } ],
				},
			},
		};

		await projector.reconcile( configuration );

		expect( browser.protectionClockDeadlines ).toEqual( [ 1_020_000 ] );
	} );

	it( 'reuses a future custom-schedule deadline across frequent state checkpoints', async () => {
		const NativeDateTimeFormat = Intl.DateTimeFormat;
		const formatterSpy = vi.spyOn( Intl, 'DateTimeFormat' ).mockImplementation(
			/**
			 * Creates a native formatter while retaining a named constructor-compatible test double.
			 * @param locales - Requested locales.
			 * @param options - Requested date-time format options.
			 * @return Native date-time formatter.
			 */
			function DateTimeFormat( locales, options ) {
				return new NativeDateTimeFormat( locales, options );
			},
		);
		const browser = new ProjectorBrowserFixture();
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );
		const configuration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: 'custom',
					windows: [ { weekday: 'Thursday', startMinute: 17, endMinute: 18 } ],
				},
			},
		};

		await projector.reconcile( configuration );
		const firstReconciliationFormatterCount = formatterSpy.mock.calls.length;
		await projector.reconcile( configuration );

		expect( firstReconciliationFormatterCount ).toBe( 2 );
		expect( formatterSpy ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'pre-schedules closely spaced independent allowance expiries and warnings', async () => {
		const browser = new ProjectorBrowserFixture();
		const firstExpiry = NOW_EPOCH_MILLISECONDS + 300_000;
		const secondExpiry = firstExpiry + 5_000;
		const coordinator = new ProjectorCoordinatorFixture( {
			scope_default: createAllowanceState( DefaultProtectionScopeId, firstExpiry ),
			scope_second: createAllowanceState( 'scope_second' as ProtectionScopeId, secondExpiry ),
		} );
		const projector = createProjector( browser, coordinator );

		await projector.reconcile( CONFIGURATION );

		expect( browser.protectionClockDeadlines ).toEqual( [
			NOW_EPOCH_MILLISECONDS + 5_000,
			NOW_EPOCH_MILLISECONDS + 60_000,
			firstExpiry - 10_000,
			secondExpiry - 10_000,
			firstExpiry,
			secondExpiry,
		] );
	} );

	it( 'schedules exact expiry after the final warning boundary has started', async () => {
		const browser = new ProjectorBrowserFixture();
		const expiry = NOW_EPOCH_MILLISECONDS + 5_000;
		const coordinator = new ProjectorCoordinatorFixture( {
			scope_default: createAllowanceState( DefaultProtectionScopeId, expiry ),
		} );
		const projector = createProjector( browser, coordinator );

		await projector.reconcile( CONFIGURATION );

		expect( browser.protectionClockDeadlines ).toEqual( [ expiry ] );
	} );

	it( 'uses the warning and expiry deadlines throughout the final allowance minute', async () => {
		const browser = new ProjectorBrowserFixture();
		const expiry = NOW_EPOCH_MILLISECONDS + 60_000;
		const coordinator = new ProjectorCoordinatorFixture( {
			scope_default: createAllowanceState( DefaultProtectionScopeId, expiry ),
		} );
		const projector = createProjector( browser, coordinator );

		await projector.reconcile( CONFIGURATION );

		expect( browser.protectionClockDeadlines ).toEqual( [
			expiry - 10_000,
			expiry,
		] );
	} );

	it( 'schedules the next rounded visit-window badge boundary before the final warning', async () => {
		const browser = new ProjectorBrowserFixture();
		const expiry = NOW_EPOCH_MILLISECONDS + 270_000;
		const coordinator = new ProjectorCoordinatorFixture( {
			scope_default: createAllowanceState( DefaultProtectionScopeId, expiry ),
		} );
		const projector = createProjector( browser, coordinator );

		await projector.reconcile( CONFIGURATION );

		expect( browser.protectionClockDeadlines ).toEqual( [
			NOW_EPOCH_MILLISECONDS + 30_000,
			expiry - 10_000,
			expiry,
		] );
	} );

	it( 're-presents an expiry-origin Ready participant over its live document', async () => {
		const browser = new ProjectorBrowserFixture();
		const participant = createExpiryParticipant( 22 );
		const allowance = AllowanceProtectionStateSchema.parse( {
			...createAllowanceState(
				DefaultProtectionScopeId,
				NOW_EPOCH_MILLISECONDS + 60_000,
			),
			completedWaitId: 'wait_22',
			readyParticipants: [ participant ],
		} );
		browser.tabs = [ { id: 22, url: 'https://example.com/draft' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {
			scope_default: allowance,
		} ) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: participant.participantId,
			pageId: participant.pageId,
			allowanceId: allowance.allowanceId,
		} ) ], CONFIGURATION );

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 22,
			message: { type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER },
		} );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'dismisses an expiry-origin layer without navigating the preserved page', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 23, url: 'https://example.com/preserved' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant_23',
			pageId: 'page_tab_23_expiry',
		} ) ], CONFIGURATION );

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 23,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} );
		expect( browser.navigations ).toEqual( [] );
		expect( browser.dismissedTabIds ).toEqual( [] );
	} );

	it( 'treats a rejected Ready layer update as benign after its protected page moves away', async () => {
		const browser = new ProjectorBrowserFixture();
		const participant = createExpiryParticipant( 24 );
		const allowance = AllowanceProtectionStateSchema.parse( {
			...createAllowanceState( DefaultProtectionScopeId, NOW_EPOCH_MILLISECONDS + 60_000 ),
			completedWaitId: 'wait_24',
			readyParticipants: [ participant ],
		} );
		browser.tabs = [ { id: 24, url: 'https://example.com/preserved' } ];
		browser.rejectProtectedPageUpdate = true;
		browser.protectedPageFailureMovesTabToUrl = 'https://unrelated.example/';
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {
			scope_default: allowance,
		} ) );

		await expect( projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: participant.participantId,
			pageId: participant.pageId,
			allowanceId: allowance.allowanceId,
		} ) ], CONFIGURATION ) ).resolves.toBeUndefined();
	} );

	it( 'treats a rejected layer dismissal as benign after its protected page moves away', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 25, url: 'https://example.com/preserved' } ];
		browser.rejectProtectedPageUpdate = true;
		browser.protectedPageFailureMovesTabToUrl = 'https://unrelated.example/';
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant_25',
			pageId: 'page_tab_25_expiry',
		} ) ], CONFIGURATION ) ).resolves.toBeUndefined();
	} );

	it( 'does not dismiss a layer without a visible protected destination', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 26 } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant_26',
			pageId: 'page_tab_26_expiry',
		} ) ], null );

		expect( browser.protectedPageUpdates ).toEqual( [ {
			tabId: 26,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'ignores stale Ready and dismissal decisions without matching live pages', async () => {
		const browser = new ProjectorBrowserFixture();
		const missingParticipant = createExpiryParticipant( 27 );
		const movedParticipant = createExpiryParticipant( 28 );
		const allowance = AllowanceProtectionStateSchema.parse( {
			...createAllowanceState( DefaultProtectionScopeId, NOW_EPOCH_MILLISECONDS + 60_000 ),
			completedWaitId: 'wait_27',
			readyParticipants: [ missingParticipant, movedParticipant ],
		} );
		browser.tabs = [ { id: 28, url: 'https://unrelated.example/' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {
			scope_default: allowance,
		} ) );

		await projector.applyDecisions( [
			createDecision( {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: missingParticipant.participantId,
				pageId: missingParticipant.pageId,
				allowanceId: allowance.allowanceId,
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: movedParticipant.participantId,
				pageId: movedParticipant.pageId,
				allowanceId: allowance.allowanceId,
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant_external',
				pageId: 'external_page',
				allowanceId: allowance.allowanceId,
			} ),
			createDecision( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant_external',
				pageId: 'external_page',
			} ),
			createDecision( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant_missing',
				pageId: 'page_tab_29_expiry',
			} ),
		], CONFIGURATION );

		expect( browser.protectedPageUpdates ).toEqual( [ {
			tabId: 28,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'ignores a Ready decision while authoritative state is unavailable', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 30, url: 'https://example.com/' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: 'participant_30',
			pageId: 'page_tab_30_expiry',
			allowanceId: 'allowance_30',
		} ) ], CONFIGURATION );

		expect( browser.protectedPageUpdates ).toEqual( [ {
			tabId: 30,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'clears browser projections when authoritative state is unavailable', async () => {
		const browser = new ProjectorBrowserFixture();
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );

		await projector.reconcile( null );

		expect( browser.rules ).toEqual( [] );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		expect( browser.badge ).toMatchObject( {
			phase: ToolbarBadgePhase.INACTIVE,
			text: '',
		} );
	} );

	it( 'keeps protection available when alarm and toolbar projection fail', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectAllowanceExpiry = true;
		browser.rejectToolbarBadge = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.reconcile( CONFIGURATION ) ).resolves.toBeUndefined();

		expect( browser.rules ).toHaveLength( 1 );
		expect( browser.synchronizeProtectionClockCallCount ).toBe( 1 );
		expect( browser.updateToolbarBadgeCallCount ).toBe( 1 );
	} );

	it( 'stops projection when dynamic redirect reconciliation fails', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectNavigationRules = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.reconcile( CONFIGURATION ) ).rejects.toThrow(
			'Navigation-rule projection failed.',
		);

		expect( browser.synchronizeProtectionClockCallCount ).toBe( 0 );
		expect( browser.updateToolbarBadgeCallCount ).toBe( 0 );
	} );

	it( 'applies persisted page decisions only to matching live interruption tabs', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [
			{ id: 1, url: 'https://example.com/' },
			{ id: 2, url: INTERRUPTION_PAGE_URL },
			{ id: 3 },
			{ id: 4, url: INTERRUPTION_PAGE_URL },
			{ id: 5, url: 'https://example.com/other' },
			{ id: 6, url: INTERRUPTION_PAGE_URL },
			{ id: 7, url: 'https://example.com/other' },
		];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [
				createNavigationParticipant(
					'participant_1',
					'page_tab_1_alpha',
					false,
					0,
					'https://example.com/',
				),
				createNavigationParticipant(
					'participant_2',
					'page_tab_2_alpha',
					false,
					1,
					'https://example.com/two',
				),
				createNavigationParticipant(
					'participant_3',
					'page_tab_3_alpha',
					false,
					2,
					'https://example.com/three',
				),
			] ),
		) );
		const decisions = [
			createDecision( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant_1',
				pageId: 'page_tab_1_alpha',
				waitId: 'wait_1',
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant_2',
				pageId: 'page_tab_2_alpha',
				waitId: 'wait_2',
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant_3',
				pageId: 'page_tab_3_alpha',
				waitId: 'wait_3',
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant_missing',
				pageId: 'page_tab_99_alpha',
				waitId: 'wait_missing',
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant_external',
				pageId: 'external_page',
				waitId: 'wait_external',
			} ),
			createDecision( {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant_4',
				pageId: 'page_tab_4_alpha',
				retainedDestination: 'https://example.com/released',
			} ),
			createDecision( {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant_5',
				pageId: 'page_tab_5_alpha',
				retainedDestination: 'https://example.com/ignored',
			} ),
			createDecision( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant_6',
				pageId: 'page_tab_6_alpha',
			} ),
			createDecision( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant_7',
				pageId: 'page_tab_7_alpha',
			} ),
			createDecision( {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant_8',
				pageId: 'page_tab_8_alpha',
				allowanceId: 'allowance_8',
			} ),
		];

		await projector.applyDecisions( decisions, CONFIGURATION );

		expect( browser.navigations ).toEqual( [
			{ tabId: 1, url: INTERRUPTION_PAGE_URL },
			{ tabId: 4, url: 'https://example.com/released' },
		] );
		expect( browser.dismissedTabIds ).toEqual( [ 6 ] );
	} );

	it( 'rechecks the live tab before each sequential decision', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 9, url: INTERRUPTION_PAGE_URL } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );
		const decisions = [
			createDecision( {
				type: ProtectionDecisionType.RELEASE_NAVIGATION,
				participantId: 'participant_9',
				pageId: 'page_tab_9_alpha',
				retainedDestination: 'https://example.com/released',
			} ),
			createDecision( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant_9',
				pageId: 'page_tab_9_alpha',
			} ),
		];

		await projector.applyDecisions( decisions, CONFIGURATION );

		expect( browser.navigations ).toEqual( [ {
			tabId: 9,
			url: 'https://example.com/released',
		} ] );
		expect( browser.dismissedTabIds ).toEqual( [] );
	} );

	it( 'releases a stale-rule navigation only while the interruption page remains current', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 9, url: INTERRUPTION_PAGE_URL } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await projector.releaseNavigationIfInterrupted( 9, 'https://example.com/released' );
		await projector.releaseNavigationIfInterrupted( 9, 'https://example.com/ignored' );

		expect( browser.navigations ).toEqual( [ {
			tabId: 9,
			url: 'https://example.com/released',
		} ] );
	} );

	it( 'does not inspect or mutate a tab without a runtime-owned page identity', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectProtectedPageObservation = true;
		const participant = {
			...createExpiryParticipant( 22 ),
			pageId: PageIdSchema.parse( 'page_external' ),
		};
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await projector.releaseInjectedInterruption( participant );

		expect( browser.protectedPagePresentations ).toEqual( new Map() );
		expect( browser.protectedPageUpdates ).toEqual( [] );
	} );

	it( 'applies accepted dispatch decisions after durable state is available', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 11, url: 'https://example.com/' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [ createNavigationParticipant(
				'participant_11',
				'page_tab_11_alpha',
				false,
				0,
				'https://example.com/',
			) ] ),
		) );
		const result: ProtectionCoordinatorDispatchResult = {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
			decisions: [ createDecision( {
				type: ProtectionDecisionType.PRESENT_WAITING,
				participantId: 'participant_11',
				pageId: 'page_tab_11_alpha',
				waitId: 'wait_11',
			} ) ],
			facts: [],
		};

		await projector.applyDispatchResult( result, CONFIGURATION );

		expect( browser.navigations ).toEqual( [ { tabId: 11, url: INTERRUPTION_PAGE_URL } ] );
	} );

	it( 'does not replace an unrelated page after a protected navigation moves away', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 13, url: 'https://unrelated.example/' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [ createNavigationParticipant(
				'participant_13',
				'page_tab_13_alpha',
				false,
				0,
				'https://example.com/',
			) ] ),
		) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: 'participant_13',
			pageId: 'page_tab_13_alpha',
			waitId: 'wait_13',
		} ) ], CONFIGURATION );

		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'does not present another waiting page during fail-open departure cleanup', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 13, url: 'https://example.com/' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [ createNavigationParticipant(
				'participant_13',
				'page_tab_13_alpha',
				false,
				0,
				'https://example.com/',
			) ] ),
		) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: 'participant_13',
			pageId: 'page_tab_13_alpha',
			waitId: 'wait_13',
		} ) ], null );

		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'does not present a waiting page without authoritative participant state', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 13, url: 'https://example.com/' } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );

		await projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: 'participant_13',
			pageId: 'page_tab_13_alpha',
			waitId: 'wait_13',
		} ) ], CONFIGURATION );

		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'treats a rejected waiting navigation as benign after its tab moves away', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 14, url: 'https://example.com/' } ];
		browser.rejectNavigation = true;
		browser.navigationFailureMovesTabToUrl = 'https://unrelated.example/';
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [ createNavigationParticipant(
				'participant_14',
				'page_tab_14_alpha',
				false,
				0,
				'https://example.com/',
			) ] ),
		) );

		await expect( projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: 'participant_14',
			pageId: 'page_tab_14_alpha',
			waitId: 'wait_14',
		} ) ], CONFIGURATION ) ).resolves.toBeUndefined();
	} );

	it( 'treats a rejected dismissal as benign after its interruption tab moves away', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 15, url: INTERRUPTION_PAGE_URL } ];
		browser.rejectDismissal = true;
		browser.dismissalFailureMovesTabToUrl = 'https://example.com/continued';
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant_15',
			pageId: 'page_tab_15_alpha',
		} ) ], CONFIGURATION ) ).resolves.toBeUndefined();
	} );

	it( 'propagates a rejected page effect while its expected source remains live', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 16, url: INTERRUPTION_PAGE_URL } ];
		browser.rejectDismissal = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.applyDecisions( [ createDecision( {
			type: ProtectionDecisionType.DISMISS_INTERRUPTION,
			participantId: 'participant_16',
			pageId: 'page_tab_16_alpha',
		} ) ], CONFIGURATION ) ).rejects.toThrow( 'Dismissal failed.' );
	} );

	it( 'isolates ancillary tab-observation failures when accepted decisions have no page effect', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectTabObservation = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );
		const result: ProtectionCoordinatorDispatchResult = {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
			decisions: [ createDecision( {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant_12',
				pageId: 'page_tab_12_alpha',
				allowanceId: 'allowance_12',
			} ) ],
			facts: [],
		};

		await expect( projector.applyDispatchResult( result, CONFIGURATION ) ).resolves.toBeUndefined();

		expect( browser.listTabsCallCount ).toBe( 2 );
	} );

	it( 'fails open and rejects when durable dispatch is rejected', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rules = [ { id: 9 } as Parameters<ProtectionRuntimeBrowser[ 'replaceNavigationRules' ]>[ 0 ][ number ] ];
		browser.protectionClockDeadlines = [ NOW_EPOCH_MILLISECONDS + 60_000 ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );
		const result: ProtectionCoordinatorDispatchResult = {
			status: ProtectionCoordinatorDispatchStatus.REJECTED,
			reason: ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED,
			decisions: [],
			facts: [],
		};

		await expect( projector.applyDispatchResult( result, CONFIGURATION ) ).rejects.toThrow(
			'Protection state dispatch failed: storage-write-failed.',
		);

		expect( browser.rules ).toEqual( [] );
		expect( browser.protectionClockDeadlines ).toEqual( [] );
		expect( browser.badge ).toMatchObject( { phase: ToolbarBadgePhase.INACTIVE } );
	} );

	it( 'completes fail-open cleanup despite ancillary browser failures', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectAllowanceExpiry = true;
		browser.rejectToolbarBadge = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.failOpen() ).resolves.toBeUndefined();

		expect( browser.rules ).toEqual( [] );
		expect( browser.synchronizeProtectionClockCallCount ).toBe( 1 );
		expect( browser.updateToolbarBadgeCallCount ).toBe( 1 );
	} );

	it( 'rejects fail-open cleanup when an injected interruption layer cannot be removed', async () => {
		const browser = new ProjectorBrowserFixture();

		browser.tabs = [ { id: 7, url: 'https://example.com/preserved' } ];
		browser.rejectProtectedPageUpdate = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.failOpen() ).rejects.toThrow( 'Protected-page update failed.' );
	} );

	it( 'clears an injected allowance expiry guard during fail-open cleanup', async () => {
		const browser = new ProjectorBrowserFixture();

		browser.tabs = [ { id: 7 } ];
		browser.rejectProtectedPageObservation = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await projector.failOpen();

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD },
		} );
	} );

	it( 'clears an injected interruption when authoritative state is unavailable during fail-open', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 7, url: 'https://example.com/preserved' } ];
		browser.protectedPagePresentations.set( 7, {
			allowanceWarningId: null,
			interruptionLayerPresented: true,
		} );
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );

		await projector.failOpen();

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} );
	} );

	it( 'releases every interruption tab after fail-open redirect removal', async () => {
		const browser = new ProjectorBrowserFixture();
		const allowance = createAllowanceState(
			DefaultProtectionScopeId,
			NOW_EPOCH_MILLISECONDS + 60_000,
		);

		allowance.readyParticipants.push( {
			origin: ProtectionParticipantOrigin.NAVIGATION,
			participantId: ParticipantIdSchema.parse( 'participant_7' ),
			pageId: PageIdSchema.parse( 'page_tab_7_alpha' ),
			retainedDestination: 'https://example.com/retained',
			focusEligible: false,
			joinSequence: 0,
		} );
		browser.tabs = [
			{ id: 7, url: INTERRUPTION_PAGE_URL },
			{ id: 8, url: INTERRUPTION_PAGE_URL },
			{ id: 9, url: 'https://example.com/already-released' },
		];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {
			scope_default: allowance,
		} ) );

		await projector.failOpen();

		expect( browser.rules ).toEqual( [] );
		expect( browser.navigations ).toEqual( [ {
			tabId: 7,
			url: 'https://example.com/retained',
		} ] );
		expect( browser.dismissedTabIds ).toEqual( [ 8 ] );
	} );

	it( 'dismisses interruption pages when authoritative state is unavailable during fail-open', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 8, url: INTERRUPTION_PAGE_URL } ];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );

		await projector.failOpen();

		expect( browser.dismissedTabIds ).toEqual( [ 8 ] );
	} );

	it( 'falls back to dismissal when retained navigation cannot be restored', async () => {
		const browser = new ProjectorBrowserFixture();
		const allowance = createAllowanceState(
			DefaultProtectionScopeId,
			NOW_EPOCH_MILLISECONDS + 60_000,
		);

		allowance.readyParticipants.push( {
			origin: ProtectionParticipantOrigin.NAVIGATION,
			participantId: ParticipantIdSchema.parse( 'participant_17' ),
			pageId: PageIdSchema.parse( 'page_tab_17_alpha' ),
			retainedDestination: 'https://example.com/retained',
			focusEligible: false,
			joinSequence: 0,
		} );
		browser.tabs = [ { id: 17, url: INTERRUPTION_PAGE_URL } ];
		browser.rejectNavigation = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {
			scope_default: allowance,
		} ) );

		await projector.failOpen();

		expect( browser.dismissedTabIds ).toEqual( [ 17 ] );
	} );

	it( 'rejects fail-open cleanup while a live interruption page cannot be released', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.tabs = [ { id: 18, url: INTERRUPTION_PAGE_URL } ];
		browser.rejectDismissal = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.failOpen() ).rejects.toThrow( 'Dismissal failed.' );
	} );

	it( 'attempts every fail-open cleanup and rejects when redirect removal fails', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectNavigationRules = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.failOpen() ).rejects.toThrow(
			'Failed to remove protection navigation rules.',
		);

		expect( browser.synchronizeProtectionClockCallCount ).toBe( 1 );
		expect( browser.updateToolbarBadgeCallCount ).toBe( 1 );
	} );

	it( 'removes an owned injected layer without releasing navigation behind a live redirect', async () => {
		const browser = new ProjectorBrowserFixture();
		const expiryParticipant = createExpiryParticipant( 22 );
		browser.rejectNavigationRules = true;
		browser.tabs = [
			{ id: 7, url: INTERRUPTION_PAGE_URL },
			{ id: 22, url: 'https://example.com/preserved' },
		];
		browser.protectedPagePresentations.set( 22, {
			allowanceWarningId: null,
			interruptionLayerPresented: true,
		} );
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [
				createNavigationParticipant(
					'participant_7',
					'page_tab_7_alpha',
					false,
					0,
					'https://example.com/retained',
				),
				expiryParticipant,
			] ),
		) );

		await expect( projector.failOpen() ).rejects.toThrow(
			'Failed to remove protection navigation rules.',
		);

		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 22,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} );
		expect( browser.navigations ).toEqual( [] );
	} );

	it( 'releases injected layers without depending on presentation status observations', async () => {
		const browser = new ProjectorBrowserFixture();
		const expiryParticipant = createExpiryParticipant( 22 );
		browser.rejectProtectedPageObservation = true;
		browser.tabs = [
			{ id: 7, url: INTERRUPTION_PAGE_URL },
			{ id: 22, url: 'https://example.com/preserved' },
		];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture(
			createWaitingSnapshot( [ expiryParticipant ] ),
		) );

		await projector.failOpen();

		expect( browser.dismissedTabIds ).toEqual( [ 7 ] );
		expect( browser.protectedPageUpdates ).toContainEqual( {
			tabId: 22,
			message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
		} );
	} );

	it( 'refreshes the global toolbar from an explicit state snapshot', async () => {
		const browser = new ProjectorBrowserFixture();
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );
		const allowance = createAllowanceState(
			DefaultProtectionScopeId,
			NOW_EPOCH_MILLISECONDS + 120_000,
		);

		await projector.refreshToolbarBadge( CONFIGURATION, { scope_default: allowance } );

		expect( browser.badge ).toMatchObject( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			text: 'V2m',
		} );
	} );

	it( 'refreshes focused warning guards and the toolbar from one state snapshot', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.focusedTabId = 7;
		browser.tabs = [
			{ id: 7, url: 'https://example.com/first' },
			{ id: 8, url: 'https://example.com/second' },
		];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );
		const allowance = createAllowanceState(
			DefaultProtectionScopeId,
			NOW_EPOCH_MILLISECONDS + 120_000,
		);

		await projector.refreshFocusEffects( CONFIGURATION, { scope_default: allowance } );
		browser.focusedTabId = 8;
		browser.protectedPageUpdates = [];
		await projector.refreshFocusEffects( CONFIGURATION, { scope_default: allowance } );

		expect( browser.protectedPageUpdates ).toEqual( expect.arrayContaining( [
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
					allowanceId: allowance.allowanceId,
					expiresAtEpochMilliseconds: allowance.expiresAtEpochMilliseconds,
					warningStartsAtEpochMilliseconds: null,
					warningEndsAtEpochMilliseconds: null,
				},
			},
			{
				tabId: 8,
				message: {
					type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
					allowanceId: allowance.allowanceId,
					expiresAtEpochMilliseconds: allowance.expiresAtEpochMilliseconds,
					warningStartsAtEpochMilliseconds: allowance.expiresAtEpochMilliseconds - 10_000,
					warningEndsAtEpochMilliseconds: allowance.expiresAtEpochMilliseconds,
				},
			},
		] ) );
		expect( browser.badge ).toMatchObject( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			text: 'V2m',
		} );
	} );

	it( 'moves an active final warning to the newly focused protected page', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.focusedTabId = 8;
		browser.tabs = [
			{ id: 7, url: 'https://example.com/first' },
			{ id: 8, url: 'https://example.com/second' },
		];
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( null ) );
		const allowance = createAllowanceState(
			DefaultProtectionScopeId,
			NOW_EPOCH_MILLISECONDS + 5_000,
		);
		browser.protectedPagePresentations.set( 7, {
			allowanceWarningId: allowance.allowanceId,
			interruptionLayerPresented: false,
		} );

		await projector.refreshFocusEffects( CONFIGURATION, { scope_default: allowance } );

		expect( browser.protectedPageUpdates ).toEqual( expect.arrayContaining( [
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
					allowanceId: allowance.allowanceId,
				},
			},
			{
				tabId: 8,
				message: {
					type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
					allowanceId: allowance.allowanceId,
					expiresAtEpochMilliseconds: allowance.expiresAtEpochMilliseconds,
				},
			},
		] ) );
	} );

	it( 'keeps callers available when a direct toolbar refresh fails', async () => {
		const browser = new ProjectorBrowserFixture();
		browser.rejectToolbarBadge = true;
		const projector = createProjector( browser, new ProjectorCoordinatorFixture( {} ) );

		await expect( projector.refreshToolbarBadge( CONFIGURATION, {} ) ).resolves.toBeUndefined();

		expect( browser.updateToolbarBadgeCallCount ).toBe( 1 );
	} );

	it( 'uses localized copy for direct and fail-open toolbar projection', async () => {
		const browser = new ProjectorBrowserFixture();
		const projector = createProjector(
			browser,
			new ProjectorCoordinatorFixture( null ),
			{
				...EnglishToolbarBadgeCopy,
				inactive: {
					text: '',
					title: 'TOCus localizado',
				},
			},
		);

		await projector.failOpen();

		expect( browser.badge ).toEqual( {
			phase: ToolbarBadgePhase.INACTIVE,
			text: '',
			title: 'TOCus localizado',
		} );
	} );
} );
