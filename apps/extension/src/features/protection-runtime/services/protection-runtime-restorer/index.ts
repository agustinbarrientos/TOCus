import {
	ProtectionCoordinatorInitializationStatus,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	DepartureCause,
	ProtectionEventType,
	type FreshParticipantObservation,
	type ParticipantDepartureEvent,
	type ReadyReconciliationEvent,
} from '../../../../domains/protection/types/protection-event';
import {
	ProtectionParticipantOrigin,
	type ProtectionParticipant,
} from '../../../../domains/protection/types/protection-participant';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { type ProtectionStateReconciliationRequirement } from '../../../../domains/protection/utils/restore-protection-state';
import { createFreshRuntimeObservation } from '../../utils/runtime-participant-observation';
import { getRuntimeTabId } from '../../utils/runtime-page-context';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import { type ProtectionRuntimeRestorer, type ProtectionRuntimeRestorerOptions } from './types';

/**
 * Finds the exact current Ready participant named by one restoration requirement.
 * @param statesByScope - Current states held by the coordinator dispatch barrier.
 * @param requirement - Persisted Ready participant identity requiring reconciliation.
 * @return Exact Ready participant or null when its transaction identity changed.
 * @since 0.1.0 Initial implementation.
 */
function findRequiredParticipant(
	statesByScope: ProtectionCoordinatorStateSnapshot,
	requirement: ProtectionStateReconciliationRequirement,
): ProtectionParticipant | null {
	const state = statesByScope[ requirement.scopeId ];

	if (
		state?.type !== ProtectionStateType.ALLOWANCE ||
		state.allowanceId !== requirement.allowanceId
	) {
		return null;
	}

	return state.readyParticipants.find(
		( participant ) =>
			participant.participantId === requirement.participantId &&
			participant.pageId === requirement.pageId,
	) ?? null;
}

/**
 * Creates a fail-open departure for one unresolved restored participant.
 * @param requirement - Persisted Ready participant identity requiring reconciliation.
 * @param observedAtEpochMilliseconds - Current wall-clock time.
 * @return Participant departure event targeting the restored allowance transaction.
 * @since 0.1.0 Initial implementation.
 */
function createRecoveryDeparture(
	requirement: ProtectionStateReconciliationRequirement,
	observedAtEpochMilliseconds: number,
): ParticipantDepartureEvent {
	return {
		type: ProtectionEventType.PARTICIPANT_DEPARTURE,
		scopeId: requirement.scopeId,
		target: {
			stateType: ProtectionStateType.ALLOWANCE,
			allowanceId: requirement.allowanceId,
		},
		participantId: requirement.participantId,
		pageId: requirement.pageId,
		cause: DepartureCause.BROWSER_ERROR_OR_RECOVERY,
		observedAtEpochMilliseconds,
	};
}

/**
 * Creates one fresh Ready observation only while its expected page still exists.
 * @param participant - Exact current Ready participant.
 * @param tab - Browser tab recovered from the runtime page identifier.
 * @param configuration - Current validated protection configuration.
 * @param interruptionPageUrl - Extension-owned navigation interruption URL.
 * @param nowEpochMilliseconds - Current wall-clock instant.
 * @param timeZone - Current IANA time-zone identifier.
 * @return Fresh participant observation or null when its expected page is absent.
 * @since 0.1.0 Initial implementation.
 */
function createRestoredReadyObservation(
	participant: ProtectionParticipant,
	tab: ProtectionRuntimeTab | undefined,
	configuration: ProtectionConfigurationDocument,
	interruptionPageUrl: string,
	nowEpochMilliseconds: number,
	timeZone: string,
): FreshParticipantObservation | null {
	if ( participant.origin === ProtectionParticipantOrigin.NAVIGATION ) {
		return tab?.url === interruptionPageUrl
			? createFreshRuntimeObservation( participant, configuration, nowEpochMilliseconds, timeZone )
			: null;
	}

	if ( tab?.url === undefined ) {
		return null;
	}

	const match = matchProtectedUrl(
		tab.url,
		configuration.sites.map( ( site ) => site.rule ),
	);
	const schedule = match.status === ProtectedUrlMatchStatus.PROTECTED
		? configuration.schedulesByScope[ match.rule.scopeId ]
		: undefined;

	return {
		participantId: participant.participantId,
		pageId: participant.pageId,
		observedDestination: null,
		match,
		schedule: schedule === undefined
			? { status: ScheduleEvaluationStatus.INACTIVE }
			: evaluateSchedule( schedule, nowEpochMilliseconds, timeZone ),
	};
}

/**
 * Creates one focused startup restorer around coordinator and browser boundaries.
 * @param options - Coordinator, browser observations, configuration, and effect callbacks.
 * @return Startup restoration service.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionRuntimeRestorer(
	options: ProtectionRuntimeRestorerOptions,
): ProtectionRuntimeRestorer {
	/**
	 * Resolves one restored Ready requirement against current coordinator and tab state.
	 * @param requirement - Persisted Ready participant identity requiring reconciliation.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param tabs - Current browser tabs used to recover navigation and expiry-layer pages.
	 * @return Promise resolved after the reconciliation result is projected.
	 * @since 0.1.0 Initial implementation.
	 */
	async function resolveRequirement(
		requirement: ProtectionStateReconciliationRequirement,
		configuration: Awaited<ReturnType<ProtectionRuntimeRestorerOptions[ 'loadConfiguration' ]>>,
		tabs: ReadonlyArray<ProtectionRuntimeTab>,
	): Promise<void> {
		const tabId = getRuntimeTabId( requirement.pageId );
		const tab = tabId === null ? undefined : tabs.find( ( candidate ) => candidate.id === tabId );
		const result = await options.coordinator.dispatch( ( statesByScope ) => {
			const participant = findRequiredParticipant( statesByScope, requirement );
			const nowEpochMilliseconds = options.now();
			const observation = configuration === null || participant === null
				? null
				: createRestoredReadyObservation(
					participant,
					tab,
					configuration,
					options.interruptionPageUrl,
					nowEpochMilliseconds,
					options.getTimeZone(),
				);

			if ( participant !== null && observation !== null ) {
				const event: ReadyReconciliationEvent = {
					type: ProtectionEventType.READY_RECONCILIATION,
					scopeId: requirement.scopeId,
					allowanceId: requirement.allowanceId,
					nowEpochMilliseconds,
					observation,
				};

				return event;
			}

			return createRecoveryDeparture( requirement, nowEpochMilliseconds );
		} );

		await options.applyDispatchResult( result, configuration );
	}

	/**
	 * Restores authoritative state and resolves incomplete Ready observations.
	 * @return True after successful restoration, or false after failed initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	async function restore(): Promise<boolean> {
		const initialization = await options.coordinator.initialize( {
			nowEpochMilliseconds: options.now(),
			readyObservations: [],
		} );

		if ( initialization.status === ProtectionCoordinatorInitializationStatus.FAILED ) {
			return false;
		}

		const configuration = await options.loadConfiguration();

		await options.applyDecisions( initialization.decisions, configuration );

		if ( initialization.status === ProtectionCoordinatorInitializationStatus.READY ) {
			return true;
		}

		const tabs = configuration === null ? [] : await options.listTabs();

		for ( const requirement of initialization.requirements ) {
			await resolveRequirement( requirement, configuration, tabs );
		}

		return true;
	}

	return { restore };
}

export { type ProtectionRuntimeRestorer, type ProtectionRuntimeRestorerOptions } from './types';
