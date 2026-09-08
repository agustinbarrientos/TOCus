import { beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import type { Browser, BrowserType, Page } from 'playwright';
import {
	createLocalizationViteConfig,
} from '../../../../../config/vite/services/create-localization-vite-config';
import type { SettingsFixtureControls } from '../../components/shell/__fixtures__/types';
import type { SettingsBrowserHarness } from './types';

/**
 * Shares isolated local-server setup across production Settings browser suites.
 * @param engine - Actual browser engine selected by the surrounding parameterized suite.
 * @return Typed page opener and fixture-control writer.
 * @since 0.1.0
 */
export function createSettingsBrowserHarness( engine: BrowserType ): SettingsBrowserHarness {
	let server: ViteDevServer | undefined;
	let browser: Browser | undefined;
	let url: string;
	let cacheDirectory: string | undefined;

	beforeAll( async () => {
		cacheDirectory = await mkdtemp( join( tmpdir(), 'tocus-settings-vite-' ) );
		server = await createServer( {
			root: fileURLToPath( new URL( '../../components/shell/__fixtures__/', import.meta.url ) ),
			configFile: false,
			cacheDir: cacheDirectory,
			optimizeDeps: {
				entries: [ './main.tsx' ],
				exclude: [ '@lingui/core/macro' ],
			},
			plugins: createLocalizationViteConfig().plugins,
			server: { host: '127.0.0.1', port: 0 },
		} );
		await server.listen();
		const address = server.resolvedUrls?.local[ 0 ];
		if ( address === undefined ) {
			throw new Error( 'The Settings fixture server did not expose a local address.' );
		}
		url = address;
		browser = await engine.launch();
	}, 30000 );

	afterAll( async () => {
		await browser?.close();
		await server?.close();
		if ( cacheDirectory !== undefined ) {
			await rm( cacheDirectory, { recursive: true, force: true } );
		}
	}, 30000 );

	/**
	 * Opens an isolated Settings fixture at a production destination.
	 * @param destination - Initial Settings fragment.
	 * @return Browser page ready for screen assertions.
	 * @since 0.1.0
	 */
	async function open( destination = 'timing' ): Promise<Page> {
		if ( browser === undefined ) {
			throw new Error( 'The Settings browser was not initialized.' );
		}
		const page = await browser.newPage();
		page.setDefaultTimeout( 6000 );
		// Cold local compilation is separate from the short interactive-control timeout.
		page.setDefaultNavigationTimeout( 20000 );
		await page.goto( `${ url }#${ destination }` );
		return page;
	}

	/**
	 * Changes a typed fixture control without bypassing the production editor.
	 * @template Key - Name of the browser-test control.
	 * @param page - Isolated Settings page.
	 * @param name - Fixture control to change.
	 * @param value - Value permitted by that control.
	 * @return Completion of the browser-side update.
	 * @since 0.1.0
	 */
	async function setting<Key extends keyof SettingsFixtureControls>(
		page: Page,
		name: Key,
		value: SettingsFixtureControls[ Key ],
	): Promise<void> {
		await page.evaluate( ( { name, value } ) => {
			Object.assign( window.settingsTest.controls, { [ name ]: value } );
		}, { name, value } );
	}

	return { open, setting };
}
