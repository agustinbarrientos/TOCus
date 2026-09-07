import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionCoordinatorDispatchStatus,
	type ProtectionCoordinator,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	createAllowanceState,
	createAllowanceExpiryParticipant,
	createNavigationParticipant,
	createReadyState,
	createWaitingState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import {
	DepartureCause,
	ProtectionEventSchema,
	ProtectionEventType,
	type ProtectionEvent,
} from '../../../../domains/protection/types/protection-event';
import type { ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { ProtectionDecisionSchema, ProtectionDecisionType } from '../../../../domains/protection/types/protection-decision';
import type {
	AllowanceProtectionState,
	WaitingProtectionState,
} from '../../../../domains/protection/types/protection-state';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	InterruptionPageRequestType,
	InterruptionPageResponseState,
} from '../../types/runtime-message';
import type { ProtectionRuntimeBrowser } from '../../types/browser-runtime';
import { createInterruptionRequestHandler } from './index';
import type { InterruptionRequestHandlerOptions } from './types';

/**
 * Fixed wall-clock instant used by interruption-request fixtures.
 * @since 0.1.0 Initial implementation.
 */
const NOW_EPOCH_MILLISECONDS = Date.UTC( 2026, 8, 2, 12 );

/**
 * Applied coordinator result returned by successful dispatch fixtures.
 * @since 0.1.0 Initial implementation.
 */
const APPLIED_RESULT: ProtectionCoordinatorDispatchResult = {
	status: ProtectionCoordinatorDispatchStatus.APPLIED,
	decisions: [],
	facts: [],
};

/**
 * Protected-site configuration used by interruption-request fixtures.
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
 * Creates one Waiting state whose participant page is recoverable as a browser tab.
 * @param focusEligible - Whether the sole participant may own focused progress.
 * @param pageId - Runtime participant page identifier.
 * @param confirmedFocusedDurationMilliseconds - Authoritative focused progress.
 * @return Waiting state owned by the default scope.
 * @since 0.1.0 Initial implementation.
 */
function createTestWaitingState(
	focusEligible = true,
	pageId = 'page_tab_7_waiting',
	confirmedFocusedDurationMilliseconds = 0,
): WaitingProtectionState {
	const participant = createNavigationParticipant(
		'participant_waiting',
		pageId,
		focusEligible,
		0,
		'https://example.com/waiting',
	);

	return {
		...createWaitingState(),
		scopeId: DefaultProtectionScopeId,
		confirmedFocusedDurationMilliseconds,
		participants: [ participant ],
		ownerParticipantId: focusEligible ? participant.participantId : null,
		ownerEpoch: focusEligible ? 1 : 0,
		checkpointHighWaterMilliseconds: focusEligible ? confirmedFocusedDurationMilliseconds : 0,
	};
}

/**
 * Creates one Waiting state in which the requested tab is not the progress owner.
 * @return Waiting state retaining owner and non-owner participants.
 * @since 0.1.0 Initial implementation.
 */
function createNonOwnerWaitingState(): WaitingProtectionState {
	const owner = createNavigationParticipant(
		'participant_owner',
		'page_tab_7_owner',
		true,
		0,
		'https://example.com/owner',
	);
	const nonOwner = createNavigationParticipant(
		'participant_non_owner',
		'page_tab_8_non_owner',
		false,
		1,
		'https://example.com/non-owner',
	);

	return {
		...createWaitingState(),
		scopeId: DefaultProtectionScopeId,
		participants: [ owner, nonOwner ],
		ownerParticipantId: owner.participantId,
	};
}

/**
 * Creates one Allowance state whose Ready participant belongs to tab 7.
 * @param expiresAtEpochMilliseconds - Allowance expiry instant.
 * @return Allowance state owned by the default scope.
 * @since 0.1.0 Initial implementation.
 */
function createTestAllowanceState(
	expiresAtEpochMilliseconds = NOW_EPOCH_MILLISECONDS + 300_000,
): AllowanceProtectionState {
	return {
		...createAllowanceState(),
		scopeId: DefaultProtectionScopeId,
		startedAtEpochMilliseconds: expiresAtEpochMilliseconds - 300_000,
		expiresAtEpochMilliseconds,
		readyParticipants: [ createNavigationParticipant(
			'participant_ready',
			'page_tab_7_ready',
			true,
			0,
			'https://example.com/ready',
		) ],
	};
}

