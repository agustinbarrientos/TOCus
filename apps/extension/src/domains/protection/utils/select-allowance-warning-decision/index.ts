import {
	AllowanceWarningDecisionSchema,
	AllowanceWarningDecisionType,
	AllowanceWarningDurationMilliseconds,
	AllowanceWarningInputSchema,
	type AllowanceWarningDecision,
} from '../../types/allowance-warning';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { ProtectionStateSchema, ProtectionStateType } from '../../types/protection-state';
import { protectionMatchProtectsScope } from '../match-protection-scope';

/**
 * Selects the declarative allowance-warning change for one page.
 * @param state - Unknown protection-state input.
 * @param input - Unknown allowance-warning observation.
 * @return A warning decision when presentation must change, otherwise null.
 * @throws {import('zod').ZodError} When either public argument or a derived decision violates its contract.
 * @since 0.1.0 Initial implementation.
 */
export function selectAllowanceWarningDecision(
	state: unknown,
	input: unknown,
): AllowanceWarningDecision | null {
	const parsedState = ProtectionStateSchema.parse( state );
	const parsedInput = AllowanceWarningInputSchema.parse( input );
	const eligible =
		parsedState.type === ProtectionStateType.ALLOWANCE &&
		parsedState.scopeId === parsedInput.scopeId &&
		parsedState.allowanceId === parsedInput.allowanceId &&
		parsedInput.nowEpochMilliseconds >=
			parsedState.expiresAtEpochMilliseconds - AllowanceWarningDurationMilliseconds &&
		parsedInput.nowEpochMilliseconds < parsedState.expiresAtEpochMilliseconds &&
		parsedInput.focusEligible &&
		parsedInput.schedule.status === ScheduleEvaluationStatus.ACTIVE &&
		protectionMatchProtectsScope( parsedInput.match, parsedInput.scopeId );

	if ( eligible && ! parsedInput.isWarningPresented ) {
		return AllowanceWarningDecisionSchema.parse( {
			type: AllowanceWarningDecisionType.PRESENT_ALLOWANCE_WARNING,
			pageId: parsedInput.pageId,
			allowanceId: parsedInput.allowanceId,
			expiresAtEpochMilliseconds: parsedState.expiresAtEpochMilliseconds,
		} );
	}

	if ( ! eligible && parsedInput.isWarningPresented ) {
		return AllowanceWarningDecisionSchema.parse( {
			type: AllowanceWarningDecisionType.REMOVE_ALLOWANCE_WARNING,
			pageId: parsedInput.pageId,
			allowanceId: parsedInput.allowanceId,
		} );
	}

	return null;
}
