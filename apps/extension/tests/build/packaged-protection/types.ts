import { type WxtBrowser } from 'wxt/browser';

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
