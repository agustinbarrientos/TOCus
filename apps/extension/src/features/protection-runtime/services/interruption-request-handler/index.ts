import {
	DepartureCause,
	ProtectionEventType,
	type FreshParticipantObservation,
} from '../../../../domains/protection/types/protection-event';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ProtectionDecisionType } from '../../../../domains/protection/types/protection-decision';
import {
	ProtectionCoordinatorDispatchStatus,
	type ProtectionCoordinatorDispatchResult,
} from '../../../../domains/protection/services/protection-coordinator';
import { ProtectionParticipantOrigin } from '../../../../domains/protection/types/protection-participant';
import { AllowanceIdSchema, type AllowanceId } from '../../../../domains/protection/types/protection-value';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { protectionMatchProtectsScope } from '../../../../domains/protection/utils/match-protection-scope';
import type { ProtectionContinuationContext } from '../protection-page-projector/types';
import {
	InterruptionPageRequestSchema,
	InterruptionPageRequestType,
	InterruptionPageResponseSchema,
	InterruptionPageResponseState,
	type InterruptionPageResponse,
} from '../../types/runtime-message';
import { createFreshRuntimeObservation } from '../../utils/runtime-participant-observation';
import { createRuntimeLocalDate } from '../../utils/runtime-local-date';
import {
	findRuntimeParticipantContext,
	getRuntimeTabId,
	type ProtectionRuntimeParticipantContext,
} from '../../utils/runtime-page-context';
import type {
	InterruptionRequestHandler,
	InterruptionRequestHandlerOptions,
} from './types';

/**
 * Identifies an applied release decision for the exact requesting participant.
 * @param result - Coordinator result whose browser projection has settled.
 * @param context - Participant retained when the request began.
 * @return Whether the request released this interruption.
 * @since 0.1.0 Initial implementation.
 */
function hasParticipantReleaseDecision(
	result: ProtectionCoordinatorDispatchResult | null,
	context: ProtectionRuntimeParticipantContext,
): boolean {
	return result?.status === ProtectionCoordinatorDispatchStatus.APPLIED && result.decisions.some( ( decision ) =>
		( decision.type === ProtectionDecisionType.RELEASE_NAVIGATION ||
			decision.type === ProtectionDecisionType.DISMISS_INTERRUPTION ) &&
		decision.participantId === context.participant.participantId &&
		decision.pageId === context.participant.pageId );
}

/**
 * Identifies one requested entry only while its fresh observation still protects the same scope.
 * @param context - Current participant and protection state.
 * @param allowanceId - Reserved allowance expected to authorize the entry.
 * @param observation - Fresh URL and schedule observation used by the domain event.
 * @return Exact entry identity, or undefined when the observation does not authorize entry.
 * @since 0.1.0 Initial implementation.
 */
function createContinuationContext(
	context: ProtectionRuntimeParticipantContext,
	allowanceId: AllowanceId,
	observation: FreshParticipantObservation,
): ProtectionContinuationContext | undefined {
	return observation.schedule.status === ScheduleEvaluationStatus.ACTIVE &&
		protectionMatchProtectsScope( observation.match, context.state.scopeId )
		? {
			participantId: context.participant.participantId,
			pageId: context.participant.pageId,
			scopeId: context.state.scopeId,
			allowanceId,
		}
		: undefined;
}

/**
 * Creates authoritative interruption-page request handling.
 * @param options - State, browser, clock, and projection dependencies.
 * @return Interruption request and focus operations.
 * @since 0.1.0 Initial implementation.
 */