/**
 * Creates deterministic request handling dependencies and captures prepared events.
 * @param statesByScope - Coordinator snapshot returned by default.
 * @param configuration - Configuration returned by local storage.
 * @return Handler and observable dependency doubles.
 * @since 0.1.0 Initial implementation.
 */
function createHandlerHarness(
	statesByScope: ProtectionCoordinatorStateSnapshot | null,
	configuration: ProtectionConfigurationDocument | null = CONFIGURATION,
) {
	const events: ProtectionEvent[] = [];
	const getStates = vi.fn<ProtectionCoordinator[ 'getStates' ]>().mockResolvedValue( statesByScope );
	const dispatch = vi.fn<ProtectionCoordinator[ 'dispatch' ]>( async ( prepareEvent ) => {
		const preparedEvent = await prepareEvent( statesByScope ?? {} );

		events.push( ProtectionEventSchema.parse( preparedEvent ) );

		return APPLIED_RESULT;
	} );
	const getFocusedTabId = vi.fn<ProtectionRuntimeBrowser[ 'getFocusedTabId' ]>().mockResolvedValue( 7 );
	const listTabs = vi.fn<ProtectionRuntimeBrowser[ 'listTabs' ]>().mockResolvedValue( [] );
	const applyDispatchResult = vi
		.fn<InterruptionRequestHandlerOptions[ 'applyDispatchResult' ]>()
		.mockResolvedValue( undefined );
	const createStableId = vi
		.fn<InterruptionRequestHandlerOptions[ 'createStableId' ]>()
		.mockReturnValue( 'request_one' );
	const departTab = vi
		.fn<InterruptionRequestHandlerOptions[ 'departTab' ]>()
		.mockResolvedValue( undefined );
	const getTimeZone = vi
		.fn<InterruptionRequestHandlerOptions[ 'getTimeZone' ]>()
		.mockReturnValue( 'UTC' );
	const loadConfiguration = vi
		.fn<InterruptionRequestHandlerOptions[ 'loadConfiguration' ]>()
		.mockResolvedValue( configuration );
	const now = vi
		.fn<InterruptionRequestHandlerOptions[ 'now' ]>()
		.mockReturnValue( NOW_EPOCH_MILLISECONDS );
	const reconcileExpiredAllowances = vi
		.fn<InterruptionRequestHandlerOptions[ 'reconcileExpiredAllowances' ]>()
		.mockResolvedValue( undefined );
	const refreshToolbarBadge = vi
		.fn<InterruptionRequestHandlerOptions[ 'refreshToolbarBadge' ]>()
		.mockResolvedValue( undefined );
	const releaseInterruptionPresentation = vi
		.fn<InterruptionRequestHandlerOptions[ 'releaseInterruptionPresentation' ]>()
		.mockResolvedValue( undefined );
	const reconcileUnavailableConfiguration = vi
		.fn<InterruptionRequestHandlerOptions[ 'reconcileUnavailableConfiguration' ]>()
		.mockResolvedValue( undefined );
	const handler = createInterruptionRequestHandler( {
		browser: { getFocusedTabId, listTabs },
		coordinator: { dispatch, getStates },
		applyDispatchResult,
		createStableId,
		departTab,
		getTimeZone,
		loadConfiguration,
		now,
		reconcileExpiredAllowances,
		releaseInterruptionPresentation,
		refreshToolbarBadge,
		reconcileUnavailableConfiguration,
	} );

	return {
		applyDispatchResult,
		departTab,
		dispatch,
		events,
		getFocusedTabId,
		getStates,
		handler,
		loadConfiguration,
		reconcileExpiredAllowances,
		listTabs,
		reconcileUnavailableConfiguration,
		releaseInterruptionPresentation,
		refreshToolbarBadge,
	};
}

