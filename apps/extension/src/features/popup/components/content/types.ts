import type { PopupActions, PopupShellCopy, PopupState } from '../shell/types';
import type { PopupProjection } from '../../types/popup-projection';

/**
 * Loaded copy and status needed to choose one popup content state.
 * @since 0.1.0
 */
export interface PopupContentProperties extends PopupActions {
	/** Latest controller snapshot, including operation progress and destinations. */
	state: Readonly<PopupState>;
	/** Complete active-language messages. */
	copy: Readonly<PopupShellCopy>;
	/** Authoritative background status, already loaded by the controller. */
	projection: PopupProjection;
}

/**
 * Shared retry button contract for unavailable runtime and current-tab states.
 * @since 0.1.0
 */
export interface PopupRetryProperties {
	/** Complete active-language messages. */
	copy: Readonly<PopupShellCopy>;
	/** Whether the controller is already recovering status. */
	retrying: boolean;
	/**
	 * Starts a controller-owned status refresh.
	 * @since 0.1.0
	 */
	onRetry: () => void;
}
