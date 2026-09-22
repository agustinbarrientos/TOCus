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
import { DepartureCause } from '../../../../domains/protection/types/protection-event';
import {
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import type { ProtectionRuntimeTab } from '../../types/browser-runtime';
import { createProtectionParticipantReconciler } from './index';
import type { ProtectionParticipantReconciler } from './types';

/**
 * Extension-owned interruption page used by participant reconciliation tests.
 * @since 0.1.0 Initial implementation.
 */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Protection scope used by the shared domain fixtures.
 * @since 0.1.0 Initial implementation.
 */
const TEST_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope-default' );

/**
 * Protected-site configuration used by participant reconciliation tests.
 * @since 0.1.0 Initial implementation.
 */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: TEST_SCOPE_ID,
		},
	} ],
	schedule: { mode: 'always' },
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		[ TEST_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse( 'revision_test_scope' ),
	},
};

/**
 * Coordinator fixture that exposes prepared departure events without duplicating transitions.
 * @since 0.1.0 Initial implementation.
 */
class ParticipantCoordinatorFixture {
	/** Protection events prepared by the reconciler. */
	events: unknown[] = [];

	/** Measurement revisions supplied with prepared departure events. */
	measurementRevisions: unknown[] = [];

	/**
	 * Creates a coordinator fixture around one current state snapshot.
	 * @param states - Current authoritative protection states.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly states: ProtectionCoordinatorStateSnapshot ) {}

	/**
	 * Returns the current authoritative state snapshot.
	 * @return Current protection states.
	 * @since 0.1.0 Initial implementation.
	 */
	getStates(): Promise<ProtectionCoordinatorStateSnapshot> {
		return Promise.resolve( this.states );
	}

	/**
	 * Records one event prepared under the coordinator boundary.
	 * @param prepareEvent - Deferred protection-event preparation.
	 * @param measurementRevision - Optional statistics measurement revision.
	 * @return Applied coordinator result without browser decisions.
	 * @since 0.1.0 Initial implementation.
	 */
	dispatch(
		prepareEvent: PrepareProtectionEvent,
		measurementRevision?: unknown,
	): Promise<ProtectionCoordinatorDispatchResult> {
		this.events.push( prepareEvent( this.states ) );
		this.measurementRevisions.push( measurementRevision );

		return Promise.resolve( {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
			decisions: [],
			facts: [],
		} );
	}
}

/**
 * Complete participant-reconciler test harness.
 * @since 0.1.0 Initial implementation.
 */
interface ParticipantReconcilerHarness {
	/** Coordinator fixture receiving prepared departure events. */
	coordinator: ParticipantCoordinatorFixture;
	/** Participant reconciler under test. */
	reconciler: ProtectionParticipantReconciler;
	/** Recorded injected-layer release callback. */
	releaseInjectedInterruption: ReturnType<typeof vi.fn>;
	/** Recorded interruption-page release callback. */
	releaseNavigationIfInterrupted: ReturnType<typeof vi.fn>;
}

/**
 * Creates one participant reconciler with deterministic browser and projection boundaries.
 * @param states - Current authoritative protection states.
 * @param tabs - Current browser-tab observations.
 * @param interruptionPageUrl - Configured interruption document URL.
 * @param timeZone - OS timezone used by captured departure events.
 * @return Reconciler, coordinator fixture, and release spy.
 * @since 0.1.0 Initial implementation.
 */
