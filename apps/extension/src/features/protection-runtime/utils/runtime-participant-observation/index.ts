import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	AllowanceExpiryCandidateSource,
	type AllowanceExpiryCandidate,
	type FreshParticipantObservation,
} from '../../../../domains/protection/types/protection-event';
import {
	ProtectionParticipantOrigin,
	type ProtectionParticipant,
} from '../../../../domains/protection/types/protection-participant';
import { type AllowanceProtectionState } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { getRuntimeTabId } from '../runtime-page-context';

/**
 * Creates a fresh participant observation from current local configuration.
 * @param participant - Current Waiting or Ready participant.
 * @param configuration - Current validated protection configuration.
 * @param nowEpochMilliseconds - Current wall-clock time.
 * @param timeZone - Current IANA time-zone identifier.
 * @return Current destination, match, and schedule observation.
 * @since 0.1.0 Initial implementation.
 */
export function createFreshRuntimeObservation(
	participant: ProtectionParticipant,
	configuration: ProtectionConfigurationDocument,
	nowEpochMilliseconds: number,
	timeZone: string,
): FreshParticipantObservation {
	const match = participant.retainedDestination === null
		? { status: ProtectedUrlMatchStatus.UNPROTECTED } as const
		: matchProtectedUrl(
			participant.retainedDestination,
			configuration.sites.map( ( site ) => site.rule ),
		);
	const schedule = match.status === ProtectedUrlMatchStatus.PROTECTED
		? configuration.schedulesByScope[ match.rule.scopeId ]
		: undefined;

	return {
		participantId: participant.participantId,
		pageId: participant.pageId,
		observedDestination: participant.retainedDestination,
		match,
		schedule: schedule === undefined
			? { status: ScheduleEvaluationStatus.INACTIVE }
			: evaluateSchedule( schedule, nowEpochMilliseconds, timeZone ),
	};
}

/**
 * Creates complete expiry candidates for participants retained in Ready state.
 * @param state - Expiring Allowance state.
 * @param configuration - Current validated protection configuration.
 * @param focusedTabId - Active tab in the focused browser window.
 * @param protectionEligibleTabIds - Tabs explicitly observed outside private browsing.
 * @param liveDestinationsByTab - Committed live-page destinations indexed by browser tab.
 * @return Ready-source expiry candidates.
 * @since 0.1.0 Initial implementation.
 */
export function createReadyRuntimeExpiryCandidates(
	state: AllowanceProtectionState,
	configuration: ProtectionConfigurationDocument,
	focusedTabId: number | null,
	protectionEligibleTabIds: ReadonlySet<number>,
	liveDestinationsByTab: ReadonlyMap<number, string>,
): AllowanceExpiryCandidate[] {
	const rules = configuration.sites.map( ( site ) => site.rule );

	return state.readyParticipants.map( ( participant ) => {
		const tabId = getRuntimeTabId( participant.pageId );
		const protectionEligible = tabId !== null && protectionEligibleTabIds.has( tabId );
		const matchDestination = protectionEligible
			? participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY
				? liveDestinationsByTab.get( tabId )
				: participant.retainedDestination
			: null;

		return {
			source: AllowanceExpiryCandidateSource.READY_PARTICIPANT,
			participantId: participant.participantId,
			pageId: participant.pageId,
			observedDestination: participant.retainedDestination,
			focusEligible: protectionEligible && tabId === focusedTabId,
			match: matchDestination === null || matchDestination === undefined
				? { status: ProtectedUrlMatchStatus.UNPROTECTED }
				: matchProtectedUrl( matchDestination, rules ),
		};
	} );
}
