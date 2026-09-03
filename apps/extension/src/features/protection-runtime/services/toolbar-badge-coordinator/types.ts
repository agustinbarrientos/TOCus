import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
} from '../../utils/toolbar-badge-projection';

/**
 * Browser tab details needed for protection matching and badge projection.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarBadgeTab {
	/**
	 * Browser-provided tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	id: number;

	/**
	 * Destination of a navigation that has started but has not committed yet.
	 * @since 0.1.0 Initial implementation.
	 */
	pendingUrl?: string;

	/**
	 * Accessible current tab URL, when the browser exposes it.
	 * @since 0.1.0 Initial implementation.
	 */
	url?: string;
}

/**
 * Dependencies used to coordinate toolbar badges.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarBadgeCoordinatorOptions {
	/** Localized toolbar copy, or undefined to use the default English copy. */
	copy?: ToolbarBadgeCopy;

	/**
	 * Returns the active tab in the focused browser window.
	 * @return Focused tab identifier, or null when no browser window is focused.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedTabId: () => Promise<number | null>;

	/** Extension-owned interruption page that may retain participant context. */
	interruptionPageUrl: string;

	/**
	 * Lists current open browser tabs.
	 * @return Current browser tabs and their accessible URLs.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs: () => Promise<ReadonlyArray<ToolbarBadgeTab>>;

	/**
	 * Returns the current wall-clock epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now: () => number;

	/**
	 * Applies one browser-neutral projection to the global toolbar badge.
	 * @param projection - Compact badge text, accessible title, and semantic phase.
	 * @return Promise resolved after the toolbar action is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	updateToolbarBadge: ( projection: ToolbarBadgeProjection ) => Promise<void>;
}

/**
 * Projects authoritative scope state into current browser toolbar badges.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarBadgeCoordinator {
	/**
	 * Refreshes the global toolbar badge with the currently selected scope projection.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after the global toolbar badge is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	refresh(
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void>;
}
