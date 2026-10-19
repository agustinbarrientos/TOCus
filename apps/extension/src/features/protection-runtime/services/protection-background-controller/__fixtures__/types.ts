import type { Mock } from 'vitest';
import type { ProtectionBackgroundMessageSender } from '../types';
import type {
	BrowserProtectionRuntime,
	BrowserProtectionStatisticsObservation,
} from '../../browser-protection-runtime';

/**
 * Browser message sender fixture.
 * @since 1.0.0 Initial implementation.
 */
export type TestMessageSender = ProtectionBackgroundMessageSender;

/**
 * Browser permission-change fixture.
 * @since 1.0.0 Initial implementation.
 */
export interface TestPermissionChange {
	/** Changed named permissions. */
	permissions?: ReadonlyArray<string> | undefined;
	/** Changed origin permissions. */
	origins?: ReadonlyArray<string> | undefined;
}

/**
 * Fully spied runtime returned to controller tests.
 * @since 1.0.0 Initial implementation.
 */
export interface RuntimeHarness {
	/** Runtime contract supplied to the controller. */
	runtime: BrowserProtectionRuntime;
	/** Event-ingress statistics observation spy. */
	captureStatisticsObservation: Mock;
	/** Observation promises created synchronously at browser-event ingress. */
	capturedStatisticsObservations: Array<Promise<BrowserProtectionStatisticsObservation>>;
	/** Runtime startup spy. */
	start: Mock;
	/** Navigation spy. */
	handleNavigation: Mock;
	/** Page-request spy. */
	handlePageRequest: Mock;
	/** Tab-removal spy. */
	handleTabRemoved: Mock;
	/** Focus-change spy. */
	handleFocusChanged: Mock;
	/** Clock-tick spy. */
	handleClockTick: Mock;
	/** Configuration-change spy. */
	handleConfigurationChanged: Mock;
	/** Toolbar refresh spy. */
	refreshToolbarBadge: Mock;
	/** Fail-open cleanup spy. */
	failOpen: Mock;
	/**
	 * Statistics read spy.
	 * @since 1.0.0 Initial implementation.
	 */
	readStatistics: Mock;
	/**
	 * Statistics reset spy.
	 * @since 1.0.0 Initial implementation.
	 */
	resetStatistics: Mock;
}
