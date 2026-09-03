import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorDispatchStatus,
	type ProtectionCoordinator,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createIdleState,
	createNavigationParticipant,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import {
	AllowanceExpiryCandidateSource,
	ProtectionEventSchema,
	ProtectionEventType,
	type ProtectionEvent,
} from '../../../../domains/protection/types/protection-event';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type AllowanceProtectionState } from '../../../../domains/protection/types/protection-state';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { transitionProtectionState } from '../../../../domains/protection/utils/transition-protection-state';
import { type ProtectionRuntimeBrowser, type ProtectionRuntimeTab } from '../../types/browser-runtime';
import { createAllowanceExpiryReconciler } from './index';
import { type AllowanceExpiryReconcilerOptions } from './types';

/** Fixed wall-clock instant used by allowance-expiry fixtures. */
const NOW_EPOCH_MILLISECONDS = Date.UTC( 2026, 8, 2, 12 );

/** Independent protection scope used by multi-scope fixtures. */
const OTHER_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_other' );

/** Applied coordinator result returned by successful dispatch fixtures. */
const APPLIED_RESULT: ProtectionCoordinatorDispatchResult = {
	status: ProtectionCoordinatorDispatchStatus.APPLIED,
	decisions: [],
	facts: [],
};

/** Protected-site configuration used by allowance-expiry fixtures. */
const CONFIGURATION: ProtectionConfigurationDocument = {
	schemaVersion: 2,
	sites: [
		{
			identityHost: 'example.com',
			rule: {
				host: 'example.com',
				includeSubdomains: true,
				scopeId: DefaultProtectionScopeId,
			},
		},
		{
			identityHost: 'other.example',
			rule: {
				host: 'other.example',
				includeSubdomains: true,
				scopeId: OTHER_SCOPE_ID,
			},
		},
	],
	timingConfiguration: TestEmptyProtectionConfiguration.timingConfiguration,
	schedulesByScope: {
		[ DefaultProtectionScopeId ]: { mode: 'always' },
		[ OTHER_SCOPE_ID ]: { mode: 'always' },
	},
};

/**
 * Creates an allowance state at a configurable expiry instant.
 * @param expiresAtEpochMilliseconds - Allowance expiry instant.
 * @return Allowance state owned by the default protection scope.
 */
function createTestAllowanceState(
	expiresAtEpochMilliseconds: number,
): AllowanceProtectionState {
	return {
		...createAllowanceState(),
		scopeId: DefaultProtectionScopeId,
		startedAtEpochMilliseconds: expiresAtEpochMilliseconds - 300_000,
		expiresAtEpochMilliseconds,
		readyParticipants: [ createNavigationParticipant(
			'participant_ready',
			'page_tab_9_ready',
			true,
			0,
			'https://example.com/ready',
		) ],
	};
}

/**
 * Creates deterministic reconciliation dependencies and captures prepared events.
 * @param statesByScope - Initial coordinator state snapshot.
 * @param dispatchStatesByScope - Snapshot supplied while preparing an event.
 * @param tabs - Open browser tabs returned to the reconciler.
 * @return Reconciler and observable dependency doubles.
 */
function createReconcilerHarness(
	statesByScope: ProtectionCoordinatorStateSnapshot | null,
	dispatchStatesByScope: ProtectionCoordinatorStateSnapshot = statesByScope ?? {},
	tabs: ReadonlyArray<ProtectionRuntimeTab> = [],
) {
	const events: ProtectionEvent[] = [];
	const getStates = vi.fn<ProtectionCoordinator[ 'getStates' ]>().mockResolvedValue( statesByScope );
	const dispatch = vi.fn<ProtectionCoordinator[ 'dispatch' ]>( async ( prepareEvent ) => {
		const preparedEvent = await prepareEvent( dispatchStatesByScope );

		events.push( ProtectionEventSchema.parse( preparedEvent ) );

		return APPLIED_RESULT;
	} );
	const getFocusedTabId = vi.fn<ProtectionRuntimeBrowser[ 'getFocusedTabId' ]>().mockResolvedValue( 7 );
	const listTabs = vi.fn<ProtectionRuntimeBrowser[ 'listTabs' ]>().mockResolvedValue( tabs );
	const applyDispatchResult = vi
		.fn<AllowanceExpiryReconcilerOptions[ 'applyDispatchResult' ]>()
		.mockResolvedValue( undefined );
	const createStableId = vi
		.fn<AllowanceExpiryReconcilerOptions[ 'createStableId' ]>()
		.mockReturnValueOnce( 'live_one' )
		.mockReturnValueOnce( 'page_one' )
		.mockReturnValueOnce( 'live_two' )
		.mockReturnValueOnce( 'page_two' )
		.mockReturnValue( 'wait_one' );
	const getTimeZone = vi
		.fn<AllowanceExpiryReconcilerOptions[ 'getTimeZone' ]>()
		.mockReturnValue( 'UTC' );
	const now = vi
		.fn<AllowanceExpiryReconcilerOptions[ 'now' ]>()
		.mockReturnValue( NOW_EPOCH_MILLISECONDS );
	const reconciler = createAllowanceExpiryReconciler( {
		browser: { getFocusedTabId, listTabs },
		coordinator: { dispatch, getStates },
		applyDispatchResult,
		createStableId,
		getTimeZone,
		now,
	} );

	return {
		applyDispatchResult,
		createStableId,
		dispatch,
		events,
		getFocusedTabId,
		listTabs,
		reconciler,
	};
}