describe( 'interruption request validation', () => {
	it( 'fails open a privacy-ineligible sender before it can advance protection', async () => {
		const waitingState = createTestWaitingState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 10_000,
		}, 7, false ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.dispatch ).not.toHaveBeenCalled();
		expect( harness.departTab ).toHaveBeenCalledWith(
			7,
			DepartureCause.BROWSER_ERROR_OR_RECOVERY,
			null,
		);
		expect( harness.loadConfiguration ).not.toHaveBeenCalled();
		expect( harness.releaseInterruptionPresentation ).toHaveBeenCalledWith( 7 );
	} );

	it( 'rejects malformed messages and requests without a sender tab', async () => {
		const harness = createHandlerHarness( null );

		await expect( harness.handler.handle( { type: 'unknown' }, 7 ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );
		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, null ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.loadConfiguration ).not.toHaveBeenCalled();
	} );

	it( 'fails open when local configuration is unavailable', async () => {
		const harness = createHandlerHarness( null, null );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.reconcileUnavailableConfiguration ).toHaveBeenCalledOnce();
		expect( harness.reconcileExpiredAllowances ).not.toHaveBeenCalled();
	} );

	it( 'returns unavailable when no participant belongs to the sender tab', async () => {
		const harness = createHandlerHarness( null );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.reconcileExpiredAllowances ).toHaveBeenCalledWith( CONFIGURATION );
		expect( harness.releaseInterruptionPresentation ).not.toHaveBeenCalled();
		expect( harness.refreshToolbarBadge ).not.toHaveBeenCalled();
	} );

	it( 'releases an orphaned presentation after synchronization confirms no participant', async () => {
		const harness = createHandlerHarness( null );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.releaseInterruptionPresentation ).toHaveBeenCalledOnce();
		expect( harness.releaseInterruptionPresentation ).toHaveBeenCalledWith( 7 );
		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'keeps a recovered participant when synchronization finds it on the authoritative recheck', async () => {
		const waitingState = createTestWaitingState();
		const states = { [ DefaultProtectionScopeId ]: waitingState };
		const harness = createHandlerHarness( null );

		harness.getStates.mockResolvedValueOnce( null ).mockResolvedValue( states );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
		} );

		expect( harness.releaseInterruptionPresentation ).not.toHaveBeenCalled();
		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'propagates a local release failure and permits a later recovery attempt', async () => {
		const harness = createHandlerHarness( null );
		const releaseFailure = new Error( 'Browser cleanup failed.' );

		harness.releaseInterruptionPresentation.mockRejectedValueOnce( releaseFailure );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.RECOVER,
			documentVisible: true,
		}, 7, true ) ).rejects.toBe( releaseFailure );
		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.RECOVER,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.releaseInterruptionPresentation ).toHaveBeenCalledTimes( 2 );
		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );
} );

