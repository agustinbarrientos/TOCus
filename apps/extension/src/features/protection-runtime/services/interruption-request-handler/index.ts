import { ProtectionEventType } from '../../../../domains/protection/types/protection-event';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { AllowanceIdSchema } from '../../../../domains/protection/types/protection-value';
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
import {
	type InterruptionRequestHandler,
	type InterruptionRequestHandlerOptions,
} from './types';

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
	 * @param configuration - Current validated local configuration.
	 * @return Whether a browser projection was applied after progress reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function checkpointWaitingParticipant(
		context: ProtectionRuntimeParticipantContext,
		displayedFocusedDurationMilliseconds: number,
		configuration: Parameters<InterruptionRequestHandler[ 'synchronizeParticipantFocus' ]>[ 2 ],
	): Promise<boolean> {
		if (
			context.state.type !== ProtectionStateType.WAITING ||
			context.state.ownerParticipantId !== context.participant.participantId
		) {
			return false;
		}

		const waitingState = context.state;
		const unconfirmedDurationMilliseconds = Math.max(
			0,
			displayedFocusedDurationMilliseconds - waitingState.confirmedFocusedDurationMilliseconds,
		);
		const cumulativeCheckpointMilliseconds = waitingState.checkpointHighWaterMilliseconds +
			unconfirmedDurationMilliseconds;
		const nowEpochMilliseconds = options.now();
		const timeZone = options.getTimeZone();
		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.PROGRESS_CHECKPOINT,
			scopeId: waitingState.scopeId,
			waitId: waitingState.waitId,
			ownerParticipantId: context.participant.participantId,
			ownerEpoch: waitingState.ownerEpoch,
			cumulativeCheckpointMilliseconds,
			observedAtEpochMilliseconds: nowEpochMilliseconds,
			completionLocalDate: createRuntimeLocalDate( nowEpochMilliseconds, timeZone ),
			allowanceId: AllowanceIdSchema.parse( `allowance_${ options.createStableId() }` ),
			timingConfiguration: configuration.timingConfiguration,
			automaticCompletionObservation: createFreshRuntimeObservation(
				context.participant,
				configuration,
				nowEpochMilliseconds,
				timeZone,
			),
		} ) );

		await options.applyDispatchResult( result, configuration );

		return true;
	}

	/**
	 * Applies a Ready participant's explicit Continue intent.
	 * @param context - Current Ready participant context.
	 * @param configuration - Current validated local configuration.
	 * @return Whether a browser projection was applied after continuation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function continueReadyParticipant(
		context: ProtectionRuntimeParticipantContext,
		configuration: Parameters<InterruptionRequestHandler[ 'synchronizeParticipantFocus' ]>[ 2 ],
	): Promise<boolean> {
		if ( context.state.type !== ProtectionStateType.ALLOWANCE ) {
			return false;
		}

		const allowanceState = context.state;
		const nowEpochMilliseconds = options.now();
		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.READY_CONTINUATION,
			scopeId: allowanceState.scopeId,
			allowanceId: allowanceState.allowanceId,
			nowEpochMilliseconds,
			observation: createFreshRuntimeObservation(
				context.participant,
				configuration,
				nowEpochMilliseconds,
				options.getTimeZone(),
			),
		} ) );

		await options.applyDispatchResult( result, configuration );

		return true;
	}

	/**
	 * Handles one interruption-page request.
	 * @param input - Unknown runtime message payload.
	 * @param senderTabId - Browser-provided sender tab identifier.
	 * @return Authoritative interruption-page projection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function handle(
		input: unknown,
		senderTabId: number | null,
	): Promise<InterruptionPageResponse> {
		const request = InterruptionPageRequestSchema.safeParse( input );

		if ( ! request.success || senderTabId === null ) {
			return InterruptionPageResponseSchema.parse( { state: InterruptionPageResponseState.UNAVAILABLE } );
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
			browserProjectionApplied = await checkpointWaitingParticipant(
				context,
				request.data.displayedFocusedDurationMilliseconds,
				configuration,
			);
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
				const continuationProjectionApplied = await continueReadyParticipant( context, configuration );

				browserProjectionApplied = continuationProjectionApplied || browserProjectionApplied;
			}
		}

		if ( ! browserProjectionApplied ) {
			await options.refreshToolbarBadge( configuration, await options.coordinator.getStates() );
		}

		return createPageResponse( senderTabId );
	}

	return { handle, synchronizeParticipantFocus };
}

export * from './types';
