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
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { DepartureCause } from '../../../../domains/protection/types/protection-event';
import {
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import { createProtectionParticipantReconciler } from './index';
import { type ProtectionParticipantReconciler } from './types';

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
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ TEST_SCOPE_ID ]: { mode: 'always' },
	},
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
 * @return Reconciler, coordinator fixture, and release spy.
 * @since 0.1.0 Initial implementation.
 */
function createHarness(
	states: ProtectionCoordinatorStateSnapshot,
	tabs: ReadonlyArray<ProtectionRuntimeTab>,
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
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			applyDispatchResult,
			releaseInjectedInterruption,
			releaseNavigationIfInterrupted,
			now,
		} ),
	};
}

describe( 'createProtectionParticipantReconciler', () => {
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

	it( 'retains a navigation participant while its interruption page and scope remain current', async () => {
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
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toEqual( [] );
		expect( harness.releaseInjectedInterruption ).not.toHaveBeenCalled();
		expect( harness.releaseNavigationIfInterrupted ).not.toHaveBeenCalled();
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

	it( 'retains an allowance-expiry participant while its interruption page remains current', async () => {
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

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.coordinator.events ).toEqual( [] );
	} );

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
