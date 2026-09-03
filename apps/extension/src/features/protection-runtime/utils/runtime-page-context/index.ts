import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import {
	ProtectionStateType,
	type AllowanceProtectionState,
	type ProtectionStateTarget,
	type WaitingProtectionState,
} from '../../../../domains/protection/types/protection-state';
import { PageIdSchema, type PageId } from '../../../../domains/protection/types/protection-value';
import { type ProtectionRuntimeParticipantContext } from './types';

const PAGE_ID_PREFIX = 'page_tab_';
const PAGE_ID_PATTERN = /^page_tab_(\d+)_/u;

/**
 * Creates a destination-free page identifier recoverable after background suspension.
 * @param tabId - Nonnegative browser tab identifier.
 * @param stableId - Fresh ASCII identifier fragment.
 * @return Validated runtime page identifier.
 * @since 0.1.0 Initial implementation.
 */
export function createRuntimePageId( tabId: number, stableId: string ): PageId {
	return PageIdSchema.parse( `${ PAGE_ID_PREFIX }${ String( tabId ) }_${ stableId }` );
}

/**
 * Recovers the browser tab identifier encoded in a runtime-owned page identifier.
 * @param pageId - Stable runtime page identifier.
 * @return Nonnegative tab identifier or null for another identifier format.
 * @since 0.1.0 Initial implementation.
 */
export function getRuntimeTabId( pageId: string ): number | null {
	const match = PAGE_ID_PATTERN.exec( pageId );
	const tabId = match?.[ 1 ] === undefined ? Number.NaN : Number( match[ 1 ] );

	return Number.isSafeInteger( tabId ) && tabId >= 0 ? tabId : null;
}

/**
 * Finds the current participant associated with one browser tab.
 * @param statesByScope - Current authoritative scope states.
 * @param tabId - Browser tab identifier.
 * @return Matching Waiting or Ready context, or null when the tab is not retained.
 * @since 0.1.0 Initial implementation.
 */
export function findRuntimeParticipantContext(
	statesByScope: ProtectionCoordinatorStateSnapshot,
	tabId: number,
): ProtectionRuntimeParticipantContext | null {
	for ( const state of Object.values( statesByScope ) ) {
		const participants = state.type === ProtectionStateType.WAITING
			? state.participants
			: state.type === ProtectionStateType.ALLOWANCE
				? state.readyParticipants
				: [];
		const participant = participants.find(
			( candidate ) => getRuntimeTabId( candidate.pageId ) === tabId,
		);

		if ( participant !== undefined && state.type !== ProtectionStateType.IDLE ) {
			return { participant, state };
		}
	}

	return null;
}

/**
 * Creates a transaction target for one Waiting or Allowance state.
 * @param state - Current non-idle protection state.
 * @return State identity accepted by departure events.
 * @since 0.1.0 Initial implementation.
 */
export function createRuntimeStateTarget(
	state: WaitingProtectionState | AllowanceProtectionState,
): ProtectionStateTarget {
	return state.type === ProtectionStateType.WAITING
		? { stateType: ProtectionStateType.WAITING, waitId: state.waitId }
		: { stateType: ProtectionStateType.ALLOWANCE, allowanceId: state.allowanceId };
}

export { type ProtectionRuntimeParticipantContext } from './types';
