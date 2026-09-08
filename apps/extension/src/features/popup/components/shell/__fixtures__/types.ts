import type { PopupPageShell } from '../../../services/popup-page/types';
import type { PopupActiveScope, PopupAvailableProjection } from '../../../types/popup-projection';
import type { PopupCurrentSiteStatus, PopupScopeKind, PopupTimerPhase } from '../../../types/popup-projection';

/**
 * Browser-test bridge to the unchanged popup controller-facing presentation port.
 * @since 0.1.0
 */
export interface PopupFixtureBridge {
	currentSiteStatuses: typeof PopupCurrentSiteStatus;
	scopeKinds: typeof PopupScopeKind;
	timerPhases: typeof PopupTimerPhase;
	port: PopupPageShell;
	listed: PopupAvailableProjection;
	wait: PopupActiveScope;
	requests: number;
	retries: number;
}

declare global {
	/**
	 * Isolated popup instrumentation unavailable to production entrypoints.
	 * @since 0.1.0
	 */
	interface Window {
		popupTest: PopupFixtureBridge;
	}
}
