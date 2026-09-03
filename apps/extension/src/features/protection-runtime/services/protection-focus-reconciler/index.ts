import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import {
	findRuntimeParticipantContext,
	getRuntimeTabId,
	type ProtectionRuntimeParticipantContext,
} from '../../utils/runtime-page-context';
import {
	type ProtectionFocusReconciler,
	type ProtectionFocusReconcilerOptions,
} from './types';

/**
 * Reports whether a Waiting participant still owns a page that can receive interruption focus.
 * @param context - Current Waiting participant and scope state.
 * @param tab - Fresh live-tab observation, or undefined when its tab no longer exists.
 * @param configuration - Current validated protection configuration.
 * @param interruptionPageUrl - Extension-owned interruption page URL.
 * @return Whether the participant has a visible interruption or protected allowance-expiry page.
 * @since 0.1.0 Initial implementation.
 */
function isParticipantPresentationAvailable(
	context: ProtectionRuntimeParticipantContext,
	tab: ProtectionRuntimeTab | undefined,
	configuration: Parameters<ProtectionFocusReconcilerOptions[ 'reconcileParticipants' ]>[ 0 ],
	interruptionPageUrl: string,
): boolean {
	const observedUrl = tab?.pendingUrl ?? tab?.url;

	if ( observedUrl === interruptionPageUrl ) {
		return true;
	}

	if ( observedUrl === undefined || context.participant.retainedDestination !== null ) {
		return false;
	}

	const match = matchProtectedUrl(
		observedUrl,
		configuration.sites.map( ( site ) => site.rule ),
	);

	return match.status === ProtectedUrlMatchStatus.PROTECTED &&
		match.rule.scopeId === context.state.scopeId;
}

/**
 * Creates one browser-focus reconciler around participant and projection boundaries.
 * @param options - State, browser, configuration, participant, and projection dependencies.
 * @return Browser focus reconciliation operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionFocusReconciler(
	options: ProtectionFocusReconcilerOptions,
): ProtectionFocusReconciler {
	/**
	 * Reconciles current participant presentation, focus, and toolbar state.
	 * @return Promise resolved after focus reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcile(): Promise<void> {
		const configuration = await options.loadConfiguration();

		if ( configuration === null ) {
			await options.reconcileUnavailableConfiguration();
			return;
		}

		await options.reconcileParticipants( configuration );
		await options.reconcileSchedules( configuration );
		await options.reconcileExpiredAllowances( configuration );

		const statesByScope = await options.coordinator.getStates();
		const tabs = await options.browser.listTabs();
		const tabIds = statesByScope === null
			? []
			: Object.values( statesByScope ).flatMap( ( state ) =>
				state.type === ProtectionStateType.WAITING
					? state.participants.map( ( participant ) => getRuntimeTabId( participant.pageId ) )
					: [],
			);

		for ( const tabId of tabIds ) {
			if ( tabId === null ) {
				continue;
			}

			const currentStatesByScope = await options.coordinator.getStates();
			const context = currentStatesByScope === null
				? null
				: findRuntimeParticipantContext( currentStatesByScope, tabId );

			if ( context !== null ) {
				const tab = tabs.find( ( candidate ) => candidate.id === tabId );

				await options.synchronizeParticipantFocus(
					context,
					isParticipantPresentationAvailable(
						context,
						tab,
						configuration,
						options.interruptionPageUrl,
					),
					configuration,
				);
			}
		}

		await options.refreshFocusEffects( configuration, await options.coordinator.getStates() );
	}

	return { reconcile };
}

export * from './types';