describe( 'interruption page projections', () => {
	it.each( [
		[ 'committed URL', { id: 7, incognito: false, url: 'https://example.com/live' }, 'protected' ],
		[ 'pending URL', {
			id: 7,
			incognito: false,
			url: 'https://unprotected.test/',
			pendingUrl: 'https://example.com/pending',
		}, 'protected' ],
		[ 'missing URL', { id: 7, incognito: false }, 'unprotected' ],
		[ 'private tab', { id: 7, incognito: true, url: 'https://example.com/private' }, 'unprotected' ],
		[ 'missing tab', { id: 8, incognito: false, url: 'https://example.com/other' }, 'unprotected' ],
	] )( 'uses the %s to recheck an injected Continue without retaining the page address', async (
		_label,
		tab,
		matchStatus,
	) => {
		const state = {
			...createReadyState(),
			scopeId: DefaultProtectionScopeId,
			readyParticipants: [ createAllowanceExpiryParticipant( 'participant_ready', 'page_tab_7_ready', true, 0 ) ],
		};
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: state } );
		harness.listTabs.mockResolvedValue( [ tab ] );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( harness.events ).toMatchObject( [ {
			type: ProtectionEventType.READY_CONTINUATION,
			observation: { observedDestination: null, match: { status: matchStatus } },
		} ] );
		expect( harness.applyDispatchResult.mock.calls[ 0 ]?.[ 2 ] ).toEqual( matchStatus === 'protected'
			? {
				participantId: 'participant_ready',
				pageId: 'page_tab_7_ready',
				scopeId: state.scopeId,
				allowanceId: state.allowanceId,
			}
			: undefined );
	} );

	it( 'continues stale scope reconciliation without using another scope measurement revision', async () => {
		const state = {
			...createReadyState(),
			readyParticipants: createTestAllowanceState().readyParticipants,
		};
		const harness = createHandlerHarness( { [ state.scopeId ]: state } );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( harness.events ).toMatchObject( [ {
			type: ProtectionEventType.READY_CONTINUATION,
			scopeId: state.scopeId,
		} ] );
		expect( harness.dispatch ).toHaveBeenCalledWith( expect.any( Function ), undefined );
		expect( harness.applyDispatchResult.mock.calls[ 0 ]?.[ 2 ] ).toBeUndefined();
	} );

	it( 'keeps a completed pause Ready without starting an expiry clock', async () => {
		const state = {
			...createReadyState(),
			scopeId: DefaultProtectionScopeId,
			readyParticipants: createTestAllowanceState().readyParticipants,
		};
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: state } );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: null,
		} );
		expect( harness.events ).toEqual( [] );
		expect( harness.releaseInterruptionPresentation ).not.toHaveBeenCalled();
	} );

	it( 'dispatches pending Continue with the current measurement revision', async () => {
		const state = {
			...createReadyState(),
			scopeId: DefaultProtectionScopeId,
			readyParticipants: createTestAllowanceState().readyParticipants,
		};
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: state } );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( harness.events ).toMatchObject( [ {
			type: ProtectionEventType.READY_CONTINUATION,
			scopeId: DefaultProtectionScopeId,
			allowanceId: state.allowanceId,
			nowEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			observation: { participantId: 'participant_ready', pageId: 'page_tab_7_ready' },
		} ] );
		expect( harness.dispatch ).toHaveBeenCalledWith(
			expect.any( Function ),
			CONFIGURATION.measurementRevisionsByScope[ DefaultProtectionScopeId ],
		);
	} );

	it( 'returns progressing Waiting state for the focused owner', async () => {
		const waitingState = createTestWaitingState();
		const states = { [ DefaultProtectionScopeId ]: waitingState };
		const harness = createHandlerHarness( states );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: waitingState.capturedWaitDurationMilliseconds,
			focusedProgressMilliseconds: waitingState.confirmedFocusedDurationMilliseconds,
			progressing: true,
		} );

		expect( harness.dispatch ).not.toHaveBeenCalled();
		expect( harness.refreshToolbarBadge ).toHaveBeenCalledWith( CONFIGURATION, states );
	} );

	it( 'returns non-progressing Waiting state for a non-owner participant', async () => {
		const waitingState = createNonOwnerWaitingState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 8, true ) ).resolves.toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			progressing: false,
		} );
	} );

	it( 'returns non-progressing Waiting state when its recorded owner is not eligible', async () => {
		const waitingState = createTestWaitingState( false );
		const participant = waitingState.participants[ 0 ];
		const inconsistentProjection: WaitingProtectionState = {
			...waitingState,
			ownerParticipantId: participant?.participantId ?? null,
		};
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: inconsistentProjection } );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		}, 7, true ) ).resolves.toMatchObject( {
			state: InterruptionPageResponseState.WAITING,
			progressing: false,
		} );
	} );

	it( 'returns Ready while the visit allowance remains active', async () => {
		const allowanceState = createTestAllowanceState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: allowanceState } );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 1_000,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: allowanceState.expiresAtEpochMilliseconds,
		} );

		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'returns Ready expired when the allowance interval has ended', async () => {
		const allowanceState = createTestAllowanceState( NOW_EPOCH_MILLISECONDS );
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: allowanceState } );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY_EXPIRED,
		} );
	} );
} );

