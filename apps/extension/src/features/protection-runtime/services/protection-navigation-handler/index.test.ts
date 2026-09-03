import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorDispatchStatus,
	type PrepareProtectionEvent,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	createAllowanceExpiryParticipant,
	createWaitingState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { DepartureCause } from '../../../../domains/protection/types/protection-event';
import { ProtectionScopeIdSchema } from '../../../../domains/protection/types/protection-value';
import { createProtectionNavigationHandler } from './index';
import { type ProtectionNavigationHandler } from './types';

/** Extension-owned interruption page used by navigation tests. */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/** Default protection scope used by navigation tests. */
const DEFAULT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope-default' );

/** Independent protection scope used by cross-scope navigation tests. */
const INDEPENDENT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope-independent' );

/** Protected-site configuration used by navigation tests. */
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
		[ DEFAULT_SCOPE_ID ]: { mode: 'always' },
		[ INDEPENDENT_SCOPE_ID ]: { mode: 'always' },
	},
};

/** Mutable coordinator boundary used by focused navigation tests. */
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

/** Focused navigation-handler test harness. */
interface NavigationHandlerHarness {
	/** Coordinator fixture used by the handler. */
	coordinator: NavigationCoordinatorFixture;
	/** Participant departure boundary. */
	departTab: ReturnType<typeof vi.fn>;
	/** Navigation handler under test. */
	handler: ProtectionNavigationHandler;
	/** Browser projection reconciliation boundary. */
	reconcileBrowserState: ReturnType<typeof vi.fn>;
	/** Interruption-page release boundary. */
	releaseNavigationIfInterrupted: ReturnType<typeof vi.fn>;
}

/**
 * Creates a focused navigation handler around deterministic dependencies.
 * @param states - Current authoritative protection states.
 * @return Navigation handler, coordinator, and effect spies.
 * @since 0.1.0 Initial implementation.
 */
function createHarness( states: ProtectionCoordinatorStateSnapshot | null ): NavigationHandlerHarness {
	const coordinator = new NavigationCoordinatorFixture( states );
	const departTab = vi.fn().mockImplementation( () => {
		coordinator.states = {};
		return Promise.resolve();
	} );
	const reconcileBrowserState = vi.fn().mockResolvedValue( undefined );
	const releaseNavigationIfInterrupted = vi.fn().mockResolvedValue( undefined );
	const handler = createProtectionNavigationHandler( {
		browser: { getFocusedTabId: vi.fn().mockResolvedValue( 7 ) },
		coordinator,
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		applyDispatchResult: vi.fn().mockResolvedValue( undefined ),
		createStableId: vi.fn()
			.mockReturnValueOnce( 'participant' )
			.mockReturnValueOnce( 'page' )
			.mockReturnValueOnce( 'wait' ),
		departTab,
		evaluateScopeSchedule: vi.fn().mockReturnValue( { status: 'active' } ),
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

describe( 'createProtectionNavigationHandler', () => {
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

	it( 'starts a fresh visit when an allowance-expiry page enters another scope', async () => {
		const harness = createHarness( createExpiryWaitingSnapshot() );

		await harness.handler.handle( {
			tabId: 7,
			frameId: 0,
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
} );
