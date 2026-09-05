import { type Mock } from 'vitest';
import {
	type BrowserProtectionRuntime,
	type BrowserProtectionStatisticsObservation,
} from '../../browser-protection-runtime';

/**
 * Browser message sender fixture.
 * @since 0.1.0 Initial implementation.
 */
export interface TestMessageSender {
	/** Sending frame identifier when the message came from a tab. */
	frameId?: number | undefined;
	/** Sending tab fixture. */
	tab?: {
		/** Whether the sender tab belongs to a private browsing context. */
		incognito?: boolean | undefined;
		/** Browser tab identifier. */
		id?: number | undefined;
	} | undefined;
	/** URL of the page or frame hosting the sending script. */
	url?: string | undefined;
}

/**
 * Browser permission-change fixture.
 * @since 0.1.0 Initial implementation.
 */
export interface TestPermissionChange {
	/** Changed named permissions. */
	permissions?: ReadonlyArray<string> | undefined;
	/** Changed origin permissions. */
	origins?: ReadonlyArray<string> | undefined;
}

/**
 * Fully spied runtime returned to controller tests.
 * @since 0.1.0 Initial implementation.
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
	 * @since 0.1.0 Initial implementation.
	 */
	readStatistics: Mock;
	/**
	 * Statistics reset spy.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics: Mock;
}