describe( 'Waiting focus synchronization', () => {
	it( 'ignores Allowance participants', async () => {
		const allowanceState = createTestAllowanceState();
		const participant = allowanceState.readyParticipants[ 0 ];
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: allowanceState } );

		if ( participant === undefined ) {
			throw new Error( 'Expected a Ready participant fixture.' );
		}

		await harness.handler.synchronizeParticipantFocus(
			{ participant, state: allowanceState },
			true,
			CONFIGURATION,
		);

		expect( harness.getFocusedTabId ).not.toHaveBeenCalled();
	} );

	it( 'removes focus eligibility from a page without a runtime tab identifier', async () => {
		const waitingState = createTestWaitingState( true, 'page_unowned' );
		const participant = waitingState.participants[ 0 ];
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		if ( participant === undefined ) {
			throw new Error( 'Expected a Waiting participant fixture.' );
		}

		await harness.handler.synchronizeParticipantFocus(
			{ participant, state: waitingState },
			true,
			CONFIGURATION,
		);

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PARTICIPANT_FOCUS_CHANGE,
			focusEligible: false,
		} );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, CONFIGURATION );
		expect( harness.refreshToolbarBadge ).not.toHaveBeenCalled();
	} );

	it( 'keeps an already ineligible hidden participant unchanged', async () => {
		const waitingState = createTestWaitingState( false );
		const participant = waitingState.participants[ 0 ];
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		if ( participant === undefined ) {
			throw new Error( 'Expected a Waiting participant fixture.' );
		}

		await harness.handler.synchronizeParticipantFocus(
			{ participant, state: waitingState },
			false,
			CONFIGURATION,
		);

		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'removes focus eligibility when another tab has browser focus', async () => {
		const waitingState = createTestWaitingState();
		const participant = waitingState.participants[ 0 ];
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		if ( participant === undefined ) {
			throw new Error( 'Expected a Waiting participant fixture.' );
		}

		harness.getFocusedTabId.mockResolvedValue( 99 );

		await harness.handler.synchronizeParticipantFocus(
			{ participant, state: waitingState },
			true,
			CONFIGURATION,
		);

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PARTICIPANT_FOCUS_CHANGE,
			focusEligible: false,
		} );
	} );

	it( 'adds focus eligibility when the visible participant owns the focused tab', async () => {
		const waitingState = createTestWaitingState( false );
		const participant = waitingState.participants[ 0 ];
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		if ( participant === undefined ) {
			throw new Error( 'Expected a Waiting participant fixture.' );
		}

		await harness.handler.synchronizeParticipantFocus(
			{ participant, state: waitingState },
			true,
			CONFIGURATION,
		);

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PARTICIPANT_FOCUS_CHANGE,
			focusEligible: true,
		} );
	} );
} );