export function createInterruptionRequestHandler(
	options: InterruptionRequestHandlerOptions,
): InterruptionRequestHandler {
	/**
	 * Reads the current URL used to validate a participant's protection scope.
	 * @param context - Current interruption participant and transaction.
	 * @return Retained navigation URL or freshly observed ordinary live-page URL.
	 * @since 0.1.0 Initial implementation.
	 */
	async function readMatchingDestination( context: ProtectionRuntimeParticipantContext ): Promise<string | null> {
		if ( context.participant.origin === ProtectionParticipantOrigin.NAVIGATION ) {
			return context.participant.retainedDestination;
		}

		const tabId = getRuntimeTabId( context.participant.pageId );
		const tab = ( await options.browser.listTabs() ).find( ( candidate ) => candidate.id === tabId );

		return tab?.incognito === false ? tab.pendingUrl ?? tab.url ?? null : null;
	}

	/**
	 * Creates the current interruption-page projection for one sender tab.
	 * @param tabId - Browser-provided sender tab identifier.
	 * @return Validated authoritative page projection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function createPageResponse( tabId: number ): Promise<InterruptionPageResponse> {
		const statesByScope = await options.coordinator.getStates();
		const context = statesByScope === null ? null : findRuntimeParticipantContext( statesByScope, tabId );

		if ( context?.state.type === ProtectionStateType.WAITING ) {
			return InterruptionPageResponseSchema.parse( {
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: context.state.capturedWaitDurationMilliseconds,
				focusedProgressMilliseconds: context.state.confirmedFocusedDurationMilliseconds,
				progressing:
					context.state.ownerParticipantId === context.participant.participantId &&
					context.participant.focusEligible,
			} );
		}

		if ( context?.state.type === ProtectionStateType.READY ) {
			return InterruptionPageResponseSchema.parse( {
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: null,
			} );
		}

		if ( context?.state.type === ProtectionStateType.ALLOWANCE ) {
			return InterruptionPageResponseSchema.parse( options.now() < context.state.expiresAtEpochMilliseconds
				? {
					state: InterruptionPageResponseState.READY,
					allowanceExpiresAtEpochMilliseconds: context.state.expiresAtEpochMilliseconds,
				}
				: { state: InterruptionPageResponseState.READY_EXPIRED } );
		}

		return InterruptionPageResponseSchema.parse( { state: InterruptionPageResponseState.UNAVAILABLE } );
	}

	/**
	 * Synchronizes one Waiting participant's current focus eligibility.
	 * @param context - Current participant and state.
	 * @param documentVisible - Whether the interruption document is visible.
	 * @param configuration - Current validated local configuration.
	 * @return Whether a browser projection was applied after an ownership transition.
	 * @since 0.1.0 Initial implementation.
	 */
	async function synchronizeParticipantFocusAndReport(
		context: ProtectionRuntimeParticipantContext,
		documentVisible: boolean,
		configuration: Parameters<InterruptionRequestHandler[ 'synchronizeParticipantFocus' ]>[ 2 ],
	): Promise<boolean> {
		if ( context.state.type !== ProtectionStateType.WAITING ) {
			return false;
		}

		const waitingState = context.state;
		const tabId = getRuntimeTabId( context.participant.pageId );
		const focusedTabId = await options.browser.getFocusedTabId();
		const focusEligible = documentVisible && tabId !== null && tabId === focusedTabId;

		if ( context.participant.focusEligible === focusEligible ) {
			return false;
		}

		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.PARTICIPANT_FOCUS_CHANGE,
			scopeId: waitingState.scopeId,
			waitId: waitingState.waitId,
			participantId: context.participant.participantId,
			ownerEpoch: waitingState.ownerEpoch,
			focusEligible,
		} ) );

		await options.applyDispatchResult( result, configuration );

		return true;
	}

	/**
	 * Synchronizes one Waiting participant's current focus eligibility.
	 * @param context - Current participant and state.
	 * @param documentVisible - Whether the interruption document is visible.
	 * @param configuration - Current validated local configuration.
	 * @return Promise resolved after any focus ownership transition is projected.
	 * @since 0.1.0 Initial implementation.
	 */
	async function synchronizeParticipantFocus(
		context: ProtectionRuntimeParticipantContext,
		documentVisible: boolean,
		configuration: Parameters<InterruptionRequestHandler[ 'synchronizeParticipantFocus' ]>[ 2 ],
	): Promise<void> {
		await synchronizeParticipantFocusAndReport( context, documentVisible, configuration );
	}

	/**
	 * Dispatches one displayed-progress checkpoint for the current Waiting owner.
	 * @param context - Current Waiting participant context.
	 * @param displayedFocusedDurationMilliseconds - Locally displayed total focused progress.
	 * @param statisticsEligible - Whether the current sender is explicitly outside private browsing.
	 * @param configuration - Current validated local configuration.
	 * @return Projected coordinator result, or null when no checkpoint was dispatched.
	 * @since 0.1.0 Initial implementation.
	 */
	async function checkpointWaitingParticipant(
		context: ProtectionRuntimeParticipantContext,
		displayedFocusedDurationMilliseconds: number,
		statisticsEligible: boolean,
		configuration: Parameters<InterruptionRequestHandler[ 'synchronizeParticipantFocus' ]>[ 2 ],
	): Promise<ProtectionCoordinatorDispatchResult | null> {
		if (
			context.state.type !== ProtectionStateType.WAITING ||
			context.state.ownerParticipantId !== context.participant.participantId
		) {
			return null;
		}

		const waitingState = context.state;
		const unconfirmedDurationMilliseconds = Math.max(
			0,
			displayedFocusedDurationMilliseconds - waitingState.confirmedFocusedDurationMilliseconds,
		);
		const cumulativeCheckpointMilliseconds = waitingState.checkpointHighWaterMilliseconds +
			unconfirmedDurationMilliseconds;
		const matchingDestination = await readMatchingDestination( context );
		const nowEpochMilliseconds = options.now();
		const timeZone = options.getTimeZone();
		const allowanceId = AllowanceIdSchema.parse( `allowance_${ options.createStableId() }` );
		const automaticCompletionObservation = createFreshRuntimeObservation(
			context.participant,
			configuration,
			nowEpochMilliseconds,
			timeZone,
			matchingDestination,
		);
		const measurementRevision = Object.hasOwn(
			configuration.measurementRevisionsByScope,
			waitingState.scopeId,
		)
			? configuration.measurementRevisionsByScope[ waitingState.scopeId ]
			: undefined;
		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.PROGRESS_CHECKPOINT,
			scopeId: waitingState.scopeId,
			waitId: waitingState.waitId,
			ownerParticipantId: context.participant.participantId,
			ownerEpoch: waitingState.ownerEpoch,
			cumulativeCheckpointMilliseconds,
			observedAtEpochMilliseconds: nowEpochMilliseconds,
			completionLocalDate: createRuntimeLocalDate( nowEpochMilliseconds, timeZone ),
			allowanceId,
			timingConfiguration: configuration.timingConfiguration,
			statisticsEligible,
			automaticCompletionObservation,
		} ), measurementRevision );

		if ( configuration.timingConfiguration.completionAction === CompletionAction.OPEN_AUTOMATICALLY ) {
			await options.applyDispatchResult(
				result,
				configuration,
				createContinuationContext( context, allowanceId, automaticCompletionObservation ),
			);
		} else {
			await options.applyDispatchResult( result, configuration );
		}

		return result;
	}

	/**
	 * Applies a Ready participant's explicit Continue intent.
	 * @param context - Current Ready participant context.
	 * @param configuration - Current validated local configuration.
	 * @return Projected coordinator result, or null when continuation was not dispatched.
	 * @since 0.1.0 Initial implementation.
	 */
	async function continueReadyParticipant(
		context: ProtectionRuntimeParticipantContext,
		configuration: Parameters<InterruptionRequestHandler[ 'synchronizeParticipantFocus' ]>[ 2 ],
	): Promise<ProtectionCoordinatorDispatchResult | null> {
		if (
			context.state.type !== ProtectionStateType.ALLOWANCE &&
			context.state.type !== ProtectionStateType.READY
		) {
			return null;
		}

		const allowanceState = context.state;
		const matchingDestination = await readMatchingDestination( context );
		const nowEpochMilliseconds = options.now();
		const observation = createFreshRuntimeObservation(
			context.participant,
			configuration,
			nowEpochMilliseconds,
			options.getTimeZone(),
			matchingDestination,
		);
		const measurementRevision = Object.hasOwn(
			configuration.measurementRevisionsByScope,
			allowanceState.scopeId,
		)
			? configuration.measurementRevisionsByScope[ allowanceState.scopeId ]
			: undefined;
		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.READY_CONTINUATION,
			scopeId: allowanceState.scopeId,
			allowanceId: allowanceState.allowanceId,
			nowEpochMilliseconds,
			observation,
		} ), measurementRevision );

		const continuedParticipant = createContinuationContext( context, allowanceState.allowanceId, observation );

		await options.applyDispatchResult( result, configuration, continuedParticipant );

		return result;
	}

	/**
	 * Handles one interruption-page request.
	 * @param input - Unknown runtime message payload.
	 * @param senderTabId - Browser-provided sender tab identifier.
	 * @param protectionEligible - Whether the sender is explicitly outside private browsing.
	 * @return Authoritative interruption-page projection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function handle(
		input: unknown,
		senderTabId: number | null,
		protectionEligible = false,
	): Promise<InterruptionPageResponse> {
		const request = InterruptionPageRequestSchema.safeParse( input );

		if ( ! request.success || senderTabId === null ) {
			return InterruptionPageResponseSchema.parse( { state: InterruptionPageResponseState.UNAVAILABLE } );
		}

		if ( ! protectionEligible ) {
			await Promise.all( [
				options.departTab(
					senderTabId,
					DepartureCause.BROWSER_ERROR_OR_RECOVERY,
					null,
				),
				options.releaseInterruptionPresentation( senderTabId ),
			] );

			return InterruptionPageResponseSchema.parse( {
				state: InterruptionPageResponseState.UNAVAILABLE,
			} );
		}

		const configuration = await options.loadConfiguration();

		if ( configuration === null ) {
			await options.reconcileUnavailableConfiguration();
			return InterruptionPageResponseSchema.parse( { state: InterruptionPageResponseState.UNAVAILABLE } );
		}

		await options.reconcileExpiredAllowances( configuration );
		let statesByScope = await options.coordinator.getStates();
		let context = statesByScope === null ? null : findRuntimeParticipantContext( statesByScope, senderTabId );
		let browserProjectionApplied = false;
		let participantReleased = false;

		if ( context === null ) {
			const response = await createPageResponse( senderTabId );

			if (
				(
					request.data.type === InterruptionPageRequestType.RECOVER ||
					request.data.type === InterruptionPageRequestType.SYNCHRONIZE
				) &&
				response.state === InterruptionPageResponseState.UNAVAILABLE
			) {
				await options.releaseInterruptionPresentation( senderTabId );
			}

			return response;
		}

		if ( request.data.type === InterruptionPageRequestType.CHECKPOINT ) {
			const checkpointResult = await checkpointWaitingParticipant(
				context,
				request.data.displayedFocusedDurationMilliseconds,
				true,
				configuration,
			);
			browserProjectionApplied = checkpointResult !== null;
			participantReleased = hasParticipantReleaseDecision( checkpointResult, context );
			statesByScope = await options.coordinator.getStates();
			context = statesByScope === null ? null : findRuntimeParticipantContext( statesByScope, senderTabId );
		}

		if ( context !== null ) {
			const focusProjectionApplied = await synchronizeParticipantFocusAndReport(
				context,
				request.data.documentVisible,
				configuration,
			);

			browserProjectionApplied = focusProjectionApplied || browserProjectionApplied;
		}

		if ( request.data.type === InterruptionPageRequestType.CONTINUE ) {
			statesByScope = await options.coordinator.getStates();
			context = statesByScope === null ? null : findRuntimeParticipantContext( statesByScope, senderTabId );

			if ( context !== null ) {
				const continuationResult = await continueReadyParticipant( context, configuration );

				browserProjectionApplied = continuationResult !== null || browserProjectionApplied;
				participantReleased = hasParticipantReleaseDecision( continuationResult, context );
			}
		}

		if ( ! browserProjectionApplied ) {
			await options.refreshToolbarBadge( configuration, await options.coordinator.getStates() );
		}

		return participantReleased
			? InterruptionPageResponseSchema.parse( { state: InterruptionPageResponseState.RELEASED } )
			: createPageResponse( senderTabId );
	}

	return { handle, synchronizeParticipantFocus };
}

export * from './types';