function createHarness(
	states: ProtectionCoordinatorStateSnapshot,
	tabs: ReadonlyArray<ProtectionRuntimeTab>,
	interruptionPageUrl = INTERRUPTION_PAGE_URL,
	timeZone = 'UTC',
): ParticipantReconcilerHarness {
	const coordinator = new ParticipantCoordinatorFixture( states );
	const releaseInjectedInterruption = vi.fn().mockResolvedValue( undefined );
	const releaseNavigationIfInterrupted = vi.fn().mockResolvedValue( undefined );

	/**
	 * Returns the current test browser tabs.
	 * @return Current browser-tab observations.
	 * @since 0.1.0 Initial implementation.
	 */
	function listTabs(): Promise<ReadonlyArray<ProtectionRuntimeTab>> {
		return Promise.resolve( tabs );
	}

	/**
	 * Accepts one applied coordinator result in the focused service fixture.
	 * @return Resolved browser projection operation.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyDispatchResult(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Returns the deterministic test clock instant.
	 * @return Current test epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	function now(): number {
		return 1_800_000_000_000;
	}

	return {
		coordinator,
		releaseInjectedInterruption,
		releaseNavigationIfInterrupted,
		reconciler: createProtectionParticipantReconciler( {
			browser: { listTabs },
			coordinator,
			interruptionPageUrl,
			applyDispatchResult,
			releaseInjectedInterruption,
			releaseNavigationIfInterrupted,
			now,
			/**
			 * Returns the deterministic calendar for captured departures.
			 * @return IANA timezone identifier.
			 * @since 0.1.0 Initial implementation.
			 */
			getTimeZone: () => timeZone,
		} ),
	};
}

