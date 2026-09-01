import {
	DailyLadderSchema,
	type DailyLadder,
} from '../daily-ladder';
import {
	ProtectionParticipantOrigin,
	ProtectionParticipantSchema,
	type ProtectionParticipant,
} from '../protection-participant';
import {
	ProtectionStateSchema,
	ProtectionStateType,
	type AllowanceProtectionState,
	type IdleProtectionState,
	type WaitingProtectionState,
} from '../protection-state';

/**
 * Creates a validated daily ladder fixture.
 * @param completedWaits - Completed waits on the greatest observed date.
 * @param greatestObservedLocalDate - Greatest observed local calendar date.
 * @return A validated daily ladder.
 * @since 0.1.0 Initial implementation.
 */
export function createDailyLadder(
	completedWaits = 0,
	greatestObservedLocalDate = '2026-08-31',
): DailyLadder {
	return DailyLadderSchema.parse( { completedWaits, greatestObservedLocalDate } );
}

/**
 * Creates one navigation-origin runtime participant fixture.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param focusEligible - Whether the participant may own progress.
 * @param joinSequence - Domain-assigned join order.
 * @param retainedDestination - Retained absolute navigation destination.
 * @return A navigation-origin runtime participant.
 * @since 0.1.0 Initial implementation.
 */
export function createNavigationParticipant(
	participantId = 'participant-a',
	pageId = 'page-a',
	focusEligible = true,
	joinSequence = 0,
	retainedDestination = `https://example.com/${ pageId }`,
): ProtectionParticipant {
	return ProtectionParticipantSchema.parse( {
		origin: ProtectionParticipantOrigin.NAVIGATION,
		participantId,
		pageId,
		retainedDestination,
		focusEligible,
		joinSequence,
	} );
}

/**
 * Creates one allowance-expiry runtime participant fixture.
 * @param participantId - Stable participant identifier.
 * @param pageId - Stable page identifier.
 * @param focusEligible - Whether the participant may own progress.
 * @param joinSequence - Domain-assigned join order.
 * @return An allowance-expiry runtime participant.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceExpiryParticipant(
	participantId = 'participant-a',
	pageId = 'page-a',
	focusEligible = true,
	joinSequence = 0,
): ProtectionParticipant {
	return ProtectionParticipantSchema.parse( {
		origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
		participantId,
		pageId,
		retainedDestination: null,
		focusEligible,
		joinSequence,
	} );
}

/**
 * Creates an Idle state fixture.
 * @return A valid Idle protection state.
 * @since 0.1.0 Initial implementation.
 */
export function createIdleState(): IdleProtectionState {
	const state = ProtectionStateSchema.parse( {
		type: ProtectionStateType.IDLE,
		scopeId: 'scope-default',
		ladder: createDailyLadder(),
	} );

	if ( state.type !== ProtectionStateType.IDLE ) {
		throw new Error( 'Expected an Idle fixture.' );
	}

	return state;
}

/**
 * Creates a focused Waiting state fixture.
 * @return A valid Waiting protection state.
 * @since 0.1.0 Initial implementation.
 */
export function createWaitingState(): WaitingProtectionState {
	const state = ProtectionStateSchema.parse( {
		type: ProtectionStateType.WAITING,
		scopeId: 'scope-default',
		waitId: 'wait-a',
		capturedWaitDurationMilliseconds: 10_000,
		confirmedFocusedDurationMilliseconds: 0,
		participants: [ createNavigationParticipant() ],
		ownerParticipantId: 'participant-a',
		ownerEpoch: 1,
		checkpointHighWaterMilliseconds: 0,
		ladder: createDailyLadder(),
	} );

	if ( state.type !== ProtectionStateType.WAITING ) {
		throw new Error( 'Expected a Waiting fixture.' );
	}

	return state;
}

/**
 * Creates an Allowance state fixture with one Ready participant.
 * @return A valid Allowance protection state.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceState(): AllowanceProtectionState {
	const state = ProtectionStateSchema.parse( {
		type: ProtectionStateType.ALLOWANCE,
		scopeId: 'scope-default',
		allowanceId: 'allowance-a',
		completedWaitId: 'wait-a',
		startedAtEpochMilliseconds: 1_800_000_000_000,
		expiresAtEpochMilliseconds: 1_800_000_300_000,
		readyParticipants: [ createNavigationParticipant() ],
		ladder: createDailyLadder(),
	} );

	if ( state.type !== ProtectionStateType.ALLOWANCE ) {
		throw new Error( 'Expected an Allowance fixture.' );
	}

	return state;
}