describe( 'interruption page actions', () => {
	it.each( [ CompletionAction.SHOW_CONTINUE, CompletionAction.OPEN_AUTOMATICALLY ] )(
		'carries only the validated injected participant identity from Continue in %s mode',
		async ( completionAction ) => {
			const participant = createAllowanceExpiryParticipant( 'participant_ready', 'page_tab_7_ready', true, 0 );
			const ready = {
				...createReadyState(),
				scopeId: DefaultProtectionScopeId,
				readyParticipants: [ participant ],
			};
			const configuration = {
				...CONFIGURATION,
				timingConfiguration: { ...CONFIGURATION.timingConfiguration, completionAction },
			};
			const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: ready }, configuration );
			harness.listTabs.mockResolvedValue( [ { id: 7, incognito: false, url: 'https://example.com/' } ] );

			await harness.handler.handle( {
				type: InterruptionPageRequestType.CONTINUE,
				documentVisible: true,
			}, 7, true );

			expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, configuration, {
				participantId: participant.participantId,
				pageId: participant.pageId,
				scopeId: ready.scopeId,
				allowanceId: ready.allowanceId,
			} );
		},
	);

	it( 'does not checkpoint a Waiting participant that is not the owner', async () => {
		const waitingState = createNonOwnerWaitingState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 5_000,
		}, 8, true );

		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it( 'checkpoints only the newly displayed focused progress', async () => {
		const waitingState = createTestWaitingState( true, 'page_tab_7_waiting', 1_000 );
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 4_000,
		}, 7, true );

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PROGRESS_CHECKPOINT,
			cumulativeCheckpointMilliseconds: 4_000,
			observedAtEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			completionLocalDate: '2026-09-02',
			allowanceId: 'allowance_request_one',
		} );
		expect( harness.dispatch.mock.calls[ 0 ]?.[ 1 ] ).toBe( 'revision_initial_scope_default' );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, CONFIGURATION );
		expect( harness.refreshToolbarBadge ).not.toHaveBeenCalled();
	} );

	it( 'omits a measurement revision when an unsafe configuration lacks the scope entry', async () => {
		const waitingState = createTestWaitingState();
		const unsafeConfiguration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			measurementRevisionsByScope: {},
		};
		const harness = createHandlerHarness(
			{ [ DefaultProtectionScopeId ]: waitingState },
			unsafeConfiguration,
		);

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 1_000,
		}, 7, true );

		expect( harness.dispatch.mock.calls[ 0 ]?.[ 1 ] ).toBeUndefined();
	} );

	it( 'never subtracts already confirmed progress and tolerates participant departure', async () => {
		const waitingState = createTestWaitingState( true, 'page_tab_7_waiting', 1_000 );
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		harness.getStates
			.mockResolvedValueOnce( { [ DefaultProtectionScopeId ]: waitingState } )
			.mockResolvedValue( null );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 500,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.PROGRESS_CHECKPOINT,
			cumulativeCheckpointMilliseconds: 1_000,
		} );
		expect( harness.refreshToolbarBadge ).not.toHaveBeenCalled();
	} );

	it( 'ignores Continue while the participant is still Waiting', async () => {
		const waitingState = createTestWaitingState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );

	it.each( [
		{ participantId: 'participant_other', pageId: 'page_tab_7_ready' },
		{ participantId: 'participant_ready', pageId: 'page_tab_8_other' },
	] )( 'does not acknowledge another participant release: %j', async ( identity ) => {
		const allowanceState = createTestAllowanceState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: allowanceState } );
		harness.dispatch.mockResolvedValue( {
			...APPLIED_RESULT,
			decisions: [ ProtectionDecisionSchema.parse( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				...identity,
			} ) ],
		} );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: allowanceState.expiresAtEpochMilliseconds,
		} );
	} );

	it( 'does not acknowledge a release whose browser projection fails', async () => {
		const allowanceState = createTestAllowanceState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: allowanceState } );
		harness.dispatch.mockResolvedValue( {
			...APPLIED_RESULT,
			decisions: [ ProtectionDecisionSchema.parse( {
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant_ready',
				pageId: 'page_tab_7_ready',
			} ) ],
		} );
		harness.applyDispatchResult.mockRejectedValue( new Error( 'Browser release failed.' ) );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true ) ).rejects.toThrow( 'Browser release failed.' );
	} );

	it( 'releases a Ready participant after explicit Continue', async () => {
		const allowanceState = createTestAllowanceState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: allowanceState } );

		await harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true );

		expect( harness.events[ 0 ] ).toMatchObject( {
			type: ProtectionEventType.READY_CONTINUATION,
			scopeId: DefaultProtectionScopeId,
			allowanceId: allowanceState.allowanceId,
			nowEpochMilliseconds: NOW_EPOCH_MILLISECONDS,
			observation: {
				observedDestination: 'https://example.com/ready',
				match: { status: ProtectedUrlMatchStatus.PROTECTED },
				schedule: { status: ScheduleEvaluationStatus.ACTIVE },
			},
		} );
		expect( harness.applyDispatchResult ).toHaveBeenCalledWith( APPLIED_RESULT, CONFIGURATION, {
			participantId: 'participant_ready',
			pageId: 'page_tab_7_ready',
			scopeId: allowanceState.scopeId,
			allowanceId: allowanceState.allowanceId,
		} );
		expect( harness.refreshToolbarBadge ).not.toHaveBeenCalled();
	} );

	it( 'tolerates participant departure before Continue is applied', async () => {
		const waitingState = createTestWaitingState();
		const harness = createHandlerHarness( { [ DefaultProtectionScopeId ]: waitingState } );

		harness.getStates
			.mockResolvedValueOnce( { [ DefaultProtectionScopeId ]: waitingState } )
			.mockResolvedValue( null );

		await expect( harness.handler.handle( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		}, 7, true ) ).resolves.toEqual( {
			state: InterruptionPageResponseState.UNAVAILABLE,
		} );

		expect( harness.dispatch ).not.toHaveBeenCalled();
	} );
} );
