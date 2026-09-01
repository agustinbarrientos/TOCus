import {
	ProtectionEventSchema,
	ProtectionEventType,
	type ProtectionEvent,
} from '../../types/protection-event';
import {
	ProtectionStateSchema,
	type ProtectionState,
} from '../../types/protection-state';
import {
	ProtectionTransitionResultSchema,
	type ProtectionTransitionResult,
} from '../../types/protection-transition-result';
import { createTransitionResult } from '../create-protection-transition-result';
import { handleAllowanceExpiry } from '../handle-allowance-expiry';
import { handleParticipantDeparture } from '../handle-participant-departure';
import { handleParticipantFocusChange } from '../handle-participant-focus-change';
import { handleProgressCheckpoint } from '../handle-progress-checkpoint';
import { handleReadyParticipant } from '../handle-ready-participant';
import { handleScheduleReevaluation } from '../handle-schedule-reevaluation';
import { handleVisitAttempt } from '../handle-visit-attempt';

/**
 * Rejects a protection event that escaped the closed event vocabulary at runtime.
 * @param event - Event proven unreachable by the exhaustive dispatcher switch.
 * @throws {Error} Always, because the runtime event is not part of the closed contract.
 * @since 0.1.0 Initial implementation.
 */
function throwUnhandledProtectionEvent( event: never ): never {
	throw new Error( `Unhandled protection event: ${ JSON.stringify( event ) }` );
}

/**
 * Routes one parsed protection event to its direct transition handler.
 * @param state - Current validated protection state.
 * @param event - Validated protection event from the closed event vocabulary.
 * @return The transition result produced by the selected handler, or a cross-scope no-op.
 * @since 0.1.0 Initial implementation.
 */
export function dispatchProtectionTransition(
	state: ProtectionState,
	event: ProtectionEvent,
): ProtectionTransitionResult {
	if ( state.scopeId !== event.scopeId ) {
		return createTransitionResult( state );
	}

	switch ( event.type ) {
		case ProtectionEventType.VISIT_ATTEMPT:
			return handleVisitAttempt( state, event );
		case ProtectionEventType.PARTICIPANT_FOCUS_CHANGE:
			return handleParticipantFocusChange( state, event );
		case ProtectionEventType.PROGRESS_CHECKPOINT:
			return handleProgressCheckpoint( state, event );
		case ProtectionEventType.PARTICIPANT_DEPARTURE:
			return handleParticipantDeparture( state, event );
		case ProtectionEventType.SCHEDULE_REEVALUATION:
			return handleScheduleReevaluation( state, event );
		case ProtectionEventType.READY_CONTINUATION:
		case ProtectionEventType.READY_RECONCILIATION:
			return handleReadyParticipant( state, event );
		case ProtectionEventType.ALLOWANCE_EXPIRY:
			return handleAllowanceExpiry( state, event );
		default:
			return throwUnhandledProtectionEvent( event );
	}
}

/**
 * Applies one validated event to one validated protection-scope state.
 * @param state - Unknown protection-state input.
 * @param event - Unknown protection-event input.
 * @return The next state with declarative decisions and metric-bearing facts.
 * @throws {import('zod').ZodError} When either public argument or a computed result violates its contract.
 * @since 0.1.0 Initial implementation.
 */
export function transitionProtectionState( state: unknown, event: unknown ): ProtectionTransitionResult {
	const parsedState = ProtectionStateSchema.parse( state );
	const parsedEvent = ProtectionEventSchema.parse( event );

	return ProtectionTransitionResultSchema.parse(
		dispatchProtectionTransition( parsedState, parsedEvent ),
	);
}
