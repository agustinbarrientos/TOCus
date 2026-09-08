import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalizationViteConfig } from '../../../../../config/vite/services/create-localization-vite-config';
import { PopupOperationError } from './types';

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s popup contracts', ( _name, engine ) => {
		let server: ViteDevServer | undefined;
		let browser: Browser | undefined;
		let url: string;
		let cacheDirectory: string | undefined;
		beforeAll( async () => {
			cacheDirectory = await mkdtemp( join( tmpdir(), 'tocus-popup-vite-' ) );
			server = await createServer( {
				root: `${ import.meta.dirname }/__fixtures__`, configFile: false,
				cacheDir: cacheDirectory,
				plugins: createLocalizationViteConfig().plugins,
				optimizeDeps: { entries: [ './main.tsx' ], exclude: [ '@lingui/core/macro' ] },
				server: { host: '127.0.0.1', port: 0 },
			} );
			await server.listen();
			const address = server.resolvedUrls?.local[ 0 ];
			if ( address === undefined ) {
				throw new Error( 'The popup fixture did not expose a local address.' );
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
		 * Opens an isolated popup at the real compact surface width.
		 * @return Page with the production popup action ready.
		 * @since 0.1.0
		 */
		async function open(): Promise<Page> {
			if ( browser === undefined ) {
				throw new Error( 'The popup browser was not initialized.' );
			}
			const page = await browser.newPage( { viewport: { width: 352, height: 800 } } );
			page.setDefaultTimeout( 6000 );
			await page.goto( url );
			await page.getByRole( 'button', { name: 'Pause site', exact: true } ).waitFor();
			return page;
		}

		it( 'keeps enrollment synchronous and prevents duplicate requests while pending', async () => {
			const page = await open();
			const action = page.getByRole( 'button', { name: 'Pause site', exact: true } );
			await action.focus();
			await page.keyboard.press( 'Space' );
			await page.keyboard.press( 'Space' );
			expect( await page.evaluate( () => window.popupTest.requests ) ).toBe( 1 );
			expect( await page.locator( '.primary-action' ).isDisabled() ).toBe( true );
			expect( await page.locator( '[aria-busy="true"]' ).count() ).toBeGreaterThan( 0 );
			for ( const label of [ 'Settings', 'Statistics' ] ) {
				const link = page.getByRole( 'link', { name: label, exact: true } );
				expect( await link.getAttribute( 'href' ) ).toContain( '/options.html#' );
				expect( await link.getAttribute( 'rel' ) ).toContain( 'noopener' );
			}
			await page.evaluate( async () => {
				const { port, listed } = window.popupTest;
				port.adding = false;
				port.projection = listed;
				await port.focusManageAction();
			} );
			await expect.poll( () => page.locator( '.manage-action' ).evaluate(
				( element ) => element === document.activeElement,
			) ).toBe( true );
			await page.close();
		}, 20000 );

		it( 'keeps focused waiting authoritative and excludes unrelated timers', async () => {
			const page = await open();
			await page.evaluate( () => {
				const { port, listed, wait } = window.popupTest;
				port.projection = { ...listed, activeScopes: [ wait ] };
			} );
			const timer = page.getByRole( 'region', { name: 'Time left', exact: true } );
			await timer.waitFor();
			expect( await timer.locator( 'strong' ).textContent() ).toBe( '0:05' );
			await page.evaluate( () => {
				window.popupTest.port.nowEpochMilliseconds = 100000;
			} );
			expect( await timer.locator( 'strong' ).textContent() ).toBe( '0:05' );
			await page.evaluate( () => {
				const { port, listed, wait } = window.popupTest;
				port.projection = { ...listed, activeScopes: [ { ...wait, isCurrentScope: false } ] };
			} );
			await timer.waitFor( { state: 'hidden' } );
			await page.evaluate( () => {
				const { port, listed } = window.popupTest;
				port.projection = { ...listed, activeScopes: [ {
					kind: window.popupTest.scopeKinds.SHARED, phase: window.popupTest.timerPhases.ALLOWANCE,
					scopeId: window.popupTest.wait.scopeId, site: null,
					siteCount: 1, isCurrentScope: true, expiresAtEpochMilliseconds: 1000,
				} ] };
			} );
			await timer.waitFor();
			expect( await timer.locator( 'strong' ).textContent() ).toBe( '0:00' );
			await page.close();
		}, 20000 );

		it( 'supports unavailable lookup retry and controller-selected focus recovery', async () => {
			const page = await open();
			await page.evaluate( () => {
				const { port, listed } = window.popupTest;
				port.projection = {
					...listed, currentSite: { status: window.popupTest.currentSiteStatuses.UNAVAILABLE },
				};
			} );
			await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
			expect( await page.locator( '.retry-action' ).isDisabled() ).toBe( true );
			expect( await page.evaluate( () => window.popupTest.retries ) ).toBe( 1 );
			await page.evaluate( async () => {
				const { port, listed } = window.popupTest;
				port.retrying = false;
				port.projection = listed;
				await port.focusAfterRetry();
			} );
			await expect.poll( () => page.locator( '.manage-action' ).evaluate(
				( element ) => element === document.activeElement,
			) ).toBe( true );
			await page.evaluate( async () => {
				const { port, listed } = window.popupTest;
				port.projection = {
					...listed, currentSite: { status: window.popupTest.currentSiteStatuses.UNSUPPORTED },
				};
				await port.focusAfterRetry();
			} );
			await expect.poll( () => page.locator( '.neutral-message' ).evaluate(
				( element ) => element === document.activeElement,
			) ).toBe( true );
			expect( await page.getByRole( 'button' ).count() ).toBe( 0 );
			await page.close();
		}, 20000 );

		it( 'keeps all enrollment failures readable and preserves the retryable action', async () => {
			const page = await open();
			for ( const error of Object.values( PopupOperationError ) ) {
				await page.evaluate( ( error ) => {
					window.popupTest.port.operationError = error;
				}, error );
				await page.getByRole( 'alert' ).waitFor();
				expect( await page.getByRole( 'alert' ).textContent() ).not.toBe( '' );
				expect( await page.getByRole( 'button', { name: 'Pause site', exact: true } ).isEnabled() ).toBe( true );
			}
			await page.close();
		}, 20000 );

		it( 'contains long identities and failed local favicons across every appearance', async () => {
			const page = await open();
			await page.evaluate( () => {
				const { port, listed } = window.popupTest;
				port.projection = {
					...listed,
					currentSite: {
						status: window.popupTest.currentSiteStatuses.UNPROTECTED,
						identityHost: `${ 'long-name.'.repeat( 12 ) }example.com`,
					},
				};
				port.faviconSource = '/missing-local-favicon.png';
			} );
			await page.locator( '.mantine-Avatar-placeholder' ).waitFor();
			for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
				for ( const palette of Object.values( Palette ) ) {
					await page.evaluate( ( { theme, palette } ) => {
						document.documentElement.setAttribute( 'data-tocus-theme', theme );
						document.documentElement.setAttribute( 'data-tocus-palette', palette );
					}, { theme, palette } );
					const fits = await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth );
					expect( fits ).toBe( true );
				}
			}
			await page.close();
		}, 20000 );

		it( 'leaves focus unchanged when website management is unavailable', async () => {
			const page = await open();
			await page.evaluate( async () => {
				const { port, listed } = window.popupTest;
				port.settingsPageUrl = '';
				port.projection = listed;
				await port.focusManageAction();
			} );
			expect( await page.evaluate( () => document.activeElement === document.body ) ).toBe( true );
			await page.close();
		}, 20000 );

		it( 'renders nothing while either localization or projection is absent', async () => {
			const page = await open();
			await page.evaluate( () => {
				window.popupTest.port.projection = null;
			} );
			await page.locator( '.popup-view' ).waitFor( { state: 'hidden' } );
			await page.evaluate( () => {
				window.popupTest.port.copy = null;
				window.popupTest.port.projection = window.popupTest.listed;
			} );
			expect( await page.locator( '.popup-view' ).count() ).toBe( 0 );
			await page.close();
		}, 20000 );
	},
);
