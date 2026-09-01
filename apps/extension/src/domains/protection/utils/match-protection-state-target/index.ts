import {
	ProtectionStateType,
	type AllowanceProtectionState,
	type ProtectionState,
	type ProtectionStateTarget,
	type WaitingProtectionState,
} from '../../types/protection-state';

/**
 * Checks whether a transaction target identifies the current non-Idle state.
 * @param state - Current validated protection state.
 * @param target - Validated Waiting or Allowance transaction target.
 * @return Whether the state and target have the same kind and transaction identifier.
 * @since 0.1.0 Initial implementation.
 */
export function protectionStateMatchesTarget(
	state: ProtectionState,
	target: ProtectionStateTarget,
): state is WaitingProtectionState | AllowanceProtectionState {
	if (
		state.type === ProtectionStateType.WAITING &&
		target.stateType === ProtectionStateType.WAITING
	) {
		return state.waitId === target.waitId;
	}

	if (
		state.type === ProtectionStateType.ALLOWANCE &&
		target.stateType === ProtectionStateType.ALLOWANCE
	) {
		return state.allowanceId === target.allowanceId;
	}

	return false;
}
