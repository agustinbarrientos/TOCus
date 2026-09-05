import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import type {
	ProtectionState,
	ProtectionStateType,
} from '../../../../domains/protection/types/protection-state';
import { type ProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { type BrowserProtectionRuntimeSnapshot } from '../../../protection-runtime/services/browser-protection-runtime';
import { type PopupCurrentTabContext } from '../../types/current-tab-context';

/**
 * Inputs required to create one deterministic popup projection.
 * @since 0.1.0 Initial implementation.
 */
export interface CreatePopupProjectionOptions {
	/** Current active-tab metadata, or null when the browser does not expose it. */
	currentTab: PopupCurrentTabContext | null;
	/** Exact extension-owned interruption page URL. */
	interruptionPageUrl: string;
	/** Current runtime state, or null when protection is unavailable. */
	snapshot: BrowserProtectionRuntimeSnapshot | null;
}

/**
 * Popup projection inputs with one available protection-runtime snapshot.
 * @since 0.1.0 Initial implementation.
 */
export interface CreatePopupProjectionAvailableOptions extends CreatePopupProjectionOptions {
	/** Current detached protection runtime state. */
	snapshot: BrowserProtectionRuntimeSnapshot;
}

/**
 * Available popup projection inputs with complete current-tab metadata.
 * @since 0.1.0 Initial implementation.
 */
export interface CreatePopupProjectionCurrentTabOptions extends CreatePopupProjectionAvailableOptions {
	/** Current non-private or private top-level tab metadata. */
	currentTab: PopupCurrentTabContext;
}

/**
 * Discriminator shared by Waiting and Allowance protection states.
 * @since 0.1.0 Initial implementation.
 */
interface PopupActiveProtectionStateDiscriminator {
	/** Active timer state kind. */
	type: typeof ProtectionStateType.WAITING | typeof ProtectionStateType.ALLOWANCE;
}

/**
 * Runtime protection states that expose a visible popup timer.
 * @since 0.1.0 Initial implementation.
 */
export type PopupActiveProtectionState = Extract<ProtectionState, PopupActiveProtectionStateDiscriminator>;

/**
 * Discriminator owned by one Waiting protection state.
 * @since 0.1.0 Initial implementation.
 */
interface PopupWaitingProtectionStateDiscriminator {
	/** Waiting timer state kind. */
	type: typeof ProtectionStateType.WAITING;
}

/**
 * Waiting runtime state whose focused remainder is displayed without local ticking.
 * @since 0.1.0 Initial implementation.
 */
export type PopupWaitingProtectionState = Extract<ProtectionState, PopupWaitingProtectionStateDiscriminator>;

/**
 * Nonempty configured scope metadata used while projecting active timers.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupProjectionScopeEntry {
	/** First configured website in stable configuration order. */
	firstSite: ProtectedSiteConfiguration;
	/** Number of configured websites sharing the scope. */
	siteCount: number;
	/** Stable protection scope identifier. */
	scopeId: ProtectionScopeId;
}
