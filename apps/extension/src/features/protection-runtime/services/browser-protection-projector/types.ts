import {
	type ProtectionCoordinator,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorStateSnapshot,
} from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionDecision } from '../../../../domains/protection/types/protection-decision';
import { type AllowanceExpiryProtectionParticipant } from '../../../../domains/protection/types/protection-participant';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type RetainedNavigationDestination } from '../../../../domains/protection/types/protection-value';
import { type ToolbarBadgeCopy } from '../../utils/toolbar-badge-projection';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';

/**
 * Dependencies used to project authoritative protection state into browser effects.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionProjectorOptions {
	/** Browser capabilities receiving protection effects. */
	browser: ProtectionRuntimeBrowser;

	/** Authoritative state reader used after persisted transitions. */
	coordinator: Pick<ProtectionCoordinator, 'getStates'>;

	/** Extension-owned interruption page URL. */
	interruptionPageUrl: string;

	/** Localized toolbar copy, or undefined to use the default English copy. */
	toolbarBadgeCopy?: ToolbarBadgeCopy;

	/**
	 * Returns the current local IANA time zone.
	 * @return Current IANA time-zone identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimeZone: () => string;

	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now: () => number;
}

/**
 * Browser-effect projection for authoritative protection state and decisions.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionProjector {
	/**
	 * Removes an injected interruption only for one authoritative allowance-expiry participant.
	 * @param participant - Known allowance-expiry participant retaining the injected page identity.
	 * @return Promise resolved after removal or when the owned layer is no longer present.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseInjectedInterruption: (
		participant: AllowanceExpiryProtectionParticipant,
	) => Promise<void>;

	/**
	 * Releases one tab only while it still displays the interruption page.
	 * @param tabId - Browser tab that may still display the interruption page.
	 * @param retainedDestination - Validated destination to restore, or null for browser-native dismissal.
	 * @return Promise resolved after release or a verified stale-tab race.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseNavigationIfInterrupted: (
		tabId: number,
		retainedDestination: RetainedNavigationDestination | null,
	) => Promise<void>;

	/**
	 * Reconciles dynamic redirects, protection-clock alarms, allowance warnings, and the global toolbar badge.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after redirects succeed and ancillary attempts settle.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcile: ( configuration: ProtectionConfigurationDocument | null ) => Promise<void>;

	/**
	 * Applies persisted page decisions after dynamic redirects reflect authoritative state.
	 * @param decisions - Persisted protection decisions.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after page effects succeed and ancillary attempts settle.
	 * @since 0.1.0 Initial implementation.
	 */
	applyDecisions: (
		decisions: ReadonlyArray<ProtectionDecision>,
		configuration: ProtectionConfigurationDocument | null,
	) => Promise<void>;

	/**
	 * Applies one persisted coordinator result or fails open after rejected persistence.
	 * @param result - Persisted coordinator dispatch result.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after accepted effects or rejected after fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	applyDispatchResult(
		result: ProtectionCoordinatorDispatchResult,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void>;

	/**
	 * Refreshes focus-dependent allowance warnings and the global toolbar badge.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative state snapshot or unavailable marker.
	 * @return Promise resolved after both best-effort focus-dependent effects settle.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshFocusEffects: (
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	) => Promise<void>;

	/**
	 * Refreshes the global toolbar badge from an explicit authoritative snapshot.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after the best-effort global badge attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshToolbarBadge: (
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	) => Promise<void>;

	/**
	 * Attempts to remove every browser effect owned by runtime protection.
	 * @return Promise resolved after redirect removal succeeds and ancillary attempts settle.
	 * @since 0.1.0 Initial implementation.
	 */
	failOpen(): Promise<void>;
}
