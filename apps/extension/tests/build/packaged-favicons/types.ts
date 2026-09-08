import type { BrowserContext, Page, Worker } from 'playwright';
import type { Server } from 'node:http';

export type { ExtensionManifest, ExtensionWorkerGlobal } from '../packaged-protection/types';

/**
 * Disposable browser and loopback website used to exercise native favicon caching.
 * @since 0.1.0 Initial implementation.
 */
export interface FaviconTestFixture {
	/** Persistent browser isolated from every user profile. */
	context: BrowserContext;
	/** Temporary installation and profile directory. */
	directory: string;
	/** Extension document that reads the browser's real favicon endpoint. */
	reader: Page;
	/** Packaged extension origin. */
	extensionRoot: string;
	/** Synthetic website served without external network access. */
	siteUrl: string;
	/** Loopback server serving the synthetic document and its distinct icon. */
	server: Server;
	/** Actual packaged background service worker. */
	worker: Worker;
}
