import {
	ProtectionStateType,
	type AllowanceProtectionState,
	type ProtectionState,
	type ProtectionStateTarget,
	type WaitingProtectionState,
	type ReadyProtectionState,
} from '../../types/protection-state';

/**
 * Checks whether a transaction target identifies the current non-Idle state.
 * @param state - Current validated protection state.
 * @param target - Validated Waiting, Ready, or Allowance transaction target.
 * @return Whether the state and target have the same kind and transaction identifier.
 * @since 0.1.0 Initial implementation.
 */
export function protectionStateMatchesTarget(
	state: ProtectionState,
	target: ProtectionStateTarget,
): state is WaitingProtectionState | ReadyProtectionState | AllowanceProtectionState {
	if (
		state.type === ProtectionStateType.WAITING &&
		target.stateType === ProtectionStateType.WAITING
	) {
		return state.waitId === target.waitId;
	}

	if (
		state.type === ProtectionStateType.READY &&
		target.stateType === ProtectionStateType.READY
	) {
		return state.allowanceId === target.allowanceId;
	}

	if (
		state.type === ProtectionStateType.ALLOWANCE &&
		target.stateType === ProtectionStateType.ALLOWANCE
	) {
		return state.allowanceId === target.allowanceId;
	}

	return false;
}
