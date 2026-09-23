import { DepartureCause, ProtectionEventType } from '../../../../domains/protection/types/protection-event';
import { ProtectionParticipantOrigin } from '../../../../domains/protection/types/protection-participant';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ParticipantIdSchema, WaitIdSchema } from '../../../../domains/protection/types/protection-value';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import type { CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { isInterruptionDocumentUrl } from '../../../../shared/utils/interruption-document-url';
import { readInterruptionNavigationDestination } from '../../../../shared/utils/interruption-navigation-destination';
import { createRuntimeLocalDate } from '../../utils/runtime-local-date';
import {
	createRuntimePageId,
	findRuntimeParticipantContext,
} from '../../utils/runtime-page-context';
import type {
	ProtectionNavigationHandler,
	ProtectionNavigationHandlerOptions,
} from './types';
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';

/**
 * Browser transition qualifiers understood by reconsidered-visit classification.
 * @since 1.0.0 Initial implementation.
 */
const RECOGNIZED_TRANSITION_QUALIFIERS = new Set( [
	'client_redirect',
	'server_redirect',
	'forward_back',
	'from_address_bar',
] );

/**
 * Browser transition types that cannot establish a user navigation away safely.
 * @since 1.0.0 Initial implementation.
 */
const NONQUALIFYING_TRANSITION_TYPES = new Set( [
	'auto_subframe',
	'manual_subframe',
	'reload',
	'start_page',
] );

/**
 * Browser transition types that establish a user navigation away after exclusions.
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
 */
export function createProtectionNavigationHandler(
	options: ProtectionNavigationHandlerOptions,
): ProtectionNavigationHandler {
	/**
	 * Pending top-level destinations awaiting a committed or failed browser outcome.
	 * @since 1.0.0 Initial implementation.
	 */
	const pendingDestinationsByTabId = new Map<number, string>();

	/**
	 * Reports whether a live tab may enter browser protection.
	 * @param tabId - Browser tab whose privacy context must be observed.
	 * @return True only for an explicitly ordinary tab observation.
	 * @since 1.0.0 Initial implementation.
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
	 * @param siteHost - Matched protected rule host used for site-specific attribution.
	 * @return Promise resolved after the visit transaction and browser effects.
	 * @since 1.0.0 Initial implementation.
	 */
	async function dispatchVisitAttempt(
		tabId: number,
		destination: string,
		configuration: Parameters<ProtectionNavigationHandlerOptions[ 'reconcileSchedules' ]>[ 0 ],
		scopeId: string,
		siteHost: CanonicalHost,
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
				siteHost,
				focusEligible: focusedTabId === tabId,
				statisticsEligible: true,
			},
			schedule: options.evaluateSiteSchedule(
				configuration,
				siteHost,
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
	 * Reconciles one observed top-level browser navigation before releasing its redirect document.
	 * @param navigation - Browser navigation details.
	 * @param redirectDestination - Validated destination carried by a committed redirect, when present.
	 * @return Safe next document for a redirect, or undefined when no transition was authorized.
	 * @since 1.0.0 Initial implementation.
	 */
	async function reconcileNavigation(
		navigation: Parameters<ProtectionNavigationHandler[ 'handle' ]>[ 0 ],
		redirectDestination: string | null,
	): Promise<string | undefined> {
		const isOutcome =
			navigation.phase === ProtectionRuntimeNavigationPhase.COMMITTED ||
			navigation.phase === ProtectionRuntimeNavigationPhase.ERROR_OCCURRED;
		const pendingDestination = isOutcome
			? pendingDestinationsByTabId.get( navigation.tabId )
			: undefined;
		const isInterruptionNavigation = isInterruptionDocumentUrl( navigation.url, options.interruptionPageUrl );
		const resolvesPendingInterruption =
			pendingDestination !== undefined &&
			isInterruptionNavigation;

		if (
			navigation.frameId !== 0 ||
			navigation.tabId < 0 ||
			( isInterruptionNavigation && ! resolvesPendingInterruption )
		) {
			return;
		}

		const destination = redirectDestination ?? ( resolvesPendingInterruption
			? pendingDestination
			: navigation.url );

		if ( navigation.phase === ProtectionRuntimeNavigationPhase.ERROR_OCCURRED ) {
			const states = await options.coordinator.getStates();
			const context = states === null ? null : findRuntimeParticipantContext( states, navigation.tabId );
			const ownedDestination = pendingDestination ?? context?.participant.retainedDestination;

			// Canceling a still-loading document can report its error after the next navigation starts.
			// Only that navigation's error may clear its pending destination or remove its participant.
			if ( ownedDestination !== undefined && destination !== ownedDestination ) {
				return;
			}
		}

		if ( ! await isTabProtectionEligible( navigation.tabId ) ) {
			pendingDestinationsByTabId.delete( navigation.tabId );
			await Promise.all( [
				options.departTab(
					navigation.tabId,
					DepartureCause.BROWSER_ERROR_OR_RECOVERY,
					null,
				),
				options.releaseNavigationIfInterrupted( navigation.tabId, destination ),
			] );
			return destination;
		}

		const configuration = await options.loadConfiguration();

		if ( configuration === null ) {
			pendingDestinationsByTabId.delete( navigation.tabId );
			await options.reconcileUnavailableConfiguration();
			return destination;
		}

		const match = matchProtectedUrl( destination, configuration.sites.map( ( site ) => site.rule ) );

		if (
			navigation.phase === ProtectionRuntimeNavigationPhase.COMMITTED &&
			redirectDestination === null &&
			! resolvesPendingInterruption &&
			match.status !== ProtectedUrlMatchStatus.PROTECTED
		) {
			const tabs = await options.browser.listTabs();
			const tab = tabs.find( ( candidate ) => candidate.id === navigation.tabId );
			const observedUrl = tab?.pendingUrl ?? tab?.url;

			if ( observedUrl !== undefined && observedUrl !== navigation.url ) {
				return;
			}
		}

		if ( isOutcome ) {
			pendingDestinationsByTabId.delete( navigation.tabId );
		}

		await options.reconcileSchedules( configuration );
		await options.reconcileExpiredAllowances( configuration );

		let statesByScope = await options.coordinator.getStates();
		let existingContext = statesByScope === null
			? null
			: findRuntimeParticipantContext( statesByScope, navigation.tabId );
		const isSameScopeExpiryParticipant =
			existingContext?.participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY &&
			match.status === ProtectedUrlMatchStatus.PROTECTED &&
			existingContext.state.scopeId === match.rule.scopeId;

		if ( isSameScopeExpiryParticipant ) {
			await options.reconcileBrowserState( configuration );
			return options.interruptionPageUrl;
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
			// A committed allowed page already arrived; a later interruption may belong to a newer visit.
			if ( navigation.phase !== ProtectionRuntimeNavigationPhase.COMMITTED || resolvesPendingInterruption ) {
				await options.releaseNavigationIfInterrupted( navigation.tabId, destination );
			}
			return destination;
		}

		const schedule = options.evaluateSiteSchedule(
			configuration,
			match.rule.host,
			options.now(),
			options.getTimeZone(),
		);
		const matchedState = statesByScope?.[ match.rule.scopeId ];

		if ( schedule.status !== ScheduleEvaluationStatus.ACTIVE ) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, destination );
			return destination;
		}

		if (
			matchedState?.type === ProtectionStateType.ALLOWANCE &&
			options.now() < matchedState.expiresAtEpochMilliseconds
		) {
			await options.reconcileBrowserState( configuration );
			await options.releaseNavigationIfInterrupted( navigation.tabId, destination );
			return destination;
		}

		if ( existingContext?.participant.retainedDestination === destination ) {
			await options.reconcileBrowserState( configuration );
			return options.interruptionPageUrl;
		}

		await dispatchVisitAttempt( navigation.tabId, destination, configuration, match.rule.scopeId, match.rule.host );

		if ( redirectDestination !== null ) {
			const states = await options.coordinator.getStates();
			const context = states === null ? null : findRuntimeParticipantContext( states, navigation.tabId );

			if ( context?.participant.retainedDestination === destination ) {
				return options.interruptionPageUrl;
			}
		}
	}

	/**
	 * Checks that a redirect still owns the ordinary top-level tab before acting on its payload.
	 * @param tabId - Browser-assigned tab identifier.
	 * @param redirectUrl - Exact committed redirect document including its destination.
	 * @return Whether the same redirect document remains current.
	 * @since 1.0.0 Initial implementation.
	 */
	async function ownsRedirect( tabId: number, redirectUrl: string ): Promise<boolean> {
		const tabs = await options.browser.listTabs();
		const tab = tabs.find( ( candidate ) => candidate.id === tabId );

		return tab?.incognito === false && ( tab.pendingUrl ?? tab.url ) === redirectUrl;
	}

	/**
	 * Resolves a network redirect only after policy and persistence succeed.
	 * @param navigation - Browser-provided navigation observation.
	 * @return Verified URL for the document to replace itself with, avoiding an extra history entry.
	 * @since 1.0.0 Initial implementation.
	 */
	async function handle(
		navigation: Parameters<ProtectionNavigationHandler[ 'handle' ]>[ 0 ],
	): Promise<string | undefined> {
		const redirectDestination = readInterruptionNavigationDestination(
			navigation.url, options.interruptionPageUrl,
		);

		if ( redirectDestination === null ) {
			await reconcileNavigation( navigation, null );
			return;
		}

		if (
			navigation.frameId !== 0 || navigation.tabId < 0 ||
			navigation.phase !== ProtectionRuntimeNavigationPhase.COMMITTED ||
			! await ownsRedirect( navigation.tabId, navigation.url )
		) {
			return;
		}

		const nextUrl = await reconcileNavigation( navigation, redirectDestination );

		if ( nextUrl !== undefined && await ownsRedirect( navigation.tabId, navigation.url ) ) {
			return nextUrl;
		}
	}

	return { handle };
}

export * from './types';
