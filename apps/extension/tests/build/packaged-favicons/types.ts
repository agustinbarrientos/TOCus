import type { BrowserContext, Page, Worker } from '@playwright/test';

export type { ExtensionManifest, ExtensionWorkerGlobal } from '../packaged-protection/types';

/**
 * Disposable browser and loopback website used to exercise native favicon caching.
 * @since 1.0.0 Initial implementation.
 */
export interface FaviconTestFixture {
	/** Persistent browser isolated from every user profile. */
	context: BrowserContext;
	/** Extension document that reads the browser's real favicon endpoint. */
	reader: Page;
	/** Packaged extension origin. */
	extensionRoot: string;
	/** Synthetic website served without external network access. */
	siteUrl: string;
	/** Actual packaged background service worker. */
	worker: Worker;
	/**
	 * Relaunches this disposable profile without changing its native favicon or bookmark data.
	 * @return Ready replacement browser, worker, and reader handles on this fixture.
	 * @since 1.0.0
	 */
	restartBrowser(): Promise<void>;
}

/**
 * Test-scoped packaged browser owned by the browser contract runner.
 * @since 1.0.0 Initial implementation.
 */
export interface PackagedFaviconFixtures {
	/** Disposable packaged installation with a real native favicon cache. */
	favicon: FaviconTestFixture;
}
