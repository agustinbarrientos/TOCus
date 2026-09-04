import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { DepartureCause, ProtectionEventType } from '../../../../domains/protection/types/protection-event';
import { ProtectionParticipantOrigin } from '../../../../domains/protection/types/protection-participant';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import {
	createRuntimeStateTarget,
	findRuntimeParticipantContext,
	getRuntimeTabId,
	type ProtectionRuntimeParticipantContext,
} from '../../utils/runtime-page-context';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import {
	type ProtectionParticipantReconciler,
	type ProtectionParticipantReconcilerOptions,
} from './types';

/**
 * Returns every Waiting and Ready participant with its current scope state.
 * @param statesByScope - Current authoritative protection states.
 * @return Current participant contexts in stable scope and participant order.
 * @since 0.1.0 Initial implementation.
 */
function getParticipantContexts(
	statesByScope: ProtectionCoordinatorStateSnapshot,
): ProtectionRuntimeParticipantContext[] {
	return Object.values( statesByScope ).flatMap( ( state ) => {
		if ( state.type === ProtectionStateType.IDLE ) {
			return [];
		}

		const participants = state.type === ProtectionStateType.WAITING
			? state.participants
			: state.readyParticipants;

		return participants.map( ( participant ) => ( { participant, state } ) );
	} );
}

/**
 * Returns the URL currently represented by one browser tab.
 * @param tab - Current browser tab observation.
 * @return Pending or committed URL, or undefined when host access hides both.
 * @since 0.1.0 Initial implementation.
 */
function getObservedTabUrl( tab: ProtectionRuntimeTab ): string | undefined {
	return tab.pendingUrl ?? tab.url;
}

/**
 * Reports whether one URL remains protected by the participant's current scope.
 * @param url - Browser or retained destination to match.
 * @param context - Current participant and scope state.
 * @param configuration - Current validated protection configuration.
 * @return Whether the URL remains protected by the same scope.
 * @since 0.1.0 Initial implementation.
 */
function matchesParticipantScope(
	url: string,
	context: ProtectionRuntimeParticipantContext,
	configuration: Parameters<ProtectionParticipantReconciler[ 'reconcile' ]>[ 0 ],
): boolean {
	const match = matchProtectedUrl( url, configuration.sites.map( ( site ) => site.rule ) );

	return match.status === ProtectedUrlMatchStatus.PROTECTED &&
		match.rule.scopeId === context.state.scopeId;
}

/**
 * Reports whether one participant still belongs to its configured protection scope.
 * @param context - Current participant and scope state.
 * @param configuration - Current validated protection configuration.
 * @return Whether the participant remains owned by its original scope.
 * @since 0.1.0 Initial implementation.
 */
function participantRemainsConfigured(
	context: ProtectionRuntimeParticipantContext,
	configuration: Parameters<ProtectionParticipantReconciler[ 'reconcile' ]>[ 0 ],
): boolean {
	return context.participant.origin === ProtectionParticipantOrigin.NAVIGATION
		? matchesParticipantScope( context.participant.retainedDestination, context, configuration )
		: configuration.sites.some( ( site ) => site.rule.scopeId === context.state.scopeId );
}

/**
 * Classifies whether one persisted participant no longer owns its browser presentation.
 * @param context - Current participant and scope state.
 * @param tab - Current browser tab or undefined when the tab no longer exists.
 * @param configuration - Current validated protection configuration.
 * @param interruptionPageUrl - Extension-owned interruption page URL.
 * @return Observable departure cause, or null while participant ownership remains current.
 * @since 0.1.0 Initial implementation.
 */
function getParticipantInvalidationCause(
	context: ProtectionRuntimeParticipantContext,
	tab: ProtectionRuntimeTab | undefined,
	configuration: Parameters<ProtectionParticipantReconciler[ 'reconcile' ]>[ 0 ],
	interruptionPageUrl: string,
): DepartureCause | null {
	if ( ! participantRemainsConfigured( context, configuration ) ) {
		return DepartureCause.CONFIGURATION_CHANGE;
	}

	if ( tab === undefined ) {
		return DepartureCause.BROWSER_ERROR_OR_RECOVERY;
	}

	if ( tab.incognito !== false ) {
		return DepartureCause.BROWSER_ERROR_OR_RECOVERY;
	}

	const observedUrl = getObservedTabUrl( tab );

	if ( context.participant.origin === ProtectionParticipantOrigin.NAVIGATION ) {
		return observedUrl === interruptionPageUrl
			? null
			: DepartureCause.BROWSER_ERROR_OR_RECOVERY;
	}

	return observedUrl === interruptionPageUrl ||
		( observedUrl !== undefined && matchesParticipantScope( observedUrl, context, configuration ) )
		? null
		: DepartureCause.BROWSER_ERROR_OR_RECOVERY;
}

