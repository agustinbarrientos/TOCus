import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorDispatchStatus,
	ProtectionCoordinatorFailureReason,
	ProtectionCoordinatorInitializationStatus,
	type ProtectionCoordinator,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorInitializationResult,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	createAllowanceExpiryParticipant,
	createAllowanceState,
	createIdleState,
	createNavigationParticipant,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import {
	DepartureCause,
	ProtectionEventSchema,
	ProtectionEventType,
	type ProtectionEvent,
} from '../../../../domains/protection/types/protection-event';
import { ProtectionDecisionType } from '../../../../domains/protection/types/protection-decision';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import {
	AllowanceIdSchema,
	DefaultProtectionScopeId,
	PageIdSchema,
	ParticipantIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { ProtectionStateReconciliationRequirementReason } from '../../../../domains/protection/utils/restore-protection-state';
import { createProtectionRuntimeRestorer } from './index';
import { type ProtectionRuntimeRestorerOptions } from './types';

/**
 * Fixed wall-clock instant used by restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
const NOW_EPOCH_MILLISECONDS = 1_800_000_100_000;

/**
 * Extension-owned interruption URL used by restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Ready participant retained by allowance restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
const READY_PARTICIPANT = createNavigationParticipant(
	'participant_ready',
	'page_tab_7_ready',
	false,
	0,
	'https://example.com/ready',
);

/**
 * Allowance state retained by restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
const ALLOWANCE_STATE = {
	...createAllowanceState(),
	scopeId: DefaultProtectionScopeId,
	readyParticipants: [ READY_PARTICIPANT ],
};

/**
 * Reconciliation requirement returned by interrupted allowance fixtures.
 * @since 0.1.0 Initial implementation.
 */
const REQUIREMENT = {
	scopeId: DefaultProtectionScopeId,
	allowanceId: ALLOWANCE_STATE.allowanceId,
	participantId: READY_PARTICIPANT.participantId,
	pageId: READY_PARTICIPANT.pageId,
	reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
};

/**
 * Expiry-origin Ready participant whose interruption layer preserves its live page.
 * @since 0.1.0 Initial implementation.
 */
const EXPIRY_READY_PARTICIPANT = createAllowanceExpiryParticipant(
	'participant_expiry_ready',
	'page_tab_8_expiry_ready',
	false,
	0,
);

/**
 * Reconciliation requirement for the preserved expiry-origin participant.
 * @since 0.1.0 Initial implementation.
 */
const EXPIRY_REQUIREMENT = {
	...REQUIREMENT,
	participantId: EXPIRY_READY_PARTICIPANT.participantId,
	pageId: EXPIRY_READY_PARTICIPANT.pageId,
};

/**
 * Protected-site configuration used by restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
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

/**
 * Applied coordinator result returned by successful restoration dispatches.
 * @since 0.1.0 Initial implementation.
 */
const APPLIED_RESULT: ProtectionCoordinatorDispatchResult = {
	status: ProtectionCoordinatorDispatchStatus.APPLIED,
	decisions: [],
	facts: [],
};

/**
 * Creates a deterministic successful initialization result.
 * @param status - Successful initialization status.
 * @param requirement - Ready reconciliation requirement used when requested.
 * @return Successful initialization result with one observable decision.
 * @since 0.1.0 Initial implementation.
 */
function createSuccessfulInitialization(
	status: typeof ProtectionCoordinatorInitializationStatus.READY |
		typeof ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
	requirement = REQUIREMENT,
): ProtectionCoordinatorInitializationResult {
	return status === ProtectionCoordinatorInitializationStatus.READY
		? {
			status,
			decisions: [ {
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: READY_PARTICIPANT.participantId,
				pageId: READY_PARTICIPANT.pageId,
				allowanceId: ALLOWANCE_STATE.allowanceId,
			} ],
			facts: [],
			requirements: [],
		}
		: {
			status,
			decisions: [],
			facts: [],
			requirements: [ requirement ],
		};
}

/**
 * Creates deterministic restoration dependencies and captures prepared events.
 * @param initialization - Coordinator initialization result.
 * @param dispatchStatesByScope - Current states supplied while preparing reconciliation events.
 * @param configuration - Current validated local configuration or unavailable marker.
 * @param tabs - Current browser tab observations.
 * @return Restorer and observable dependency doubles.
 * @since 0.1.0 Initial implementation.
 */
function createRestorerHarness(
	initialization: ProtectionCoordinatorInitializationResult,
	dispatchStatesByScope: ProtectionCoordinatorStateSnapshot = {},
	configuration: ProtectionConfigurationDocument | null = CONFIGURATION,
	tabs: ReadonlyArray<{ id: number; incognito?: boolean; url?: string }> = [],
) {
	const events: ProtectionEvent[] = [];
	const initialize = vi.fn<ProtectionCoordinator[ 'initialize' ]>().mockResolvedValue( initialization );
	const dispatch = vi.fn<ProtectionCoordinator[ 'dispatch' ]>( async ( prepareEvent ) => {
		const event = ProtectionEventSchema.parse( await prepareEvent( dispatchStatesByScope ) );

		events.push( event );

		return APPLIED_RESULT;
	} );
	const loadConfiguration = vi
		.fn<ProtectionRuntimeRestorerOptions[ 'loadConfiguration' ]>()
		.mockResolvedValue( configuration );
	const listTabs = vi
		.fn<ProtectionRuntimeRestorerOptions[ 'listTabs' ]>()
		.mockResolvedValue( tabs );
	const applyDecisions = vi
		.fn<ProtectionRuntimeRestorerOptions[ 'applyDecisions' ]>()
		.mockResolvedValue( undefined );
	const applyDispatchResult = vi
		.fn<ProtectionRuntimeRestorerOptions[ 'applyDispatchResult' ]>()
		.mockResolvedValue( undefined );
	const now = vi
		.fn<ProtectionRuntimeRestorerOptions[ 'now' ]>()
		.mockReturnValue( NOW_EPOCH_MILLISECONDS );
	const getTimeZone = vi
		.fn<ProtectionRuntimeRestorerOptions[ 'getTimeZone' ]>()
		.mockReturnValue( 'UTC' );
	const restorer = createProtectionRuntimeRestorer( {
		coordinator: { dispatch, initialize },
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		applyDecisions,
		applyDispatchResult,
		getTimeZone,
		listTabs,
		loadConfiguration,
		now,
	} );

	return {
		applyDecisions,
		applyDispatchResult,
		dispatch,
		events,
		initialize,
		listTabs,
		loadConfiguration,
		restorer,
	};
}

describe( 'createProtectionRuntimeRestorer', () => {
	it( 'reports failed initialization without projecting untrusted state', async () => {
		const harness = createRestorerHarness( {
			status: ProtectionCoordinatorInitializationStatus.FAILED,
			reason: ProtectionCoordinatorFailureReason.STORAGE_READ_FAILED,
			decisions: [],
			facts: [],
			requirements: [],
		} );

		await expect( harness.restorer.restore() ).resolves.toBe( false );
		expect( harness.initialize ).toHaveBeenCalledWith( {
			nowEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			readyObservations: [],
		} );
		expect( harness.loadConfiguration ).not.toHaveBeenCalled();
		expect( harness.applyDecisions ).not.toHaveBeenCalled();
		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'applies restored decisions after successful initialization', async () => {
		const initialization = createSuccessfulInitialization( ProtectionCoordinatorInitializationStatus.READY );
		const harness = createRestorerHarness( initialization );

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.applyDecisions ).toHaveBeenCalledWith( initialization.decisions, CONFIGURATION );
		expect( harness.listTabs ).not.toHaveBeenCalled();
		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'uses configuration loaded before coordinator restoration when supplied', async () => {
		const initialization = createSuccessfulInitialization( ProtectionCoordinatorInitializationStatus.READY );
		const harness = createRestorerHarness( initialization );

		await expect( harness.restorer.restore( null ) ).resolves.toBe( true );
		expect( harness.loadConfiguration ).not.toHaveBeenCalled();
		expect( harness.applyDecisions ).toHaveBeenCalledWith( initialization.decisions, null );
	} );

	it( 'reconciles the exact Ready participant that remains on the interruption page', async () => {
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: ALLOWANCE_STATE },
			CONFIGURATION,
			[ { id: 7, incognito: false, url: INTERRUPTION_PAGE_URL } ],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.events ).toEqual( [ {
			type: ProtectionEventType.READY_RECONCILIATION,
			scopeId: DefaultProtectionScopeId,
			allowanceId: ALLOWANCE_STATE.allowanceId,
			nowEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			observation: {
				participantId: READY_PARTICIPANT.participantId,
				pageId: READY_PARTICIPANT.pageId,
				observedDestination: READY_PARTICIPANT.retainedDestination,
				match: { status: 'protected', rule: CONFIGURATION.sites[ 0 ]?.rule },
				schedule: { status: 'active' },
			},
		} ] );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, CONFIGURATION );
	} );

	it( 'reconciles an expiry-origin Ready participant from its preserved live page', async () => {
		const expiryAllowance = {
			...ALLOWANCE_STATE,
			readyParticipants: [ EXPIRY_READY_PARTICIPANT ],
		};
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
			EXPIRY_REQUIREMENT,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: expiryAllowance },
			CONFIGURATION,
			[ { id: 8, incognito: false, url: 'https://example.com/preserved-draft' } ],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.events ).toEqual( [ {
			type: ProtectionEventType.READY_RECONCILIATION,
			scopeId: DefaultProtectionScopeId,
			allowanceId: ALLOWANCE_STATE.allowanceId,
			nowEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			observation: {
				participantId: EXPIRY_READY_PARTICIPANT.participantId,
				pageId: EXPIRY_READY_PARTICIPANT.pageId,
				observedDestination: null,
				match: { status: 'protected', rule: CONFIGURATION.sites[ 0 ]?.rule },
				schedule: { status: 'active' },
			},
		} ] );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, CONFIGURATION );
	} );

	it.each( [
		[ 'private tab', true ],
		[ 'tab with unknown privacy', undefined ],
	] )( 'departs a stored Ready participant recovered from a %s', async (
		_label,
		incognito,
	) => {
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: ALLOWANCE_STATE },
			CONFIGURATION,
			[ {
				id: 7,
				url: INTERRUPTION_PAGE_URL,
				...( incognito === undefined ? {} : { incognito } ),
			} ],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.events ).toMatchObject( [ {
			type: ProtectionEventType.PARTICIPANT_DEPARTURE,
			participantId: READY_PARTICIPANT.participantId,
			cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY,
		} ] );
	} );

	it( 'departs an expiry-origin Ready participant whose preserved page is unavailable', async () => {
		const expiryAllowance = {
			...ALLOWANCE_STATE,
			readyParticipants: [ EXPIRY_READY_PARTICIPANT ],
		};
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
			EXPIRY_REQUIREMENT,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: expiryAllowance },
			CONFIGURATION,
			[],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PARTICIPANT_DEPARTURE,
			participantId: EXPIRY_READY_PARTICIPANT.participantId,
			pageId: EXPIRY_READY_PARTICIPANT.pageId,
		} );
	} );

	it( 'departs an expiry-origin Ready participant whose page URL is unavailable', async () => {
		const expiryAllowance = {
			...ALLOWANCE_STATE,
			readyParticipants: [ EXPIRY_READY_PARTICIPANT ],
		};
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
			EXPIRY_REQUIREMENT,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: expiryAllowance },
			CONFIGURATION,
			[ { id: 8, incognito: false } ],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PARTICIPANT_DEPARTURE,
			participantId: EXPIRY_READY_PARTICIPANT.participantId,
			pageId: EXPIRY_READY_PARTICIPANT.pageId,
		} );
	} );

	it.each( [
		{
			label: 'the live page is no longer protected',
			configuration: CONFIGURATION,
			url: 'https://unrelated.example/',
		},
		{
			label: 'the protected scope has no schedule',
			configuration: { ...CONFIGURATION, schedulesByScope: {} },
			url: 'https://example.com/preserved-draft',
		},
	] )( 'marks an expiry-origin Ready observation inactive when $label', async ( testCase ) => {
		const expiryAllowance = {
			...ALLOWANCE_STATE,
			readyParticipants: [ EXPIRY_READY_PARTICIPANT ],
		};
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
			EXPIRY_REQUIREMENT,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: expiryAllowance },
			testCase.configuration,
			[ { id: 8, incognito: false, url: testCase.url } ],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		const event = harness.events[ 0 ];

		if ( event?.type !== ProtectionEventType.READY_RECONCILIATION ) {
			throw new Error( 'Expected one Ready reconciliation event.' );
		}

		expect( event.observation.schedule ).toEqual( { status: 'inactive' } );
	} );

	it.each( [
		{
			label: 'configuration is unavailable',
			states: { [ DefaultProtectionScopeId ]: ALLOWANCE_STATE },
			configuration: null,
			tabs: [ { id: 7, url: INTERRUPTION_PAGE_URL } ],
		},
		{
			label: 'scope state is absent',
			states: {},
			configuration: CONFIGURATION,
			tabs: [ { id: 7, url: INTERRUPTION_PAGE_URL } ],
		},
		{
			label: 'scope state is not an allowance',
			states: { [ DefaultProtectionScopeId ]: {
				...createIdleState(),
				scopeId: DefaultProtectionScopeId,
			} },
			configuration: CONFIGURATION,
			tabs: [ { id: 7, url: INTERRUPTION_PAGE_URL } ],
		},
		{
			label: 'allowance identity changed',
			states: { [ DefaultProtectionScopeId ]: {
				...ALLOWANCE_STATE,
				allowanceId: AllowanceIdSchema.parse( 'allowance_changed' ),
			} },
			configuration: CONFIGURATION,
			tabs: [ { id: 7, url: INTERRUPTION_PAGE_URL } ],
		},
		{
			label: 'participant identity changed',
			states: { [ DefaultProtectionScopeId ]: {
				...ALLOWANCE_STATE,
				readyParticipants: [ {
					...READY_PARTICIPANT,
					participantId: ParticipantIdSchema.parse( 'participant_changed' ),
				} ],
			} },
			configuration: CONFIGURATION,
			tabs: [ { id: 7, url: INTERRUPTION_PAGE_URL } ],
		},
		{
			label: 'participant tab left the interruption page',
			states: { [ DefaultProtectionScopeId ]: ALLOWANCE_STATE },
			configuration: CONFIGURATION,
			tabs: [ { id: 7, incognito: false, url: 'https://example.com/left' } ],
		},
	] )( 'departs the stored Ready participant when $label', async ( testCase ) => {
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
		);
		const harness = createRestorerHarness(
			initialization,
			testCase.states,
			testCase.configuration,
			testCase.tabs,
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		expect( harness.events ).toEqual( [ {
			type: ProtectionEventType.PARTICIPANT_DEPARTURE,
			scopeId: DefaultProtectionScopeId,
			target: {
				stateType: 'allowance',
				allowanceId: ALLOWANCE_STATE.allowanceId,
			},
			participantId: READY_PARTICIPANT.participantId,
			pageId: READY_PARTICIPANT.pageId,
			cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY,
			observedAtEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
		} ] );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, testCase.configuration );
	} );

	it( 'departs a matching participant whose page identifier cannot recover a browser tab', async () => {
		const pageId = PageIdSchema.parse( 'page_unrecoverable' );
		const participant = { ...READY_PARTICIPANT, pageId };
		const requirement = { ...REQUIREMENT, pageId };
		const initialization = createSuccessfulInitialization(
			ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED,
			requirement,
		);
		const harness = createRestorerHarness(
			initialization,
			{ [ DefaultProtectionScopeId ]: {
				...ALLOWANCE_STATE,
				readyParticipants: [ participant ],
			} },
			CONFIGURATION,
			[],
		);

		await expect( harness.restorer.restore() ).resolves.toBe( true );
		const event = harness.events[ 0 ];

		if ( event?.type !== ProtectionEventType.PARTICIPANT_DEPARTURE ) {
			throw new Error( 'Expected one participant departure event.' );
		}

		expect( event.pageId ).toBe( pageId );
	} );
} );
