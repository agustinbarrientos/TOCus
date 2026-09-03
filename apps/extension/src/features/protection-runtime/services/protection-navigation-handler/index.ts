import { DepartureCause, ProtectionEventType } from '../../../../domains/protection/types/protection-event';
import { ProtectionParticipantOrigin } from '../../../../domains/protection/types/protection-participant';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ParticipantIdSchema, WaitIdSchema } from '../../../../domains/protection/types/protection-value';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { createRuntimeLocalDate } from '../../utils/runtime-local-date';
import {
	createRuntimePageId,
	findRuntimeParticipantContext,
} from '../../utils/runtime-page-context';
import {
	type ProtectionNavigationHandler,
	type ProtectionNavigationHandlerOptions,
} from './types';

/**
 * Creates one browser-navigation handler around runtime orchestration boundaries.
 * @param options - State, browser, configuration, projection, clock, and identity dependencies.
 * @return Browser navigation handling operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionNavigationHandler(
	options: ProtectionNavigationHandlerOptions,
): ProtectionNavigationHandler {
	/**
	 * Creates one protected visit attempt after current configuration and schedule observation.
	 * @param tabId - Navigating browser tab.
	 * @param destination - Exact retained HTTP(S) navigation destination.
	 * @param configuration - Current validated local configuration.
	 * @param scopeId - Matched protection scope.
	 * @return Promise resolved after the visit transaction and browser effects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function dispatchVisitAttempt(
		tabId: number,
		destination: string,
		configuration: Parameters<ProtectionNavigationHandlerOptions[ 'reconcileSchedules' ]>[ 0 ],
		scopeId: string,
	): Promise<void> {
		const focusedTabId = await options.browser.getFocusedTabId();
		const nowEpochMilliseconds = options.now();
		const timeZone = options.getTimeZone();
		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.VISIT_ATTEMPT,
			scopeId,
			participant: {
				origin: ProtectionParticipantOrigin.NAVIGATION,
				participantId: ParticipantIdSchema.parse( `participant_${ options.createStableId() }` ),
				pageId: createRuntimePageId( tabId, options.createStableId() ),
				retainedDestination: destination,
				focusEligible: focusedTabId === tabId,
			},
			schedule: options.evaluateScopeSchedule(
				configuration,
				scopeId,
				nowEpochMilliseconds,
				timeZone,
			),
			observedLocalDate: createRuntimeLocalDate( nowEpochMilliseconds, timeZone ),
			timingConfiguration: configuration.timingConfiguration,
			waitId: WaitIdSchema.parse( `wait_${ options.createStableId() }` ),
			nowEpochMilliseconds,
		} ) );

		await options.applyDispatchResult( result, configuration );
	}

	/**
	 * Handles one observed top-level browser navigation.
	 * @param navigation - Browser navigation details.
	 * @return Promise resolved after navigation reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function handle(
		navigation: Parameters<ProtectionNavigationHandler[ 'handle' ]>[ 0 ],
	): Promise<void> {
		if (
			navigation.frameId !== 0 ||
			navigation.tabId < 0 ||
			navigation.url === options.interruptionPageUrl
		) {
			return;
		}

		const configuration = await options.loadConfiguration();

		if ( configuration === null ) {
			await options.reconcileUnavailableConfiguration();
			return;
		}

		await options.reconcileSchedules( configuration );
		await options.reconcileExpiredAllowances( configuration );

		let statesByScope = await options.coordinator.getStates();
		let existingContext = statesByScope === null
			? null
			: findRuntimeParticipantContext( statesByScope, navigation.tabId );
		const match = matchProtectedUrl( navigation.url, configuration.sites.map( ( site ) => site.rule ) );
		const isSameScopeExpiryParticipant =
			existingContext?.participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY &&
			match.status === ProtectedUrlMatchStatus.PROTECTED &&
			existingContext.state.scopeId === match.rule.scopeId;

		if ( isSameScopeExpiryParticipant ) {
			await options.reconcileBrowserState( configuration );
			return;
		}

		if (
			existingContext !== null &&
			existingContext.participant.retainedDestination !== navigation.url
		) {
			await options.departTab(
				navigation.tabId,
				DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY,
				configuration,
			);
			statesByScope = await options.coordinator.getStates();
			existingContext = statesByScope === null
				? null
				: findRuntimeParticipantContext( statesByScope, navigation.tabId );
		}

		if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, navigation.url );
			return;
		}

		const schedule = options.evaluateScopeSchedule(
			configuration,
			match.rule.scopeId,
			options.now(),
			options.getTimeZone(),
		);
		const matchedState = statesByScope?.[ match.rule.scopeId ];

		if ( schedule.status !== ScheduleEvaluationStatus.ACTIVE ) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, navigation.url );
			return;
		}

		if (
			matchedState?.type === ProtectionStateType.ALLOWANCE &&
			options.now() < matchedState.expiresAtEpochMilliseconds
		) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, navigation.url );
			return;
		}

		if ( existingContext?.participant.retainedDestination === navigation.url ) {
			await options.reconcileBrowserState( configuration );
			return;
		}

		await dispatchVisitAttempt( navigation.tabId, navigation.url, configuration, match.rule.scopeId );
	}

	return { handle };
}

export * from './types';
