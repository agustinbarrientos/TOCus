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
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ DEFAULT_SCOPE_ID ]: { mode: 'always' },
		[ INDEPENDENT_SCOPE_ID ]: { mode: 'always' },
	},
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
		evaluateScopeSchedule: vi.fn().mockReturnValue( { status: ScheduleEvaluationStatus.ACTIVE } ),
		getTimeZone: vi.fn().mockReturnValue( 'America/New_York' ),
		loadConfiguration: vi.fn().mockResolvedValue( CONFIGURATION ),
		now: vi.fn().mockReturnValue( Date.UTC( 2026, 8, 2, 12 ) ),
		reconcileBrowserState,
		reconcileExpiredAllowances: vi.fn().mockResolvedValue( undefined ),
		reconcileSchedules: vi.fn().mockResolvedValue( undefined ),
		reconcileUnavailableConfiguration: vi.fn().mockResolvedValue( undefined ),
		releaseNavigationIfInterrupted,
	} );

	return {
		coordinator,
		departTab,
		handler,
		listTabs,
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
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith( 7, 'about:blank' );
	} );

	it( 'reconciles a browser error when no participant exists', async () => {
		const harness = createHarness( {} );

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

	it( 'attributes a reconsidered navigation after restoration to the matched rule host', async () => {
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
			observedAtEpochMilliseconds: Date.UTC( 2026, 8, 2, 12, 2 ),
		} );

		expect( departed.facts ).toMatchObject( [ {
			type: ProtectionFactType.RECONSIDERED_VISIT,
			siteHost: 'example.com',
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
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith(
			7,
			'https://unprotected.test/',
		);
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
