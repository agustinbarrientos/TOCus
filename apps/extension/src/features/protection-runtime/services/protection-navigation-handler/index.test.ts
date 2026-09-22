import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorDispatchStatus,
	type PrepareProtectionEvent,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createIdleState,
	createNavigationParticipant,
	createWaitingState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import type { ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { DepartureCause, ProtectionEventType } from '../../../../domains/protection/types/protection-event';
import { ProtectionFactType } from '../../../../domains/protection/types/protection-fact';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { parseStoredProtectionState } from '../../../../domains/protection/utils/parse-stored-protection-state';
import { prepareStoredProtectionState } from '../../../../domains/protection/utils/prepare-stored-protection-state';
import { ProtectionStateRestoreMode, restoreProtectionState } from '../../../../domains/protection/utils/restore-protection-state';
import { transitionProtectionState } from '../../../../domains/protection/utils/transition-protection-state';
import {
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { createProtectionNavigationHandler } from './index';
import type { ProtectionNavigationHandler } from './types';
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';

/**
 * Extension-owned interruption page used by navigation tests.
 * @since 0.1.0 Initial implementation.
 */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Default protection scope used by navigation tests.
 * @since 0.1.0 Initial implementation.
 */
const DEFAULT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope-default' );

/**
 * Independent protection scope used by cross-scope navigation tests.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope-independent' );

/**
 * Protected-site configuration used by navigation tests.
 * @since 0.1.0 Initial implementation.
 */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [
		{
			identityHost: 'example.com',
			rule: {
				host: 'example.com',
				includeSubdomains: true,
				scopeId: DEFAULT_SCOPE_ID,
			},
		},
		{
			identityHost: 'independent.test',
			rule: {
				host: 'independent.test',
				includeSubdomains: true,
				scopeId: INDEPENDENT_SCOPE_ID,
			},
		},
	],
	schedule: { mode: 'always' },
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		[ DEFAULT_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse( 'revision_grouped' ),
		[ INDEPENDENT_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse( 'revision_independent' ),
	},
};

/**
 * Mutable coordinator boundary used by focused navigation tests.
 * @since 0.1.0 Initial implementation.
 */
class NavigationCoordinatorFixture {
	/** Prepared protection events. */
	events: unknown[] = [];

	/** Current authoritative state snapshot. */
	states: ProtectionCoordinatorStateSnapshot | null;

	/**
	 * Creates a fixture with one current state snapshot.
	 * @param states - Initial authoritative protection states.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( states: ProtectionCoordinatorStateSnapshot | null ) {
		this.states = states;
	}

	/**
	 * Returns the current authoritative state snapshot.
	 * @return Current protection states.
	 * @since 0.1.0 Initial implementation.
	 */
	getStates(): Promise<ProtectionCoordinatorStateSnapshot | null> {
		return Promise.resolve( this.states );
	}

	/**
	 * Records one event prepared under the coordinator boundary.
	 * @param prepareEvent - Deferred protection-event preparation.
	 * @return Applied coordinator result without browser decisions.
	 * @since 0.1.0 Initial implementation.
	 */
	dispatch( prepareEvent: PrepareProtectionEvent ): Promise<ProtectionCoordinatorDispatchResult> {
		this.events.push( prepareEvent( this.states ?? {} ) );

		return Promise.resolve( {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
			decisions: [],
			facts: [],
		} );
	}
}

/**
 * Focused navigation-handler test harness.
 * @since 0.1.0 Initial implementation.
 */
interface NavigationHandlerHarness {
	/** Coordinator fixture used by the handler. */
	coordinator: NavigationCoordinatorFixture;
	/** Participant departure boundary. */
	departTab: ReturnType<typeof vi.fn>;
	/** Navigation handler under test. */
	handler: ProtectionNavigationHandler;
	/** Open-tab observation boundary. */
	listTabs: ReturnType<typeof vi.fn>;
	/** Configuration boundary for permission and schedule changes. */
	loadConfiguration: ReturnType<typeof vi.fn>;
	/** Current schedule evaluation boundary. */
	evaluateSiteSchedule: ReturnType<typeof vi.fn>;
	/** Fail-open rule cleanup boundary. */
	reconcileUnavailableConfiguration: ReturnType<typeof vi.fn>;
	/** Browser projection reconciliation boundary. */
	reconcileBrowserState: ReturnType<typeof vi.fn>;
	/** Interruption-page release boundary. */
	releaseNavigationIfInterrupted: ReturnType<typeof vi.fn>;
}

/**
 * Creates a focused navigation handler around deterministic dependencies.
 * @param states - Current authoritative protection states.
 * @param interruptionPageUrl - Configured interruption document URL.
 * @return Navigation handler, coordinator, and effect spies.
 * @since 0.1.0 Initial implementation.
 */
function createHarness(
	states: ProtectionCoordinatorStateSnapshot | null,
	interruptionPageUrl = INTERRUPTION_PAGE_URL,
): NavigationHandlerHarness {
	const coordinator = new NavigationCoordinatorFixture( states );
	const departTab = vi.fn().mockImplementation( () => {
		coordinator.states = {};
		return Promise.resolve();
	} );
	const listTabs = vi.fn().mockResolvedValue( [ { id: 7, incognito: false } ] );
	const loadConfiguration = vi.fn().mockResolvedValue( CONFIGURATION );
	const evaluateSiteSchedule = vi.fn().mockReturnValue( { status: ScheduleEvaluationStatus.ACTIVE } );
	const reconcileUnavailableConfiguration = vi.fn().mockResolvedValue( undefined );
	const reconcileBrowserState = vi.fn().mockResolvedValue( undefined );
	const releaseNavigationIfInterrupted = vi.fn().mockResolvedValue( undefined );
	const handler = createProtectionNavigationHandler( {
		browser: {
			getFocusedTabId: vi.fn().mockResolvedValue( 7 ),
			listTabs,
		},
		coordinator,
		interruptionPageUrl,
		applyDispatchResult: vi.fn().mockResolvedValue( undefined ),
		createStableId: vi.fn()
			.mockReturnValueOnce( 'participant' )
			.mockReturnValueOnce( 'page' )
			.mockReturnValueOnce( 'wait' ),
		departTab,
		evaluateSiteSchedule,
		getTimeZone: vi.fn().mockReturnValue( 'America/New_York' ),
		loadConfiguration,
		now: vi.fn().mockReturnValue( Date.UTC( 2026, 8, 2, 12 ) ),
		reconcileBrowserState,
		reconcileExpiredAllowances: vi.fn().mockResolvedValue( undefined ),
		reconcileSchedules: vi.fn().mockResolvedValue( undefined ),
		reconcileUnavailableConfiguration,
		releaseNavigationIfInterrupted,
	} );

	return {
		coordinator,
		departTab,
		handler,
		listTabs,
		loadConfiguration,
		evaluateSiteSchedule,
		reconcileUnavailableConfiguration,
		reconcileBrowserState,
		releaseNavigationIfInterrupted,
	};
}

/**
 * Creates one Waiting state owned by an allowance-expiry participant.
 * @return Current Waiting state for the default scope.
 * @since 0.1.0 Initial implementation.
 */
function createExpiryWaitingSnapshot(): ProtectionCoordinatorStateSnapshot {
	const waiting = createWaitingState();
	waiting.participants = [ createAllowanceExpiryParticipant(
		'participant-expiry',
		'page_tab_7_expiry',
		true,
		0,
	) ];

	return { [ DEFAULT_SCOPE_ID ]: waiting };
}

/**
 * Creates one Waiting state retaining a navigation participant for tab 7.
 * @return Current Waiting state for the default scope.
 * @since 0.1.0 Initial implementation.
 */
function createNavigationWaitingSnapshot(): ProtectionCoordinatorStateSnapshot {
	const waiting = createWaitingState();
	const participant = createNavigationParticipant(
		'participant-private',
		'page_tab_7_private',
		true,
		0,
		'https://example.com/private',
	);
	waiting.participants = [ participant ];
	waiting.ownerParticipantId = participant.participantId;

	return { [ DEFAULT_SCOPE_ID ]: waiting };
}

describe( 'createProtectionNavigationHandler', () => {
	describe( 'destination-bearing redirects', () => {
		const currentUrl = 'chrome-extension://extension-id/pause.html';
		const destination = 'https://example.com/private';
		const redirectUrl = `${ currentUrl }#destination=${ destination }`;
		const navigation = {
			frameId: 0, phase: ProtectionRuntimeNavigationPhase.COMMITTED, tabId: 7, url: redirectUrl,
		};
		const currentTab = { id: 7, incognito: false, url: redirectUrl };

		it.each( [
			{ frameId: 1 }, { tabId: -1 },
			{ phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE },
			{ phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED },
			{ phase: ProtectionRuntimeNavigationPhase.REFERENCE_FRAGMENT_UPDATED },
		] )( 'does not claim an uncommitted or non-top-level redirect %j', async ( changes ) => {
			const harness = createHarness( {}, currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			await expect( harness.handler.handle( { ...navigation, ...changes } ) ).resolves.toBeUndefined();
			expect( harness.coordinator.events ).toEqual( [] );
		} );

		it.each( [
			{ tabs: [] }, { tabs: [ { ...currentTab, id: 8 } ] }, { tabs: [ { ...currentTab, incognito: true } ] },
			{ tabs: [ { id: 7 } ] }, { tabs: [ { ...currentTab, pendingUrl: 'https://unprotected.test/' } ] },
		] )( 'ignores a redirect that no longer owns its ordinary tab %j', async ( { tabs } ) => {
			const harness = createHarness( {}, currentUrl );
			harness.listTabs.mockResolvedValue( tabs );
			await expect( harness.handler.handle( navigation ) ).resolves.toBeUndefined();
			expect( harness.coordinator.events ).toEqual( [] );
		} );

		it( 'keeps an already persisted participant when canonicalizing its redirect', async () => {
			const harness = createHarness( createNavigationWaitingSnapshot(), currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			await expect( harness.handler.handle( navigation ) ).resolves.toBe( currentUrl );
			expect( harness.coordinator.events ).toEqual( [] );
		} );

		it.each( [ false, true ] )( 'honors the current allowance (expired: %s)', async ( expired ) => {
			const allowance = createAllowanceState();
			allowance.readyParticipants = [];
			allowance.expiresAtEpochMilliseconds = expired ? 0 : Date.UTC( 2026, 8, 2, 13 );
			const harness = createHarness( { [ DEFAULT_SCOPE_ID ]: allowance }, currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			const replacement = await harness.handler.handle( navigation );
			if ( expired ) {
				expect( harness.coordinator.events ).toHaveLength( 1 );
				expect( replacement ).toBeUndefined();
			} else {
				expect( harness.coordinator.events ).toEqual( [] );
				expect( harness.reconcileBrowserState ).toHaveBeenCalledOnce();
				expect( replacement ).toBe( destination );
			}
		} );

		it( 'does not replace a newer navigation after asynchronous reconciliation', async () => {
			const harness = createHarness( createNavigationWaitingSnapshot(), currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			harness.reconcileBrowserState.mockImplementation( () => {
				harness.listTabs.mockResolvedValue( [ { ...currentTab, pendingUrl: 'https://unprotected.test/' } ] );
			} );
			await expect( harness.handler.handle( navigation ) ).resolves.toBeUndefined();
		} );

		it.each( [ null, {} ] )( 'does not expose a pause without a persisted participant %j', async ( states ) => {
			const harness = createHarness( states, currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			await expect( harness.handler.handle( navigation ) ).resolves.toBeUndefined();
			expect( harness.coordinator.events ).toHaveLength( 1 );
		} );

		it( 'removes redirects before releasing a destination when configuration is unavailable', async () => {
			const harness = createHarness( {}, currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			harness.loadConfiguration.mockResolvedValue( null );
			await expect( harness.handler.handle( navigation ) ).resolves.toBe( destination );
			expect( harness.reconcileUnavailableConfiguration ).toHaveBeenCalledOnce();
		} );

		it.each( [ 'removed', 'inactive' ] )( 'releases a %s site only after refreshing redirect rules', async ( reason ) => {
			const harness = createHarness( {}, currentUrl );
			harness.listTabs.mockResolvedValue( [ currentTab ] );
			if ( reason === 'removed' ) {
				harness.loadConfiguration.mockResolvedValue( { ...CONFIGURATION, sites: [] } );
			} else {
				harness.evaluateSiteSchedule.mockReturnValue( { status: ScheduleEvaluationStatus.INACTIVE } );
			}
			await expect( harness.handler.handle( navigation ) ).resolves.toBe( destination );
			expect( harness.coordinator.events ).toEqual( [] );
			expect( harness.reconcileBrowserState ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'claims the final protected URL carried by a committed network redirect', async () => {
		const currentUrl = 'chrome-extension://extension-id/pause.html';
		const destination = 'https://example.com/watch?v=a%26b&next=%2Ffeed';
		const redirectUrl = `${ currentUrl }#destination=${ destination }`;
		const harness = createHarness( {}, currentUrl );
		harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: redirectUrl } ] );
		vi.spyOn( harness.coordinator, 'dispatch' ).mockImplementation( ( prepareEvent ) => {
			const event = prepareEvent( harness.coordinator.states ?? {} );
			harness.coordinator.events.push( event );
			const result = transitionProtectionState( createIdleState(), event );
			harness.coordinator.states = { [ DEFAULT_SCOPE_ID ]: result.state };
			return Promise.resolve( {
				status: ProtectionCoordinatorDispatchStatus.APPLIED, decisions: result.decisions, facts: result.facts,
			} );
		} );

		const replacement = await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [ 'server_redirect' ],
			transitionType: 'link',
			url: redirectUrl,
		} );

		expect( harness.coordinator.events ).toMatchObject( [ {
			type: ProtectionEventType.VISIT_ATTEMPT,
			participant: { retainedDestination: destination },
		} ] );
		expect( replacement ).toBe( currentUrl );
	} );
	it.each( [
		{
			label: 'a server redirect',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [ 'server_redirect' ],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.REDIRECT,
		},
		{
			label: 'a client redirect with an additional browser qualifier',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [ 'client_redirect', 'future_qualifier' ],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.REDIRECT,
		},
		{
			label: 'an authentication form handoff',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'form_submit',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.AUTHENTICATION_HANDOFF,
		},
		{
			label: 'a History API update',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.HISTORY_STATE_UPDATED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.PROGRAMMATIC_NAVIGATION,
		},
		{
			label: 'a fragment-only update',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.REFERENCE_FRAGMENT_UPDATED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'link',
				url: 'https://unprotected.test/#next',
			},
			expectedCause: DepartureCause.PROGRAMMATIC_NAVIGATION,
		},
		{
			label: 'a browser navigation error',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
				tabId: 7,
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.BROWSER_ERROR_OR_RECOVERY,
		},
		{
			label: 'a commit without redirect qualifiers',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.UNKNOWN,
		},
		{
			label: 'a commit with an unknown qualifier',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [ 'future_qualifier' ],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.UNKNOWN,
		},
		{
			label: 'a commit with an unknown transition type',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'future_transition',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.UNKNOWN,
		},
		{
			label: 'a commit without a transition type',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [],
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.UNKNOWN,
		},
		{
			label: 'a commit without a distinguishable phase',
			outcome: {
				frameId: 0,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.UNKNOWN,
		},
		{
			label: 'a browser Back or Forward navigation',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [ 'forward_back' ],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.BACK,
		},
		{
			label: 'a browser-managed reload outcome',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'reload',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.PROGRAMMATIC_NAVIGATION,
		},
		{
			label: 'a generated address-bar navigation',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [ 'from_address_bar' ],
				transitionType: 'generated',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
		},
		{
			label: 'a committed user link',
			outcome: {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'link',
				url: 'https://unprotected.test/',
			},
			expectedCause: DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
		},
	] )( 'waits for $label outcome before classifying departure', async ( {
		outcome,
		expectedCause,
	} ) => {
		const harness = createHarness( createNavigationWaitingSnapshot() );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: outcome.url,
		} );

		expect( harness.departTab ).not.toHaveBeenCalled();

		await harness.handler.handle( outcome );

		expect( harness.departTab ).toHaveBeenCalledOnce();
		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			expectedCause,
			CONFIGURATION,
		);
	} );

	it( 'ignores an unprotected pre-navigation when no participant exists', async () => {
		const harness = createHarness( {} );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://unprotected.test/',
		} );

		expect( harness.departTab ).not.toHaveBeenCalled();
		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.reconcileBrowserState ).toHaveBeenCalledWith( CONFIGURATION );
	} );

	it.each( [ {}, createNavigationWaitingSnapshot() ] )(
		'ignores a stale blank commit while a newer protected destination displays its interruption',
		async ( states ) => {
			const harness = createHarness( states );
			harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ] );

			await harness.handler.handle( {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [],
				transitionType: 'typed',
				url: 'about:blank',
			} );

			expect( harness.departTab ).not.toHaveBeenCalled();
			expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
			expect( harness.coordinator.events ).toEqual( [] );
		},
	);

	it( 'does not restore a committed allowed page after a newer pause opens during reconciliation', async () => {
		const harness = createHarness( {} );
		// Host access hides the allowed page when its commit starts being handled.
		harness.reconcileBrowserState.mockImplementationOnce( () => {
			// The browser can commit its redirect while the old navigation handler awaits I/O.
			harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ] );
		} );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [],
			transitionType: 'typed',
			url: 'https://unprotected.test/loading',
		} );

		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
		expect( harness.departTab ).not.toHaveBeenCalled();
	} );

	it( 'releases an allowed destination retained by the observed interruption outcome', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://unprotected.test/',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [ 'server_redirect' ],
			transitionType: 'typed',
			url: INTERRUPTION_PAGE_URL,
		} );

		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledExactlyOnceWith( 7, 'https://unprotected.test/' );
		expect( harness.departTab ).toHaveBeenCalledExactlyOnceWith( 7, DepartureCause.REDIRECT, CONFIGURATION );
	} );

	it( 'preserves a pending protected destination when a stale blank commit arrives first', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://independent.test/',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			url: 'about:blank',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [ 'server_redirect' ],
			transitionType: 'typed',
			url: INTERRUPTION_PAGE_URL,
		} );

		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
		expect( harness.departTab ).toHaveBeenCalledExactlyOnceWith( 7, DepartureCause.REDIRECT, CONFIGURATION );
		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'visit-attempt',
			scopeId: INDEPENDENT_SCOPE_ID,
			participant: { retainedDestination: 'https://independent.test/' },
		} ] );
	} );

	it( 'retains a newer protected participant when the previous unprotected page reports an error', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValue( [ {
			id: 7,
			incognito: false,
			url: 'https://unprotected.test/',
			pendingUrl: INTERRUPTION_PAGE_URL,
		} ] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
			tabId: 7,
			url: 'https://unprotected.test/',
		} );

		expect( harness.departTab ).not.toHaveBeenCalled();
		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
		expect( harness.coordinator.states ).toMatchObject( {
			[ DEFAULT_SCOPE_ID ]: {
				type: ProtectionStateType.WAITING,
				participants: [ { retainedDestination: 'https://example.com/private' } ],
			},
		} );
	} );

	it( 'preserves a pending protected destination when the previous unprotected page reports an error', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://independent.test/',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
			tabId: 7,
			url: 'https://unprotected.test/',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [ 'server_redirect' ],
			transitionType: 'typed',
			url: INTERRUPTION_PAGE_URL,
		} );

		expect( harness.coordinator.events ).toMatchObject( [ {
			type: ProtectionEventType.VISIT_ATTEMPT,
			scopeId: INDEPENDENT_SCOPE_ID,
			participant: { retainedDestination: 'https://independent.test/' },
		} ] );
		expect( harness.departTab ).toHaveBeenCalledExactlyOnceWith( 7, DepartureCause.REDIRECT, CONFIGURATION );
		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
	} );

	it.each( [
		{ url: 'about:blank' },
		{ url: INTERRUPTION_PAGE_URL, pendingUrl: 'about:blank' },
		{},
	] )( 'classifies an actual blank departure with its observed tab metadata %j', async ( fields ) => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, ...fields } ] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [],
			transitionType: 'typed',
			url: 'about:blank',
		} );

		expect( harness.departTab ).toHaveBeenCalledExactlyOnceWith(
			7,
			DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
			CONFIGURATION,
		);
		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
	} );

	it.each( [ {}, null ] )( 'reconciles a browser error when no participant exists in %j', async ( states ) => {
		const harness = createHarness( states );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
			tabId: 7,
			url: 'https://unprotected.test/',
		} );

		expect( harness.departTab ).not.toHaveBeenCalled();
		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.reconcileBrowserState ).toHaveBeenCalledWith( CONFIGURATION );
	} );

	it( 'cleans up an owned navigation error after its pending URL disappears', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: 'https://unprotected.test/' } ] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
			tabId: 7,
			url: 'https://example.com/private',
		} );

		expect( harness.departTab ).toHaveBeenCalledExactlyOnceWith(
			7,
			DepartureCause.BROWSER_ERROR_OR_RECOVERY,
			CONFIGURATION,
		);
		expect( harness.coordinator.states ).toEqual( {} );
		expect( harness.reconcileBrowserState ).toHaveBeenCalledWith( CONFIGURATION );
		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
	} );

	it( 'retains committed departure evidence when the live tab disappears during observation', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );
		harness.listTabs.mockResolvedValueOnce( [ { id: 7, incognito: false } ] ).mockResolvedValueOnce( [] );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			transitionQualifiers: [],
			transitionType: 'link',
			url: 'https://unprotected.test/',
		} );

		expect( harness.departTab ).toHaveBeenCalledExactlyOnceWith(
			7,
			DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
			CONFIGURATION,
		);
	} );

	it( 'persists a protected visit only for an explicitly ordinary tab', async () => {
		const harness = createHarness( {} );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/feed',
		} );

		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'visit-attempt',
			participant: { statisticsEligible: true },
		} ] );
	} );

	it( 'counts the configured visit time for a reconsidered navigation after restoration', async () => {
		const harness = createHarness( {} );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://news.example.com/private/feed?query=personal#latest',
		} );

		const waiting = transitionProtectionState( createIdleState(), harness.coordinator.events[ 0 ] );
		const stored = prepareStoredProtectionState( {
			statesByScope: { [ DEFAULT_SCOPE_ID ]: waiting.state },
			sessionContinuityId: 'session-a',
			statisticsDelivery: {
				status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
				outbox: [],
			},
		} );
		const restored = restoreProtectionState( {
			mode: ProtectionStateRestoreMode.CONTINUED_SESSION,
			parsedState: parseStoredProtectionState( JSON.parse( JSON.stringify( stored ) ) ),
			nowEpochMilliseconds: Date.UTC( 2026, 8, 2, 12, 1 ),
			sessionContinuityId: 'session-a',
			readyObservations: [],
		} );
		const state = restored.statesByScope[ DEFAULT_SCOPE_ID ];

		if ( state?.type !== ProtectionStateType.WAITING || state.participants[ 0 ] === undefined ) {
			throw new Error( 'Expected a restored navigation participant.' );
		}

		const departed = transitionProtectionState( state, {
			type: ProtectionEventType.PARTICIPANT_DEPARTURE,
			scopeId: DEFAULT_SCOPE_ID,
			target: { stateType: ProtectionStateType.WAITING, waitId: state.waitId },
			participantId: state.participants[ 0 ].participantId,
			pageId: state.participants[ 0 ].pageId,
			cause: DepartureCause.BACK,
			allowanceDurationMilliseconds: 300_000,
			observedAtEpochMilliseconds: Date.UTC( 2026, 8, 2, 12, 2 ),
			observedLocalDate: '2026-09-02',
		} );

		expect( departed.facts ).toMatchObject( [ {
			type: ProtectionFactType.RECONSIDERED_VISIT,
			allowanceDurationMilliseconds: 300_000,
		} ] );
	} );

	it.each( [
		[ 'a private navigation', [ { id: 7, incognito: true } ] ],
		[ 'a navigation with unknown privacy', [ { id: 7 } ] ],
		[ 'a navigation with missing tab metadata', [ { id: 8, incognito: false } ] ],
	] )( 'fails open without persisting %s', async ( _label, tabs ) => {
		const harness = createHarness( {} );

		harness.listTabs.mockResolvedValue( tabs );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );

		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.reconcileBrowserState ).not.toHaveBeenCalled();
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith(
			7,
			'https://example.com/private',
		);
	} );

	it( 'fails open without persisting a navigation when tab privacy observation fails', async () => {
		const harness = createHarness( {} );

		harness.listTabs.mockRejectedValue( new Error( 'Tab observation unavailable.' ) );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );

		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.reconcileBrowserState ).not.toHaveBeenCalled();
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith(
			7,
			'https://example.com/private',
		);
	} );

	it.each( [
		[ 'private', true ],
		[ 'privacy-unknown', undefined ],
	] )( 'removes an existing participant when its tab becomes %s', async (
		_label,
		incognito,
	) => {
		const harness = createHarness( createNavigationWaitingSnapshot() );

		harness.listTabs.mockResolvedValue( [ {
			id: 7,
			...( incognito === undefined ? {} : { incognito } ),
		} ] );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );

		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			DepartureCause.BROWSER_ERROR_OR_RECOVERY,
			null,
		);
		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith(
			7,
			'https://example.com/private',
		);
	} );

	it( 'protects a later ordinary navigation after a private observation for the same tab', async () => {
		const harness = createHarness( {} );

		harness.listTabs
			.mockResolvedValueOnce( [ { id: 7, incognito: true } ] )
			.mockResolvedValueOnce( [ { id: 7, incognito: false } ] );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/private',
		} );
		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/ordinary',
		} );

		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'visit-attempt',
			participant: {
				retainedDestination: 'https://example.com/ordinary',
				statisticsEligible: true,
			},
		} ] );
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledOnce();
	} );

	it( 'retains an allowance-expiry wait across a same-scope history navigation', async () => {
		const harness = createHarness( createExpiryWaitingSnapshot() );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			url: 'https://example.com/feed#latest',
		} );

		expect( harness.departTab ).not.toHaveBeenCalled();
		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.reconcileBrowserState ).toHaveBeenCalledWith( CONFIGURATION );
	} );

	it( 'departs an allowance-expiry wait when the page leaves protection', async () => {
		const harness = createHarness( createExpiryWaitingSnapshot() );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			transitionQualifiers: [],
			transitionType: 'link',
			url: 'https://unprotected.test/',
		} );

		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
			CONFIGURATION,
		);
		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
	} );

	it( 'retains a participant until a cross-scope navigation commits with user provenance', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			url: 'https://independent.test/',
		} );

		expect( harness.departTab ).not.toHaveBeenCalled();
		expect( harness.coordinator.events ).toEqual( [] );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			transitionQualifiers: [],
			transitionType: 'link',
			url: 'https://independent.test/',
		} );

		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
			CONFIGURATION,
		);
		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'visit-attempt',
			scopeId: INDEPENDENT_SCOPE_ID,
		} ] );
	} );

	it( 'keeps cross-scope protection while a metadata-poor browser fails closed', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://independent.test/',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.COMMITTED,
			tabId: 7,
			url: 'https://independent.test/',
		} );

		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			DepartureCause.UNKNOWN,
			CONFIGURATION,
		);
		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'visit-attempt',
			scopeId: INDEPENDENT_SCOPE_ID,
		} ] );
	} );

	it( 'does not replace a participant when a cross-scope navigation fails', async () => {
		const harness = createHarness( createNavigationWaitingSnapshot() );

		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
			tabId: 7,
			url: 'https://independent.test/',
		} );
		await harness.handler.handle( {
			frameId: 0,
			phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED,
			tabId: 7,
			url: 'https://independent.test/',
		} );

		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			DepartureCause.BROWSER_ERROR_OR_RECOVERY,
			CONFIGURATION,
		);
		expect( harness.coordinator.events ).toEqual( [] );
	} );

	it.each( [ INTERRUPTION_PAGE_URL, 'chrome-extension://extension-id/pause.html' ] )(
		'replaces a pending protected destination after an interruption redirect with %s configured', async ( interruptionPageUrl ) => {
			const harness = createHarness( createNavigationWaitingSnapshot(), interruptionPageUrl );

			await harness.handler.handle( {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE,
				tabId: 7,
				url: 'https://independent.test/',
			} );
			await harness.handler.handle( {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				transitionQualifiers: [ 'server_redirect' ],
				transitionType: 'typed',
				url: INTERRUPTION_PAGE_URL,
			} );

			expect( harness.departTab ).toHaveBeenCalledWith(
				7,
				DepartureCause.REDIRECT,
				CONFIGURATION,
			);
			expect( harness.coordinator.events ).toMatchObject( [ {
				type: 'visit-attempt',
				scopeId: INDEPENDENT_SCOPE_ID,
				participant: { retainedDestination: 'https://independent.test/' },
			} ] );
		},
	);

	it.each( [ INTERRUPTION_PAGE_URL, 'chrome-extension://extension-id/pause.html' ] )(
		'ignores an independent interruption page commit to %s', async ( url ) => {
			const harness = createHarness( createNavigationWaitingSnapshot(), 'chrome-extension://extension-id/pause.html' );

			await harness.handler.handle( {
				frameId: 0,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED,
				tabId: 7,
				url,
			} );

			expect( harness.departTab ).not.toHaveBeenCalled();
			expect( harness.coordinator.events ).toEqual( [] );
			expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
		},
	);
} );
