import type { WxtBrowser } from 'wxt/browser';
import type { Worker } from '@playwright/test';

/**
 * Build targets selectable by the shared packaged Chromium fixture.
 * @since 0.1.0 Initial implementation.
 */
export const PackagedExtensionBuild = {
	CHROME: 'chrome-mv3',
	EDGE: 'edge-mv3',
} as const;

/**
 * A compiled extension directory supported by the packaged fixture.
 * @since 0.1.0 Initial implementation.
 */
export type PackagedExtensionBuild = typeof PackagedExtensionBuild[ keyof typeof PackagedExtensionBuild ];

/**
 * Per-test packaged installation and its optional synthetic-site grant.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionTestFixtures {
	/** Compiled browser target copied into this disposable installation. */
	extensionBuild: PackagedExtensionBuild;
	/** Whether the disposable installation pregrants the synthetic protected website. */
	pregrantSite: boolean;
	/** Ready service worker for this test's isolated installation. */
	worker: Worker;
	/** Absolute root of this test's packaged extension. */
	extensionRoot: string;
}

/**
 * Extension APIs available inside the packaged Chrome service worker.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionWorkerGlobal {
	/** Chrome extension APIs exposed by the disposable browser profile. */
	chrome: ExtensionWorkerBrowser;
}

/**
 * Browser APIs available in the packaged service worker test context.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionWorkerBrowser extends Omit<WxtBrowser, 'runtime'> {
	/** Runtime API with extension document URL resolution. */
	runtime: WxtBrowser[ 'runtime' ] & ExtensionWorkerRuntime;
}

/**
 * Browser runtime with packaged document paths resolved outside WXT's generated source types.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionWorkerRuntime {
	/**
	 * Resolves a document bundled in the disposable extension.
	 * @param path - Packaged extension document path.
	 * @return Absolute extension URL.
	 * @since 0.1.0 Initial implementation.
	 */
	getURL: ( path: string ) => string;
}

/**
 * Generated manifest copied into the disposable extension installation.
 * @since 0.1.0 Initial implementation.
 */
export type ExtensionManifest = ReturnType<WxtBrowser[ 'runtime' ][ 'getManifest' ]>;
