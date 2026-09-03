import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import {
	ProtectionDecisionType,
	type ProtectionDecision,
	type PresentReadyDecision,
	type PresentWaitingDecision,
} from '../../../../domains/protection/types/protection-decision';
import {
	ProtectionParticipantOrigin,
	type AllowanceExpiryProtectionParticipant,
} from '../../../../domains/protection/types/protection-participant';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { ProtectedPageMessageType } from '../../types/protected-page-message';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import { findRuntimeParticipantContext, getRuntimeTabId } from '../../utils/runtime-page-context';
import { type ProtectionPageProjector, type ProtectionPageProjectorOptions } from './types';

/**
 * Creates live-page projection for authoritative protection decisions.
 * @param options - Browser page effects and interruption-page identity.
 * @return Protection page projection operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionPageProjector(
	options: ProtectionPageProjectorOptions,
): ProtectionPageProjector {
	/**
	 * Returns the navigation URL that currently owns a tab, preferring an in-flight destination.
	 * @param tab - Fresh browser tab observation.
	 * @return Pending or committed URL, or undefined when host access hides both.
	 * @since 0.1.0 Initial implementation.
	 */
	function getObservedTabUrl( tab: ProtectionRuntimeTab ): string | undefined {
		return tab.pendingUrl ?? tab.url;
	}

	/**
	 * Reports whether a fresh tab observation still displays the interruption page.
	 * @param tab - Fresh browser tab observation.
	 * @return Whether the interruption page remains the current navigation source.
	 * @since 0.1.0 Initial implementation.
	 */
	function isInterruptionTab( tab: ProtectionRuntimeTab ): boolean {
		return getObservedTabUrl( tab ) === options.interruptionPageUrl;
	}

	/**
	 * Reports whether a tab still represents the participant targeted by one presentation decision.
	 * @param tab - Fresh browser tab observation.
	 * @param decision - Persisted Waiting or Ready presentation decision.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative protection state.
	 * @return Whether mutating this tab cannot replace an unrelated navigation.
	 * @since 0.1.0 Initial implementation.
	 */
	function matchesParticipantSource(
		tab: ProtectionRuntimeTab,
		decision: PresentWaitingDecision | PresentReadyDecision,
		configuration: Parameters<ProtectionPageProjector[ 'applyDecisions' ]>[ 1 ],
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): boolean {
		if ( statesByScope === null ) {
			return false;
		}

		const context = findRuntimeParticipantContext( statesByScope, tab.id );
		const observedUrl = getObservedTabUrl( tab );
		if (
			context === null ||
			context.participant.participantId !== decision.participantId ||
			context.participant.pageId !== decision.pageId ||
			observedUrl === undefined ||
			configuration === null
		) {
			return false;
		}

		if ( context.participant.retainedDestination === observedUrl ) {
			return true;
		}
		const match = matchProtectedUrl(
			observedUrl,
			configuration.sites.map( ( site ) => site.rule ),
		);

		return match.status === ProtectedUrlMatchStatus.PROTECTED &&
			match.rule.scopeId === context.state.scopeId;
	}

	/**
	 * Reports whether a fresh tab observation still displays any configured protected page.
	 * @param tab - Fresh browser tab observation.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @return Whether the tab displays a locally configured protected URL.
	 * @since 0.1.0 Initial implementation.
	 */
	function matchesProtectedSource(
		tab: ProtectionRuntimeTab,
		configuration: Parameters<ProtectionPageProjector[ 'applyDecisions' ]>[ 1 ],
	): boolean {
		const observedUrl = getObservedTabUrl( tab );

		if ( observedUrl === undefined || configuration === null ) {
			return false;
		}

		return matchProtectedUrl(
			observedUrl,
			configuration.sites.map( ( site ) => site.rule ),
		).status === ProtectedUrlMatchStatus.PROTECTED;
	}

	/**
	 * Applies one tab mutation while treating a concurrently closed or moved tab as a benign race.
	 * @param operation - Browser mutation already started for the observed tab.
	 * @param tabId - Browser tab targeted by the mutation.
	 * @param matchesExpectedSource - Fresh check for the source page that justified the mutation.
	 * @return Promise resolved after success or a stale-tab race, and rejected for a live-source failure.
	 * @since 0.1.0 Initial implementation.
	 */
	async function applyPageEffect(
		operation: Promise<void>,
		tabId: number,
		matchesExpectedSource: ( tab: ProtectionRuntimeTab ) => boolean,
	): Promise<void> {
		try {
			await operation;
		} catch ( error ) {
			const tabs = await options.browser.listTabs();
			const tab = tabs.find( ( candidate ) => candidate.id === tabId );

			if ( tab === undefined || ! matchesExpectedSource( tab ) ) {
				return;
			}

			throw error;
		}
	}

	/**
	 * Applies one persisted page decision against a fresh live-tab observation.
	 * @param decision - Persisted protection decision.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative protection state.
	 * @return Promise resolved after a supported page effect or no operation.
	 * @since 0.1.0 Initial implementation.
	 */
	async function applyPageDecision(
		decision: ProtectionDecision,
		configuration: Parameters<ProtectionPageProjector[ 'applyDecisions' ]>[ 1 ],
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void> {
		switch ( decision.type ) {
			case ProtectionDecisionType.PRESENT_WAITING: {
				const tabs = await options.browser.listTabs();
				const tabId = getRuntimeTabId( decision.pageId );
				const tab = tabs.find( ( candidate ) => candidate.id === tabId );
				const context = tabId === null || statesByScope === null
					? null
					: findRuntimeParticipantContext( statesByScope, tabId );

				if (
					tabId !== null &&
					tab !== undefined &&
					! isInterruptionTab( tab ) &&
					matchesParticipantSource( tab, decision, configuration, statesByScope )
				) {
					const operation = context?.participant.origin === ProtectionParticipantOrigin.ALLOWANCE_EXPIRY
						? options.browser.updateProtectedPagePresentation( tabId, {
							type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
						} )
						: options.browser.navigateTab( tabId, options.interruptionPageUrl );

					await applyPageEffect( operation, tabId, ( currentTab ) =>
						matchesParticipantSource( currentTab, decision, configuration, statesByScope ) );
				}
				break;
			}

			case ProtectionDecisionType.PRESENT_READY: {
				const tabId = getRuntimeTabId( decision.pageId );
				const context = tabId === null || statesByScope === null
					? null
					: findRuntimeParticipantContext( statesByScope, tabId );

				if (
					tabId === null ||
					context?.participant.origin !== ProtectionParticipantOrigin.ALLOWANCE_EXPIRY
				) {
					break;
				}

				const tabs = await options.browser.listTabs();
				const tab = tabs.find( ( candidate ) => candidate.id === tabId );

				if ( tab !== undefined && matchesParticipantSource( tab, decision, configuration, statesByScope ) ) {
					await applyPageEffect(
						options.browser.updateProtectedPagePresentation( tabId, {
							type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
						} ),
						tabId,
						( currentTab ) => matchesParticipantSource(
							currentTab,
							decision,
							configuration,
							statesByScope,
						),
					);
				}
				break;
			}

			case ProtectionDecisionType.RELEASE_NAVIGATION: {
				const tabs = await options.browser.listTabs();
				const tabId = getRuntimeTabId( decision.pageId );
				const tab = tabs.find( ( candidate ) => candidate.id === tabId );

				if ( tabId !== null && tab !== undefined && isInterruptionTab( tab ) ) {
					await applyPageEffect(
						options.browser.navigateTab( tabId, decision.retainedDestination ),
						tabId,
						isInterruptionTab,
					);
				}
				break;
			}

			case ProtectionDecisionType.DISMISS_INTERRUPTION: {
				const tabs = await options.browser.listTabs();
				const tabId = getRuntimeTabId( decision.pageId );
				const tab = tabs.find( ( candidate ) => candidate.id === tabId );

				if ( tabId !== null && tab !== undefined ) {
					if ( isInterruptionTab( tab ) ) {
						await applyPageEffect(
							options.browser.dismissInterruption( tabId ),
							tabId,
							isInterruptionTab,
						);
					} else if ( matchesProtectedSource( tab, configuration ) ) {
						await applyPageEffect(
							options.browser.updateProtectedPagePresentation( tabId, {
								type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
							} ),
							tabId,
							( currentTab ) => matchesProtectedSource( currentTab, configuration ),
						);
					}
				}
				break;
			}
		}
	}

	/**
	 * Releases one observed interruption tab to its destination or browser-native history.
	 * @param tab - Fresh interruption-tab observation.
	 * @param retainedDestination - Validated destination to restore, or null for browser-native dismissal.
	 * @return Promise resolved after release or a verified stale-tab race.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseObservedInterruptionPage(
		tab: ProtectionRuntimeTab,
		retainedDestination: Parameters<ProtectionPageProjector[ 'releaseNavigationIfInterrupted' ]>[ 1 ],
	): Promise<void> {
		if ( retainedDestination === null ) {
			await applyPageEffect( options.browser.dismissInterruption( tab.id ), tab.id, isInterruptionTab );
			return;
		}

		try {
			await applyPageEffect(
				options.browser.navigateTab( tab.id, retainedDestination ),
				tab.id,
				isInterruptionTab,
			);
		} catch {
			await applyPageEffect( options.browser.dismissInterruption( tab.id ), tab.id, isInterruptionTab );
		}
	}

	/**
	 * Releases one tab only while a fresh observation still identifies the interruption page.
	 * @param tabId - Browser tab that may still display the interruption page.
	 * @param retainedDestination - Validated destination to restore, or null for browser-native dismissal.
	 * @return Promise resolved after release or a verified stale-tab race.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseNavigationIfInterrupted(
		tabId: Parameters<ProtectionPageProjector[ 'releaseNavigationIfInterrupted' ]>[ 0 ],
		retainedDestination: Parameters<ProtectionPageProjector[ 'releaseNavigationIfInterrupted' ]>[ 1 ],
	): Promise<void> {
		const tabs = await options.browser.listTabs();
		const tab = tabs.find( ( candidate ) => candidate.id === tabId );

		if ( tab === undefined || ! isInterruptionTab( tab ) ) {
			return;
		}

		await releaseObservedInterruptionPage( tab, retainedDestination );
	}

	/**
	 * Releases one interruption presentation that no longer has authoritative runtime state.
	 * @param tabId - Browser tab containing the orphaned standalone page or injected layer.
	 * @return Promise resolved after release or when the tab is no longer present.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseInterruptionPresentation( tabId: number ): Promise<void> {
		const tabs = await options.browser.listTabs();
		const tab = tabs.find( ( candidate ) => candidate.id === tabId );

		if ( tab === undefined ) {
			return;
		}

		if ( isInterruptionTab( tab ) ) {
			await releaseObservedInterruptionPage( tab, null );
			return;
		}

		await options.browser.updateProtectedPagePresentation( tabId, {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );
	}

	/**
	 * Removes an injected interruption only for one authoritative allowance-expiry participant.
	 * @param participant - Known allowance-expiry participant retaining the injected page identity.
	 * @return Promise resolved after removal or when the owned layer is no longer present.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseInjectedInterruption(
		participant: AllowanceExpiryProtectionParticipant,
	): Promise<void> {
		const tabId = getRuntimeTabId( participant.pageId );

		if ( tabId === null ) {
			return;
		}

		const presentation = await options.browser.getProtectedPagePresentation( tabId );

		if ( presentation?.interruptionLayerPresented !== true ) {
			return;
		}

		await options.browser.updateProtectedPagePresentation( tabId, {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );
	}

	/**
	 * Removes injected interruptions from every live non-interruption tab without injecting listeners.
	 * @return Promise resolved after every best-effort removal command is accepted.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseInjectedInterruptions(): Promise<void> {
		const tabs = await options.browser.listTabs();

		await Promise.all( tabs
			.filter( ( tab ) => ! isInterruptionTab( tab ) )
			.map( ( tab ) => options.browser.updateProtectedPagePresentation( tab.id, {
				type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
			} ) ) );
	}

	/**
	 * Releases every live interruption page after redirect rules have been removed.
	 * @param statesByScope - Current authoritative state snapshot or unavailable marker.
	 * @return Promise resolved after retained destinations and browser-native dismissals complete.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseInterruptionPages(
		statesByScope: Parameters<ProtectionPageProjector[ 'releaseInterruptionPages' ]>[ 0 ],
	): Promise<void> {
		const tabs = await options.browser.listTabs();
		const interruptionTabs = tabs.filter( isInterruptionTab );

		await Promise.all( interruptionTabs.map( ( tab ) => {
			const context = statesByScope === null
				? null
				: findRuntimeParticipantContext( statesByScope, tab.id );

			return releaseObservedInterruptionPage(
				tab,
				context?.participant.retainedDestination ?? null,
			);
		} ) );
	}

	/**
	 * Applies persisted decisions sequentially against fresh browser observations.
	 * @param decisions - Persisted protection decisions.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative state snapshot or unavailable marker.
	 * @return Promise resolved after supported page effects are applied.
	 * @since 0.1.0 Initial implementation.
	 */
	async function applyDecisions(
		decisions: Parameters<ProtectionPageProjector[ 'applyDecisions' ]>[ 0 ],
		configuration: Parameters<ProtectionPageProjector[ 'applyDecisions' ]>[ 1 ],
		statesByScope: Parameters<ProtectionPageProjector[ 'applyDecisions' ]>[ 2 ],
	): Promise<void> {
		for ( const decision of decisions ) {
			await applyPageDecision( decision, configuration, statesByScope );
		}
	}

	return {
		applyDecisions,
		releaseInjectedInterruption,
		releaseInjectedInterruptions,
		releaseInterruptionPresentation,
		releaseInterruptionPages,
		releaseNavigationIfInterrupted,
	};
}

export * from './types';
