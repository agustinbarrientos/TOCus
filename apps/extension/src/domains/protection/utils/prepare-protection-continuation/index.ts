import { CompletionAction } from '../../types/completion-action';
import { ProtectionDecisionType, type ProtectionDecision } from '../../types/protection-decision';
import { ProtectionEventType, type ProtectionEvent } from '../../types/protection-event';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType, type ProtectionState } from '../../types/protection-state';
import { ProtectionMeasurementRevisionSchema } from '../../types/protection-value';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../types/schedule-evaluation';
import { MaximumStoredProtectionStatisticsDeliveryBatchCount, StoredProtectionStatisticsDeliveryStatus,
	type StoredProtectionStatisticsDelivery } from '../../types/stored-protection-statistics-delivery';

/**
 * Prepares delivery work only for a freshly authorized navigation-origin continuation.
 * @param delivery - Current bounded durable statistics delivery.
 * @param state - Authoritative state before the participant release.
 * @param event - Freshly observed protection event.
 * @param decisions - Persisted decisions produced by that event.
 * @param measurementRevision - Configuration revision captured for statistics delivery.
 * @return Delivery with one exact URL-free receipt, unchanged delivery, or an incomplete marker.
 * @since 1.0.0 Initial implementation.
 */
export function prepareProtectionContinuation(
	delivery: StoredProtectionStatisticsDelivery,
	state: ProtectionState,
	event: ProtectionEvent,
	decisions: readonly ProtectionDecision[],
	measurementRevision: unknown,
): StoredProtectionStatisticsDelivery {
	if ( event.type !== ProtectionEventType.READY_CONTINUATION &&
		( event.type !== ProtectionEventType.PROGRESS_CHECKPOINT ||
			event.timingConfiguration.completionAction !== CompletionAction.OPEN_AUTOMATICALLY ) ) {
		return delivery;
	}
	const observation = event.type === ProtectionEventType.READY_CONTINUATION
		? event.observation : event.automaticCompletionObservation;
	const revision = ProtectionMeasurementRevisionSchema.safeParse( measurementRevision );
	if ( observation === null || ! revision.success ||
		delivery.status !== StoredProtectionStatisticsDeliveryStatus.COMPLETE ||
		observation.match.status !== ProtectedUrlMatchStatus.PROTECTED ||
		observation.match.rule.scopeId !== state.scopeId ||
		observation.schedule.status !== ScheduleEvaluationStatus.ACTIVE ||
		state.type === ProtectionStateType.IDLE ) {
		return delivery;
	}
	const participants = state.type === ProtectionStateType.WAITING ? state.participants : state.readyParticipants;
	const participant = participants.find( ( candidate ) => candidate.participantId === observation.participantId &&
		candidate.pageId === observation.pageId );
	if ( participant?.origin !== ProtectionParticipantOrigin.NAVIGATION || ! participant.statisticsEligible ||
		participant.siteHost === undefined || participant.siteHost !== observation.match.rule.host ||
		! decisions.some( ( decision ) => decision.type === ProtectionDecisionType.RELEASE_NAVIGATION &&
			decision.participantId === participant.participantId && decision.pageId === participant.pageId ) ) {
		return delivery;
	}
	const allowanceId = event.allowanceId;
	const pendingContinuations = delivery.pendingContinuations ?? [];
	if ( pendingContinuations.some( ( pending ) =>
		pending.scopeId === state.scopeId && pending.allowanceId === allowanceId &&
		pending.participantId === participant.participantId && pending.pageId === participant.pageId ) ) {
		return delivery;
	}
	if ( pendingContinuations.length >= MaximumStoredProtectionStatisticsDeliveryBatchCount ) {
		return { ...delivery, status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE };
	}
	return { ...delivery, pendingContinuations: [ ...pendingContinuations, {
		scopeId: state.scopeId, allowanceId, participantId: participant.participantId, pageId: participant.pageId,
		siteHost: participant.siteHost, measurementRevision: revision.data,
	} ] };
}