/**
 * Creates browser-backed participant reconciliation around the state coordinator.
 * @param options - Browser, state, projection, and clock dependencies.
 * @return Participant reconciliation operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionParticipantReconciler(
	options: ProtectionParticipantReconcilerOptions,
): ProtectionParticipantReconciler {
	/**
	 * Removes one exact participant from its current transaction.
	 * @param context - Persisted participant and transaction identity.
	 * @param cause - Observable departure cause.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after persisted departure and browser projection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function departParticipant(
		context: ProtectionRuntimeParticipantContext,
		cause: DepartureCause,
		configuration: Parameters<ProtectionParticipantReconciler[ 'departAll' ]>[ 1 ],
	): Promise<void> {
		if ( context.participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY ) {
			await options.releaseInjectedInterruption( context.participant );
		}

		const measurementRevision = configuration !== null && Object.hasOwn(
			configuration.measurementRevisionsByScope,
			context.state.scopeId,
		)
			? configuration.measurementRevisionsByScope[ context.state.scopeId ]
			: undefined;
		const result = await options.coordinator.dispatch( () => ( {
			type: ProtectionEventType.PARTICIPANT_DEPARTURE,
			scopeId: context.state.scopeId,
			target: createRuntimeStateTarget( context.state ),
			participantId: context.participant.participantId,
			pageId: context.participant.pageId,
			cause,
			observedAtEpochMilliseconds: options.now(),
		} ), measurementRevision );

		await options.applyDispatchResult( result, configuration );
	}

	/**
	 * Removes one participant associated with a browser tab.
	 * @param tabId - Browser tab identifier.
	 * @param cause - Observable departure cause.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after matching participant state is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function departTab(
		tabId: Parameters<ProtectionParticipantReconciler[ 'departTab' ]>[ 0 ],
		cause: Parameters<ProtectionParticipantReconciler[ 'departTab' ]>[ 1 ],
		configuration: Parameters<ProtectionParticipantReconciler[ 'departTab' ]>[ 2 ],
	): Promise<void> {
		const statesByScope = await options.coordinator.getStates();
		const context = statesByScope === null ? null : findRuntimeParticipantContext( statesByScope, tabId );

		if ( context !== null ) {
			const observedCause = configuration !== null && ! participantRemainsConfigured(
				context,
				configuration,
			)
				? DepartureCause.CONFIGURATION_CHANGE
				: cause;

			await departParticipant( context, observedCause, configuration );
		}
	}

	/**
	 * Removes every retained participant after runtime protection becomes unavailable.
	 * @param cause - Observable departure cause shared by the invalidated participants.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Promise resolved after every retained participant is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function departAll(
		cause: Parameters<ProtectionParticipantReconciler[ 'departAll' ]>[ 0 ],
		configuration: Parameters<ProtectionParticipantReconciler[ 'departAll' ]>[ 1 ],
	): Promise<void> {
		const statesByScope = await options.coordinator.getStates();

		if ( statesByScope === null ) {
			return;
		}

		for ( const context of getParticipantContexts( statesByScope ) ) {
			await departParticipant( context, cause, configuration );
		}
	}

	/**
	 * Removes participants whose tab or configured protection ownership is no longer current.
	 * @param configuration - Current validated local configuration.
	 * @return Promise resolved after stale participants and interruption pages are released.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcile(
		configuration: Parameters<ProtectionParticipantReconciler[ 'reconcile' ]>[ 0 ],
	): Promise<void> {
		const statesByScope = await options.coordinator.getStates();

		if ( statesByScope === null ) {
			return;
		}

		const tabs = await options.browser.listTabs();
		for ( const context of getParticipantContexts( statesByScope ) ) {
			const tabId = getRuntimeTabId( context.participant.pageId );

			if ( tabId === null ) {
				continue;
			}

			const cause = getParticipantInvalidationCause(
				context,
				tabs.find( ( tab ) => tab.id === tabId ),
				configuration,
				options.interruptionPageUrl,
			);

			if ( cause === null ) {
				continue;
			}

			await departParticipant( context, cause, configuration );
			await options.releaseNavigationIfInterrupted(
				tabId,
				context.participant.retainedDestination,
			);
		}
	}

	return { departTab, departAll, reconcile };
}

export * from './types';
