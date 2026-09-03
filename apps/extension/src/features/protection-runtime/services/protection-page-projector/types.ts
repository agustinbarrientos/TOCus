import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionDecision } from '../../../../domains/protection/types/protection-decision';
import { type AllowanceExpiryProtectionParticipant } from '../../../../domains/protection/types/protection-participant';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type RetainedNavigationDestination } from '../../../../domains/protection/types/protection-value';
import { type ProtectionRuntimeBrowser } from '../../types/browser-runtime';

/**
 * Dependencies used to project decisions into live browser pages.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionPageProjectorOptions {
	/** Browser page observations and mutations used by protection decisions. */
	browser: Pick<
		ProtectionRuntimeBrowser,
		'dismissInterruption' |
		'getProtectedPagePresentation' |
		'listTabs' |
		'navigateTab' |
		'updateProtectedPagePresentation'
	>;
	/** Extension-owned interruption page URL. */
	interruptionPageUrl: string;
}

/**
 * Projects authoritative protection decisions into live browser pages.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionPageProjector {
	/**
	 * Applies persisted decisions sequentially against fresh browser observations.
	 * @param decisions - Persisted protection decisions.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative state snapshot or unavailable marker.
	 * @return Promise resolved after supported page effects are applied.
	 * @since 0.1.0 Initial implementation.
	 */
	applyDecisions(
		decisions: ReadonlyArray<ProtectionDecision>,
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;

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
	 * Removes injected interruptions from every live non-interruption tab without injecting listeners.
	 * @return Promise resolved after every best-effort removal command is accepted.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseInjectedInterruptions: () => Promise<void>;

	/**
	 * Releases every live interruption page after redirect rules have been removed.
	 * @param statesByScope - Current authoritative state snapshot or unavailable marker.
	 * @return Promise resolved after retained destinations and browser-native dismissals complete.
	 * @since 0.1.0 Initial implementation.
	 */
	releaseInterruptionPages: (
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
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
}