describe( 'createAllowanceExpiryReconciler', () => {
	it( 'does nothing before coordinator initialization', async () => {
		const harness = createReconcilerHarness( null );

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.listTabs ).not.toHaveBeenCalled();
		expect( harness.dispatch ).not.toHaveBeenCalled();
		expect( harness.applyDispatchResult ).not.toHaveBeenCalled();
	} );

	it( 'ignores idle states and allowances whose interval is still active', async () => {
		const futureAllowance = createTestAllowanceState( NOW_EPOCH_MILLISECONDS + 300_000 );
		const idleState = {
			...createIdleState(),
			scopeId: OTHER_SCOPE_ID,
		};
		const harness = createReconcilerHarness( {
			[ DefaultProtectionScopeId ]: futureAllowance,
			[ OTHER_SCOPE_ID ]: idleState,
		} );

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.getFocusedTabId ).not.toHaveBeenCalled();
		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'combines Ready participants with protected live pages at allowance expiry', async () => {
		const expiredAllowance = createTestAllowanceState( NOW_EPOCH_MILLISECONDS );
		const harness = createReconcilerHarness(
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			[
				{ id: 1 },
				{ id: 2, url: 'https://unprotected.example/' },
				{ id: 3, url: 'https://other.example/' },
				{ id: 7, url: 'https://example.com/focused' },
				{ id: 8, url: 'https://sub.example.com/background' },
			],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.events ).toHaveLength( 1 );
		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.ALLOWANCE_EXPIRY,
			scopeId: DefaultProtectionScopeId,
			allowanceId: expiredAllowance.allowanceId,
			nowEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			observedLocalDate: '2026-09-02',
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
			candidates: [
				{
					source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
					pageId: 'page_tab_9_ready',
					focusEligible: false,
				},
				{
					source: AllowanceExpiryCandidateSource.LIVE_PAGE,
					pageId: 'page_tab_7_page_one',
					observedDestination: 'https://example.com/focused',
					focusEligible: true,
				},
				{
					source: AllowanceExpiryCandidateSource.LIVE_PAGE,
					pageId: 'page_tab_8_page_two',
					observedDestination: 'https://sub.example.com/background',
					focusEligible: false,
				},
			],
		} );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, CONFIGURATION );
	} );

	it( 'does not duplicate a Ready participant discovered as the same live tab', async () => {
		const expiredAllowance = createTestAllowanceState( NOW_EPOCH_MILLISECONDS );
		const harness = createReconcilerHarness(
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			[ { id: 9, url: 'https://example.com/ready' } ],
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.events[ 0 ] ).toMatchObject( {
			candidates: [ {
				source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
				pageId: 'page_tab_9_ready',
			} ],
		} );
		expect( harness.createStableId ).toHaveBeenCalledOnce();
	} );

	it( 'reattaches a preserved expiry-origin Ready page to the next wait', async () => {
		const expiredAllowance = {
			...createTestAllowanceState( NOW_EPOCH_MILLISECONDS ),
			readyParticipants: [ createAllowanceExpiryParticipant(
				'participant_expiry',
				'page_tab_9_expiry',
				true,
				0,
			) ],
		};
		const harness = createReconcilerHarness(
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			[ { id: 9, url: 'https://example.com/preserved-draft' } ],
		);
		harness.getFocusedTabId.mockResolvedValue( 9 );

		await harness.reconciler.reconcile( CONFIGURATION );

		const expiryEvent = harness.events[ 0 ];

		expect( expiryEvent ).toMatchObject( {
			candidates: [ {
				source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
				participantId: 'participant_expiry',
				pageId: 'page_tab_9_expiry',
				observedDestination: null,
				focusEligible: true,
				match: { status: 'protected', rule: CONFIGURATION.sites[ 0 ]?.rule },
			} ],
		} );
		const transition = transitionProtectionState( expiredAllowance, expiryEvent );

		expect( transition.state ).toMatchObject( {
			type: 'waiting',
			participants: [ {
				origin: 'allowance-expiry',
				participantId: 'participant_expiry',
				pageId: 'page_tab_9_expiry',
				retainedDestination: null,
			} ],
		} );
		expect( transition.decisions ).toContainEqual( expect.objectContaining( {
			type: 'present-waiting',
			pageId: 'page_tab_9_expiry',
		} ) );
	} );

	it( 'uses the observed allowance and an inactive schedule when the dispatch snapshot changed', async () => {
		const expiredAllowance = createTestAllowanceState( NOW_EPOCH_MILLISECONDS );
		const configurationWithoutSchedule: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {},
		};
		const harness = createReconcilerHarness(
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			{},
		);

		await harness.reconciler.reconcile( configurationWithoutSchedule );

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.ALLOWANCE_EXPIRY,
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
			candidates: [ {
				source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
				pageId: 'page_tab_9_ready',
			} ],
		} );
		expect( harness.createStableId ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'falls back from a different current state while preparing the expiry event', async () => {
		const expiredAllowance = createTestAllowanceState( NOW_EPOCH_MILLISECONDS );
		const idleState = {
			...createIdleState(),
			scopeId: DefaultProtectionScopeId,
		};
		const harness = createReconcilerHarness(
			{ [ DefaultProtectionScopeId ]: expiredAllowance },
			{ [ DefaultProtectionScopeId ]: idleState },
		);

		await harness.reconciler.reconcile( CONFIGURATION );

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.ALLOWANCE_EXPIRY,
			candidates: [ {
				source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
				pageId: 'page_tab_9_ready',
			} ],
		} );
	} );
} );
