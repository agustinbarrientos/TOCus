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
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';

/**
 * Browser transition qualifiers understood by reconsidered-visit classification.
 * @since 0.1.0 Initial implementation.
 */
const RECOGNIZED_TRANSITION_QUALIFIERS = new Set( [
	'client_redirect',
	'server_redirect',
	'forward_back',
	'from_address_bar',
] );

/**
 * Browser transition types that cannot establish a user navigation away safely.
 * @since 0.1.0 Initial implementation.
 */
const NONQUALIFYING_TRANSITION_TYPES = new Set( [
	'auto_subframe',
	'manual_subframe',
	'reload',
	'start_page',
] );

/**
 * Browser transition types that establish a user navigation away after exclusions.
 * @since 0.1.0 Initial implementation.
 */
const QUALIFYING_TRANSITION_TYPES = new Set( [
	'link',
	'typed',
	'auto_bookmark',
	'generated',
	'keyword',
	'keyword_generated',
] );

/**
 * Classifies a completed browser navigation without inferring missing provenance.
 * @param navigation - Top-level browser navigation observation.
 * @return Observable departure cause.
 * @since 0.1.0 Initial implementation.
 */
function classifyNavigationDeparture(
	navigation: Parameters<ProtectionNavigationHandler[ 'handle' ]>[ 0 ],
): DepartureCause {
	if (
		navigation.phase === ProtectionRuntimeNavigationPhase.HISTORY_STATE_UPDATED ||
		navigation.phase === ProtectionRuntimeNavigationPhase.REFERENCE_FRAGMENT_UPDATED
	) {
		return DepartureCause.PROGRAMMATIC_NAVIGATION;
	}

	if ( navigation.phase !== ProtectionRuntimeNavigationPhase.COMMITTED ) {
		return DepartureCause.UNKNOWN;
	}

	const qualifiers = navigation.transitionQualifiers;

	if ( qualifiers === undefined ) {
		return DepartureCause.UNKNOWN;
	}

	if ( qualifiers.includes( 'client_redirect' ) || qualifiers.includes( 'server_redirect' ) ) {
		return DepartureCause.REDIRECT;
	}

	if ( qualifiers.some( ( qualifier ) => ! RECOGNIZED_TRANSITION_QUALIFIERS.has( qualifier ) ) ) {
		return DepartureCause.UNKNOWN;
	}

	if ( qualifiers.includes( 'forward_back' ) ) {
		return DepartureCause.BACK;
	}

	if ( navigation.transitionType === 'form_submit' ) {
		return DepartureCause.AUTHENTICATION_HANDOFF;
	}

	if (
		navigation.transitionType !== undefined &&
		NONQUALIFYING_TRANSITION_TYPES.has( navigation.transitionType )
	) {
		return DepartureCause.PROGRAMMATIC_NAVIGATION;
	}

	if (
		navigation.transitionType !== undefined &&
		QUALIFYING_TRANSITION_TYPES.has( navigation.transitionType )
	) {
		return DepartureCause.NON_EXTENSION_TOP_LEVEL_NAVIGATION_AWAY;
	}

	return DepartureCause.UNKNOWN;
}

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
	 * Pending top-level destinations awaiting a committed or failed browser outcome.
	 * @since 0.1.0 Initial implementation.
	 */
	const pendingDestinationsByTabId = new Map<number, string>();

	/**
	 * Reports whether a live tab may enter browser protection.
	 * @param tabId - Browser tab whose privacy context must be observed.
	 * @return True only for an explicitly ordinary tab observation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function isTabProtectionEligible( tabId: number ): Promise<boolean> {
		try {
			const tabs = await options.browser.listTabs();

			return tabs.find( ( tab ) => tab.id === tabId )?.incognito === false;
		} catch {
			return false;
		}
	}

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
				statisticsEligible: true,
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
		const isOutcome =
			navigation.phase === ProtectionRuntimeNavigationPhase.COMMITTED ||
			navigation.phase === ProtectionRuntimeNavigationPhase.ERROR_OCCURRED;
		const pendingDestination = isOutcome
			? pendingDestinationsByTabId.get( navigation.tabId )
			: undefined;
		const resolvesPendingInterruption =
			pendingDestination !== undefined &&
			navigation.url === options.interruptionPageUrl;

		if (
			navigation.frameId !== 0 ||
			navigation.tabId < 0 ||
			( navigation.url === options.interruptionPageUrl && ! resolvesPendingInterruption )
		) {
			return;
		}

		if ( isOutcome ) {
			pendingDestinationsByTabId.delete( navigation.tabId );
		}

		const destination = resolvesPendingInterruption
			? pendingDestination
			: navigation.url;

		if ( ! await isTabProtectionEligible( navigation.tabId ) ) {
			await Promise.all( [
				options.departTab(
					navigation.tabId,
					DepartureCause.BROWSER_ERROR_OR_RECOVERY,
					null,
				),
				options.releaseNavigationIfInterrupted( navigation.tabId, destination ),
			] );
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
		const match = matchProtectedUrl( destination, configuration.sites.map( ( site ) => site.rule ) );
		const isSameScopeExpiryParticipant =
			existingContext?.participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY &&
			match.status === ProtectedUrlMatchStatus.PROTECTED &&
			existingContext.state.scopeId === match.rule.scopeId;

		if ( isSameScopeExpiryParticipant ) {
			await options.reconcileBrowserState( configuration );
			return;
		}

		if ( navigation.phase === ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE ) {
			pendingDestinationsByTabId.delete( navigation.tabId );

			if (
				existingContext !== null &&
				existingContext.participant.retainedDestination !== destination
			) {
				pendingDestinationsByTabId.set( navigation.tabId, destination );
				await options.reconcileBrowserState( configuration );
				return;
			}

			if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
				await options.reconcileBrowserState( configuration );
				return;
			}
		}

		if ( navigation.phase === ProtectionRuntimeNavigationPhase.ERROR_OCCURRED ) {
			if ( existingContext !== null ) {
				await options.departTab(
					navigation.tabId,
					DepartureCause.BROWSER_ERROR_OR_RECOVERY,
					configuration,
				);
			}

			await options.reconcileBrowserState( configuration );
			return;
		}

		if (
			existingContext !== null &&
			existingContext.participant.retainedDestination !== destination
		) {
			const departureCause = classifyNavigationDeparture( navigation );

			await options.departTab(
				navigation.tabId,
				departureCause,
				configuration,
			);
			statesByScope = await options.coordinator.getStates();
			existingContext = statesByScope === null
				? null
				: findRuntimeParticipantContext( statesByScope, navigation.tabId );
		}

		if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, destination );
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
			await options.releaseNavigationIfInterrupted( navigation.tabId, destination );
			return;
		}

		if (
			matchedState?.type === ProtectionStateType.ALLOWANCE &&
			options.now() < matchedState.expiresAtEpochMilliseconds
		) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, destination );
			return;
		}

		if ( existingContext?.participant.retainedDestination === destination ) {
			await options.reconcileBrowserState( configuration );
			return;
		}

		await dispatchVisitAttempt( navigation.tabId, destination, configuration, match.rule.scopeId );
	}

	return { handle };
}

export * from './types';
