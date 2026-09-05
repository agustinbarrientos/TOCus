import {
	ProtectionCoordinatorDispatchStatus,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { AllowanceWarningDurationMilliseconds } from '../../../../domains/protection/types/allowance-warning';
import { getNextScheduleTransitionDeadline } from '../../../../domains/protection/utils/schedule-evaluator';
import {
	createToolbarBadgeProjection,
	ToolbarBadgePhase,
} from '../../utils/toolbar-badge-projection';
import { type ProtectionClockDeadlines } from '../../types/browser-runtime';
import { createAllowanceWarningReconciler } from '../allowance-warning-reconciler';
import { createNavigationRuleReconciler } from '../navigation-rule-reconciler';
import { createProtectionPageProjector } from '../protection-page-projector';
import { createToolbarBadgeCoordinator } from '../toolbar-badge-coordinator';
import {
	type BrowserProtectionProjector,
	type BrowserProtectionProjectorOptions,
} from './types';

const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Selects the next instant when the rounded visit-window badge changes.
 * @param expiresAtEpochMilliseconds - Exact allowance expiry.
 * @param nowEpochMilliseconds - Current wall-clock time.
 * @return Nearest future badge boundary or expiry.
 * @since 0.1.0 Initial implementation.
 */
function getNextAllowanceBadgeDeadline(
	expiresAtEpochMilliseconds: number,
	nowEpochMilliseconds: number,
): number {
	const remainingMilliseconds = expiresAtEpochMilliseconds - nowEpochMilliseconds;

	if ( remainingMilliseconds <= MILLISECONDS_PER_MINUTE ) {
		return expiresAtEpochMilliseconds;
	}

	const visibleMinutes = Math.ceil( remainingMilliseconds / MILLISECONDS_PER_MINUTE );

	return expiresAtEpochMilliseconds - ( visibleMinutes - 1 ) * MILLISECONDS_PER_MINUTE;
}

/**
 * Selects every distinct future schedule, allowance, warning, and toolbar-change deadline.
 * @param statesByScope - Current protection states or unavailable marker.
 * @param nowEpochMilliseconds - Current wall-clock time.
 * @param scheduleTransitionDeadline - Cached next custom-schedule transition.
 * @return Chronological protection-clock deadlines.
 * @since 0.1.0 Initial implementation.
 */
function getProtectionClockDeadlines(
	statesByScope: ProtectionCoordinatorStateSnapshot | null,
	nowEpochMilliseconds: number,
	scheduleTransitionDeadline: number | null,
): ProtectionClockDeadlines {
	if ( statesByScope === null ) {
		return [];
	}

	const deadlines: number[] = [];

	if ( scheduleTransitionDeadline !== null ) {
		deadlines.push( scheduleTransitionDeadline );
	}

	Object.values( statesByScope ).forEach( ( state ) => {
		if (
			state.type !== ProtectionStateType.ALLOWANCE ||
			state.expiresAtEpochMilliseconds <= nowEpochMilliseconds
		) {
			return;
		}

		const warningStartEpochMilliseconds =
			state.expiresAtEpochMilliseconds - AllowanceWarningDurationMilliseconds;

		deadlines.push(
			state.expiresAtEpochMilliseconds,
			getNextAllowanceBadgeDeadline( state.expiresAtEpochMilliseconds, nowEpochMilliseconds ),
		);

		if ( warningStartEpochMilliseconds > nowEpochMilliseconds ) {
			deadlines.push( warningStartEpochMilliseconds );
		}
	} );

	return Array.from( new Set( deadlines ) ).sort( ( first, second ) => first - second );
}

/**
 * Creates browser-effect projection for authoritative protection state and decisions.
 * @param options - Browser, state, clock, and interruption-page dependencies.
 * @return Browser protection projector operations.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserProtectionProjector(
	options: BrowserProtectionProjectorOptions,
): BrowserProtectionProjector {
	const navigationRuleReconciler = createNavigationRuleReconciler( {
		replaceNavigationRules: options.browser.replaceNavigationRules,
		getTimeZone: options.getTimeZone,
		now: options.now,
	} );
	const toolbarBadgeCoordinator = createToolbarBadgeCoordinator( {
		copy: options.toolbarBadgeCopy,
		getFocusedTabId: options.browser.getFocusedTabId,
		interruptionPageUrl: options.interruptionPageUrl,
		listTabs: options.browser.listTabs,
		now: options.now,
		updateToolbarBadge: options.browser.updateToolbarBadge,
	} );
	const allowanceWarningReconciler = createAllowanceWarningReconciler( {
		browser: options.browser,
		getTimeZone: options.getTimeZone,
		now: options.now,
	} );
	const pageProjector = createProtectionPageProjector( {
		browser: options.browser,
		interruptionPageUrl: options.interruptionPageUrl,
	} );
	let cachedScheduleTransitionKey: string | null = null;
	let cachedScheduleTransitionDeadline: number | null = null;
	let cachedScheduleTransitionOrigin: number | null = null;

	/**
	 * Reuses an exact schedule transition until its inputs change or its deadline is reached.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param nowEpochMilliseconds - Current wall-clock time.
	 * @param timeZone - Current local IANA time-zone identifier.
	 * @return Next custom-schedule transition, or null when none exists safely.
	 * @since 0.1.0 Initial implementation.
	 */
	function getScheduleTransitionDeadline(
		configuration: ProtectionConfigurationDocument | null,
		nowEpochMilliseconds: number,
		timeZone: string,
	): number | null {
		if ( configuration === null ) {
			cachedScheduleTransitionKey = null;
			cachedScheduleTransitionDeadline = null;
			cachedScheduleTransitionOrigin = null;
			return null;
		}

		const cacheKey = JSON.stringify( [ configuration.schedulesByScope, timeZone ] );
		const cacheRemainsCurrent =
			cacheKey === cachedScheduleTransitionKey &&
			cachedScheduleTransitionOrigin !== null &&
			nowEpochMilliseconds >= cachedScheduleTransitionOrigin &&
			( cachedScheduleTransitionDeadline === null ||
				cachedScheduleTransitionDeadline > nowEpochMilliseconds );

		if ( cacheRemainsCurrent ) {
			return cachedScheduleTransitionDeadline;
		}

		cachedScheduleTransitionKey = cacheKey;
		cachedScheduleTransitionOrigin = nowEpochMilliseconds;
		cachedScheduleTransitionDeadline = getNextScheduleTransitionDeadline(
			Object.values( configuration.schedulesByScope ),
			nowEpochMilliseconds,
			timeZone,
		);

		return cachedScheduleTransitionDeadline;
	}

	/**
	 * Refreshes focus-dependent page warnings and the global toolbar badge from one snapshot.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after both best-effort focus-dependent effects settle.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refreshFocusEffects(
		configuration: Parameters<BrowserProtectionProjector[ 'refreshFocusEffects' ]>[ 0 ],
		statesByScope: Parameters<BrowserProtectionProjector[ 'refreshFocusEffects' ]>[ 1 ],
	): Promise<void> {
		await Promise.allSettled( [
			allowanceWarningReconciler.reconcile( configuration, statesByScope ),
			toolbarBadgeCoordinator.refresh( configuration, statesByScope ),
		] );
	}

	/**
	 * Projects protection-clock alarms, allowance warnings, and the global toolbar badge as ancillary effects.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after every ancillary effect settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refreshAncillaryEffects(
		configuration: Parameters<BrowserProtectionProjector[ 'reconcile' ]>[ 0 ],
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void> {
		const nowEpochMilliseconds = options.now();
		const timeZone = options.getTimeZone();
		const scheduleTransitionDeadline = statesByScope === null
			? null
			: getScheduleTransitionDeadline( configuration, nowEpochMilliseconds, timeZone );

		await Promise.allSettled( [
			options.browser.synchronizeProtectionClock( getProtectionClockDeadlines(
				statesByScope,
				nowEpochMilliseconds,
				scheduleTransitionDeadline,
			) ),
			refreshFocusEffects( configuration, statesByScope ),
		] );
	}

	/**
	 * Refreshes the global toolbar badge from an explicit authoritative snapshot.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after the best-effort global badge attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refreshToolbarBadge(
		configuration: Parameters<BrowserProtectionProjector[ 'refreshToolbarBadge' ]>[ 0 ],
		statesByScope: Parameters<BrowserProtectionProjector[ 'refreshToolbarBadge' ]>[ 1 ],
	): Promise<void> {
		await Promise.allSettled( [ toolbarBadgeCoordinator.refresh( configuration, statesByScope ) ] );
	}

	/**
	 * Reconciles critical dynamic redirects before ancillary browser projections.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after redirects succeed and ancillary attempts settle.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcile(
		configuration: Parameters<BrowserProtectionProjector[ 'reconcile' ]>[ 0 ],
	): Promise<void> {
		const statesByScope = await options.coordinator.getStates();

		await navigationRuleReconciler.reconcile( configuration, statesByScope );
		await refreshAncillaryEffects( configuration, statesByScope );
	}

	/**
	 * Applies persisted page decisions after dynamic redirects reflect authoritative state.
	 * @param decisions - Persisted protection decisions.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after page effects succeed and ancillary attempts settle.
	 * @since 0.1.0 Initial implementation.
	 */
	async function applyDecisions(
		decisions: Parameters<BrowserProtectionProjector[ 'applyDecisions' ]>[ 0 ],
		configuration: Parameters<BrowserProtectionProjector[ 'applyDecisions' ]>[ 1 ],
	): Promise<void> {
		const statesByScope = await options.coordinator.getStates();

		await navigationRuleReconciler.reconcile( configuration, statesByScope );
		await pageProjector.applyDecisions( decisions, configuration, statesByScope );
		await refreshAncillaryEffects( configuration, statesByScope );
	}

	/**
	 * Attempts to remove every browser effect owned by runtime protection.
	 * @return Promise resolved after redirect removal succeeds and ancillary attempts settle.
	 * @since 0.1.0 Initial implementation.
	 */
	async function failOpen(): Promise<void> {
		const statesByScope = await options.coordinator.getStates();
		const results = await Promise.allSettled( [
			options.browser.replaceNavigationRules( [] ),
			options.browser.synchronizeProtectionClock( [] ),
			options.browser.updateToolbarBadge( createToolbarBadgeProjection( {
				phase: ToolbarBadgePhase.INACTIVE,
			}, options.toolbarBadgeCopy ) ),
			pageProjector.releaseInjectedInterruptions(),
			allowanceWarningReconciler.reconcile( null, statesByScope ),
		] );
		const [ navigationRuleResult, , , injectedReleaseResult ] = results;

		if ( navigationRuleResult.status === 'rejected' ) {
			throw new Error( 'Failed to remove protection navigation rules.', {
				cause: navigationRuleResult.reason,
			} );
		}

		const [ pageReleaseResult ] = await Promise.allSettled( [
			pageProjector.releaseInterruptionPages( statesByScope ),
		] );

		if ( pageReleaseResult.status === 'rejected' ) {
			throw pageReleaseResult.reason;
		}

		if ( injectedReleaseResult.status === 'rejected' ) {
			throw injectedReleaseResult.reason;
		}
	}

	/**
	 * Applies one persisted coordinator result or fails open after rejected persistence.
	 * @param result - Persisted coordinator dispatch result.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after accepted effects or rejected after fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function applyDispatchResult(
		result: Parameters<BrowserProtectionProjector[ 'applyDispatchResult' ]>[ 0 ],
		configuration: Parameters<BrowserProtectionProjector[ 'applyDispatchResult' ]>[ 1 ],
	): Promise<void> {
		if ( result.status === ProtectionCoordinatorDispatchStatus.REJECTED ) {
			await failOpen();
			throw new Error( `Protection state dispatch failed: ${ result.reason }.` );
		}

		await applyDecisions( result.decisions, configuration );
	}
	return {
		reconcile,
		applyDecisions,
		applyDispatchResult,
		refreshFocusEffects,
		refreshToolbarBadge,
		releaseInjectedInterruption: pageProjector.releaseInjectedInterruption,
		releaseInterruptionPresentation: pageProjector.releaseInterruptionPresentation,
		releaseNavigationIfInterrupted: pageProjector.releaseNavigationIfInterrupted,
		failOpen,
	};
}

export * from './types';