describe( 'createProtectionParticipantReconciler', () => {
	it.each( [ [ 'Pacific/Honolulu', '2027-01-14' ], [ 'Europe/Berlin', '2027-01-15' ] ] )(
		'captures a departure in the %s local calendar', async ( timeZone, date ) => {
			const waiting = createWaitingState();
			waiting.participants = [ createNavigationParticipant(
				'participant-a', 'page_tab_7_alpha', true, 0, 'https://example.com/',
			) ];
			const harness = createHarness( { 'scope-default': waiting }, [], INTERRUPTION_PAGE_URL, timeZone );
			await harness.reconciler.departTab( 7, DepartureCause.ACTIVE_SESSION_TAB_CLOSE, CONFIGURATION );

			expect( harness.coordinator.events ).toEqual( [ expect.objectContaining( {
				observedAtEpochMilliseconds: 1_800_000_000_000,
				observedLocalDate: date,
			} ) ] );
		},
	);

	it.each( [ 120_000, 300_000, 1_200_000 ] )( 'uses the current %i ms configured visit time on departure', async ( allowanceMilliseconds ) => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a', 'page_tab_7_alpha', true, 0, 'https://example.com/',
		) ];
		const harness = createHarness( { 'scope-default': waiting }, [] );
		await harness.reconciler.departTab( 7, DepartureCause.ACTIVE_SESSION_TAB_CLOSE, {
			...CONFIGURATION,
			timingConfiguration: { ...CONFIGURATION.timingConfiguration, allowanceMilliseconds },
		} );

		expect( harness.coordinator.events ).toEqual( [ expect.objectContaining( {
			allowanceDurationMilliseconds: allowanceMilliseconds,
		} ) ] );
	} );

	it( 'removes and releases a participant whose retained site leaves its scope', async () => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
			'https://removed.test/',
		) ];
		const harness = createHarness(
			{ 'scope-default': waiting },
			[ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'participant-departure',
			cause: DepartureCause.CONFIGURATION_CHANGE,
			participantId: 'participant-a',
		} ] );
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith(
			7,
			'https://removed.test/',
		);
		expect( harness.releaseInjectedInterruption ).not.toHaveBeenCalled();
	} );

	it.each( [ INTERRUPTION_PAGE_URL, 'chrome-extension://extension-id/pause.html' ] )(
		'retains a navigation participant on a live interruption page with %s configured', async ( interruptionPageUrl ) => {
			const waiting = createWaitingState();
			waiting.participants = [ createNavigationParticipant(
				'participant-a',
				'page_tab_7_alpha',
				true,
				0,
				'https://example.com/',
			) ];
			const harness = createHarness(
				{ 'scope-default': waiting },
				[ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ],
				interruptionPageUrl,
			);

			await harness.reconciler.reconcile( CONFIGURATION );

			expect( harness.coordinator.events ).toEqual( [] );
			expect( harness.releaseInjectedInterruption ).not.toHaveBeenCalled();
			expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
		},
	);

	it.each( [ true, false ] )( 'retains only the redirect belonging to the persisted destination (matching: %s)', async ( matches ) => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a', 'page_tab_7_current', true, 0, 'https://example.com/private',
		) ];
		const destination = matches ? 'https://example.com/private' : 'https://example.com/different';
		const harness = createHarness( { [ TEST_SCOPE_ID ]: waiting }, [ {
			id: 7, incognito: false, url: `${ INTERRUPTION_PAGE_URL }#destination=${ destination }`,
		} ] );

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toHaveLength( matches ? 0 : 1 );
	} );

	it( 'releases a navigation participant that has already left the interruption page', async () => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
			'https://example.com/',
		) ];
		const harness = createHarness(
			{ 'scope-default': waiting },
			[ { id: 7, incognito: false, url: 'https://example.com/' } ],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toMatchObject( [ {
			participantId: 'participant-a',
			cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY,
		} ] );
		expect( harness.releaseNavigationIfInterrupted ).toHaveBeenCalledWith(
			7,
			'https://example.com/',
		);
	} );

	it( 'retains an allowance-expiry participant on a live protected page in its scope', async () => {
		const allowance = createAllowanceState();
		allowance.readyParticipants = [ createAllowanceExpiryParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
		) ];
		const harness = createHarness(
			{ 'scope-default': allowance, idle: createIdleState() },
			[ { id: 7, incognito: false, pendingUrl: 'https://example.com/feed' } ],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toEqual( [] );
	} );

	it.each( [ INTERRUPTION_PAGE_URL, 'chrome-extension://extension-id/pause.html' ] )(
		'retains an allowance-expiry participant on a live interruption page with %s configured', async ( interruptionPageUrl ) => {
			const waiting = createWaitingState();
			waiting.participants = [ createAllowanceExpiryParticipant(
				'participant-a',
				'page_tab_7_alpha',
				true,
				0,
			) ];
			const harness = createHarness(
				{ 'scope-default': waiting },
				[ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ],
				interruptionPageUrl,
			);

			await harness.reconciler.reconcile( CONFIGURATION );

			expect( harness.coordinator.events ).toEqual( [] );
		},
	);

	it( 'classifies missing and moved participant tabs as browser recovery', async () => {
		const waiting = createWaitingState();
		waiting.participants = [
			createNavigationParticipant(
				'participant-a',
				'page_tab_7_alpha',
				true,
				0,
				'https://example.com/',
			),
			createAllowanceExpiryParticipant(
				'participant-b',
				'page_tab_8_alpha',
				false,
				1,
			),
		];
		const harness = createHarness(
			{ 'scope-default': waiting },
			[ { id: 8, incognito: false, url: 'https://unprotected.test/' } ],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toMatchObject( [
			{ participantId: 'participant-a', cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY },
			{ participantId: 'participant-b', cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY },
		] );
	} );

	it( 'classifies a removed allowance-expiry scope as a configuration change', async () => {
		const waiting = createWaitingState();
		waiting.participants = [ createAllowanceExpiryParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
		) ];
		const harness = createHarness(
			{ 'scope-default': waiting },
			[ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ],
		);

		await harness.reconciler.reconcile( TestEmptyProtectionConfiguration );

		expect( harness.coordinator.events ).toMatchObject( [ {
			cause: DepartureCause.CONFIGURATION_CHANGE,
		} ] );
		expect( harness.releaseInjectedInterruption ).toHaveBeenCalledWith(
			waiting.participants[ 0 ],
		);
	} );

	it.each( [
		[ 'private tab', true ],
		[ 'tab with unknown privacy', undefined ],
	] )( 'removes an allowance-expiry participant owned by a %s', async (
		_label,
		incognito,
	) => {
		const waiting = createWaitingState();
		waiting.participants = [ createAllowanceExpiryParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
		) ];
		const harness = createHarness(
			{ 'scope-default': waiting },
			[ {
				id: 7,
				url: 'https://example.com/private',
				...( incognito === undefined ? {} : { incognito } ),
			} ],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toMatchObject( [ {
			participantId: 'participant-a',
			cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY,
		} ] );
		expect( harness.releaseInjectedInterruption ).toHaveBeenCalledWith(
			waiting.participants[ 0 ],
		);
	} );

	it( 'ignores participants not owned by a runtime browser tab', async () => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a',
			'page_external',
			true,
			0,
			'https://example.com/',
		) ];
		const harness = createHarness( { 'scope-default': waiting }, [] );

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toEqual( [] );
	} );

	it( 'removes one matching tab participant and ignores an unknown tab', async () => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
			'https://example.com/',
		) ];
		const harness = createHarness( { 'scope-default': waiting }, [] );

		await harness.reconciler.departTab( 99, DepartureCause.ACTIVE_SESSION_TAB_CLOSE, CONFIGURATION );
		await harness.reconciler.departTab( 7, DepartureCause.ACTIVE_SESSION_TAB_CLOSE, CONFIGURATION );

		expect( harness.coordinator.events ).toMatchObject( [ {
			participantId: 'participant-a',
			cause: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
		} ] );
		expect( harness.coordinator.measurementRevisions ).toEqual( [ 'revision_test_scope' ] );
	} );

	it( 'removes every retained participant with the supplied fail-open cause', async () => {
		const waiting = createWaitingState();
		waiting.participants = [ createNavigationParticipant(
			'participant-a',
			'page_tab_7_alpha',
			true,
			0,
			'https://example.com/',
		) ];
		const harness = createHarness( { 'scope-default': waiting }, [] );

		await harness.reconciler.departAll( DepartureCause.PERMISSION_LOSS, null );

		expect( harness.coordinator.events ).toMatchObject( [ {
			type: 'participant-departure',
			cause: DepartureCause.PERMISSION_LOSS,
		} ] );
	} );

	it( 'keeps unavailable coordinator snapshots inert', async () => {
		const reconciler = createProtectionParticipantReconciler( {
			browser: {
				/**
				 * Returns no live browser tabs.
				 * @return Empty browser-tab collection.
				 * @since 0.1.0 Initial implementation.
				 */
				listTabs: () => Promise.resolve( [] ),
			},
			coordinator: {
				/**
				 * Rejects an unexpected dispatch against unavailable state.
				 * @return Rejected coordinator operation.
				 * @throws {Error} Always, because unavailable snapshots cannot accept events.
				 * @since 0.1.0 Initial implementation.
				 */
				dispatch: () => Promise.reject( new Error( 'Unexpected dispatch.' ) ),
				/**
				 * Returns the unavailable coordinator marker.
				 * @return Unavailable state marker.
				 * @since 0.1.0 Initial implementation.
				 */
				getStates: () => Promise.resolve( null ),
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Rejects an unexpected projection against unavailable state.
			 * @return Rejected browser projection operation.
			 * @throws {Error} Always, because unavailable snapshots cannot produce results.
			 * @since 0.1.0 Initial implementation.
			 */
			applyDispatchResult: () => Promise.reject( new Error( 'Unexpected projection.' ) ),
			/**
			 * Rejects an unexpected injected-layer release against unavailable state.
			 * @return Rejected page release operation.
			 * @throws {Error} Always, because unavailable snapshots own no pages.
			 * @since 0.1.0 Initial implementation.
			 */
			releaseInjectedInterruption: () => Promise.reject( new Error( 'Unexpected release.' ) ),
			/**
			 * Rejects an unexpected page release against unavailable state.
			 * @return Rejected page release operation.
			 * @throws {Error} Always, because unavailable snapshots own no pages.
			 * @since 0.1.0 Initial implementation.
			 */
			releaseNavigationIfInterrupted: () => Promise.reject( new Error( 'Unexpected release.' ) ),
			/**
			 * Returns the deterministic test clock instant.
			 * @return Current test epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 1_800_000_000_000,
			/**
			 * Returns the deterministic calendar for this inert instance.
			 * @return IANA timezone identifier.
			 * @since 0.1.0 Initial implementation.
			 */
			getTimeZone: () => 'UTC',
		} );

		await expect( reconciler.reconcile( CONFIGURATION ) ).resolves.toBeUndefined();
		await expect( reconciler.departAll( DepartureCause.PERMISSION_LOSS, null ) ).resolves.toBeUndefined();
		await expect( reconciler.departTab(
			7,
			DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
			CONFIGURATION,
		) ).resolves.toBeUndefined();
	} );
} );
