import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { expect, test as base, type Page } from '@playwright/test';
import type { ExtensionManifest, ExtensionWorkerGlobal, FaviconTestFixture, PackagedFaviconFixtures } from './types';

/**
 * Creates a distinctive website icon unrelated to any TOCus artwork.
 * @return Opaque blue pixels with dimensions matching Chrome's requested favicon.
 * @since 0.1.0 Initial implementation.
 */
function createWebsiteIcon(): PNG {
	const icon = new PNG( { width: 32, height: 32 } );

	for ( let offset = 0; offset < icon.data.length; offset += 4 ) {
		icon.data.set( [ 17, 119, 211, 255 ], offset );
	}
	return icon;
}

/**
 * Reads decoded image pixels without retaining a stale renderer image-cache entry.
 * @param page - An extension document allowed to read the favicon endpoint.
 * @param source - Extension-local image URL.
 * @return SHA-256 fingerprint of the decoded 32-pixel image.
 * @since 0.1.0 Initial implementation.
 */
async function readImageHash( page: Page, source: string ): Promise<string> {
	const pixels = await page.evaluate( async ( url ) => {
		const response = await fetch( url, { cache: 'reload' } );
		const image = await createImageBitmap( await response.blob() );
		const canvas = new OffscreenCanvas( 32, 32 );
		const drawing = canvas.getContext( '2d' );

		if ( drawing === null ) {
			throw new Error( 'The favicon pixel reader is unavailable.' );
		}
		drawing.drawImage( image, 0, 0, 32, 32 );
		image.close();
		return Array.from( drawing.getImageData( 0, 0, 32, 32 ).data );
	}, source );

	return createHash( 'sha256' ).update( Buffer.from( pixels ) ).digest( 'hex' );
}

/**
 * Reads the native favicon associated with an exact website or extension document.
 * @param fixture - Disposable installation with favicon permission.
 * @param pageUrl - Document whose cached icon should be inspected.
 * @return Decoded pixel fingerprint supplied by Chromium's favicon service.
 * @since 0.1.0 Initial implementation.
 */
async function readCachedFavicon( fixture: FaviconTestFixture, pageUrl: string ): Promise<string> {
	const source = new URL( '/_favicon/', fixture.extensionRoot );

	source.searchParams.set( 'pageUrl', pageUrl );
	source.searchParams.set( 'size', '32' );
	return readImageHash( fixture.reader, source.href );
}

const test = base.extend<PackagedFaviconFixtures>( {
	/**
	 * Owns the packaged browser, profile, and loopback server through acquisition and teardown.
	 * @param root0 - Browser runner dependencies.
	 * @param root0.playwright - Instrumented browser APIs retaining configured diagnostics.
	 * @param use - Runs one scenario with its disposable installation.
	 */
	favicon: async ( { playwright }, use ) => {
		const server = createServer( ( request, response ) => {
			if ( request.url === '/favicon.png' ) {
				response.writeHead( 200, { 'Content-Type': 'image/png' } );
				response.end( PNG.sync.write( createWebsiteIcon() ) );
				return;
			}
			response.writeHead( 200, { 'Content-Type': 'text/html' } );
			response.end( '<!doctype html><html lang="en"><title>Independent website</title><link rel="icon" type="image/png" sizes="32x32" href="/favicon.png"><body><h1>Original website</h1></body></html>' );
		} );
		let directory: string | undefined;
		let context: FaviconTestFixture[ 'context' ] | undefined;

		try {
			directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-favicons-' ) );
			const extensionPath = join( directory, 'extension' );
			const profilePath = join( directory, 'profile' );

			await cp( fileURLToPath( new URL( '../../../.output/chrome-mv3/', import.meta.url ) ), extensionPath, { recursive: true } );
			const manifestPath = join( extensionPath, 'manifest.json' );
			const manifest = JSON.parse( await readFile( manifestPath, 'utf8' ) ) as ExtensionManifest;

			expect( manifest.permissions ).not.toContain( 'bookmarks' );
			// Retain every production icon: manifest fallback must participate in this regression.
			// Bookmarks and synthetic host access belong only to this disposable installation.
			manifest.permissions = [ ...manifest.permissions ?? [], ...manifest.optional_permissions ?? [], 'bookmarks' ];
			manifest.host_permissions = [ '*://*.example.test/*' ];
			delete manifest.optional_permissions;
			await writeFile( manifestPath, JSON.stringify( manifest ) );
			await new Promise<void>( ( resolve, reject ) => {
				server.once( 'error', reject );
				server.listen( 0, '127.0.0.1', () => {
					server.off( 'error', reject );
					resolve();
				} );
			} );
			const address = server.address();

			if ( address === null || typeof address === 'string' ) {
				throw new Error( 'The synthetic favicon server is unavailable.' );
			}
			const siteUrl = `http://example.test:${ String( address.port ) }/`;

			/**
			 * Opens the same test-owned profile and reinstalls its loopback-only network boundary.
			 * @return Packaged browser handles with the latest context retained for teardown.
			 * @since 0.1.0
			 */
			async function launchBrowser(): Promise<Pick<FaviconTestFixture, 'context' | 'extensionRoot' | 'reader' | 'worker'>> {
				context = await playwright.chromium.launchPersistentContext( profilePath, {
					channel: 'chromium',
					headless: true,
					timeout: 10_000,
					args: [
						`--disable-extensions-except=${ extensionPath }`, `--load-extension=${ extensionPath }`,
						'--host-resolver-rules=MAP example.test 127.0.0.1', '--no-proxy-server',
					],
				} );
				await context.route( /^https?:\/\//u, ( route ) => {
					return new URL( route.request().url() ).origin === new URL( siteUrl ).origin
						? route.continue()
						: route.abort();
				} );
				const worker = context.serviceWorkers()[ 0 ] ?? await context.waitForEvent( 'serviceworker' );
				const extensionRoot = await worker.evaluate( () => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
					return chrome.runtime.getURL( '/' );
				} );
				const reader = await context.newPage();

				await reader.goto( `${ extensionRoot }options.html` );
				return { context, extensionRoot, reader, worker };
			}

			const fixture: FaviconTestFixture = {
				...await launchBrowser(),
				siteUrl,
				/**
				 * Reopens the same browser profile so native favicon history survives a fresh runtime.
				 * @return Ready replacement handles after the old context closes completely.
				 * @since 0.1.0
				 */
				async restartBrowser(): Promise<void> {
					await fixture.context.close();
					const replacement = await launchBrowser();

					expect( replacement.extensionRoot ).toBe( fixture.extensionRoot );
					Object.assign( fixture, replacement );
				},
			};
			await use( fixture );
		} finally {
			try {
				await context?.close();
			} finally {
				try {
					if ( server.listening ) {
						await new Promise<void>( ( resolve, reject ) => {
							server.close( ( error ) => {
								if ( error !== undefined ) {
									reject( error );
									return;
								}
								resolve();
							} );
							server.closeAllConnections();
						} );
					}
				} finally {
					if ( directory !== undefined ) {
						await rm( directory, { recursive: true, force: true } );
					}
				}
			}
		}
	},
} );

/**
 * Recreates the explicit favicon declaration made by the former pause document.
 * @param page - Actual pause tab whose redirected URL Chrome will associate with this icon.
 * @return Promise resolved once the document declares the old branded favicon.
 * @since 0.1.0 Initial implementation.
 */
async function declareLegacyFavicon( page: Page ): Promise<void> {
	await page.evaluate( () => {
		for ( const link of document.querySelectorAll( 'link[rel="icon"]' ) ) {
			link.remove();
		}
		const favicon = document.createElement( 'link' );

		favicon.rel = 'icon';
		favicon.href = '/icons/tab-dark.png';
		document.head.append( favicon );
	} );
}

/**
 * Recreates a favicon stored by an older installation without rewriting browser databases.
 * @param fixture - Isolated installation whose legacy document should acquire a branded icon.
 * @return Promise resolved once Chromium serves the old branded document icon from its cache.
 * @since 0.1.0 Initial implementation.
 */
async function seedLegacyFavicon( fixture: FaviconTestFixture ): Promise<void> {
	const legacyPage = await fixture.context.newPage();
	const legacyUrl = `${ fixture.extensionRoot }interruption.html`;
	const brandedHash = await readImageHash( fixture.reader, `${ fixture.extensionRoot }icons/tab-dark.png` );

	try {
		await legacyPage.goto( legacyUrl );
		await declareLegacyFavicon( legacyPage );
		await expect.poll( () => readCachedFavicon( fixture, legacyUrl ) ).toBe( brandedHash );
	} finally {
		await legacyPage.close();
	}
}

/**
 * Enables real packaged protection with the shared countdown.
 * @param fixture - Disposable extension whose stored configuration should change.
 * @return Promise resolved once the browser has installed its navigation rules.
 * @since 0.1.0 Initial implementation.
 */
async function enableProtection( fixture: FaviconTestFixture ): Promise<void> {
	await fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

		await chrome.storage.local.set( {
			'tocus.protection.configuration.v1': {
				schemaVersion: 5,
				sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: 'scope_default' } } ],
				timingConfiguration: { initialWaitMilliseconds: 10000, ladderIncreaseMilliseconds: 5000, maximumWaitMilliseconds: 60000, allowanceMilliseconds: 300000, completionAction: 'show-continue' },
				schedule: { mode: 'always' },
				measurementRevisionsByScope: { scope_default: 'revision_packaged_favicon' },
			},
		} );
	} );
	await expect.poll( () => fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
	} ) ).toBeGreaterThan( 0 );
}

/**
 * Starts a second visit fixture without replacing the browser's repaired favicon cache.
 * Only this disposable extension's runtime state is cleared; real waits and navigation remain intact.
 * @param fixture - Test-owned profile whose completed allowance should not carry into the next scenario.
 * @return Ready packaged worker and icon-reader page after relaunching the same browser profile.
 * @since 0.1.0
 */
async function restartVisitFixture( fixture: FaviconTestFixture ): Promise<void> {
	await fixture.reader.close();
	await fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		await chrome.storage.local.remove( 'tocus.protection.durable.v1' );
		await chrome.storage.session.remove( 'tocus.protection.session.v1' );
	} );
	await fixture.restartBrowser();
}

/**
 * Visits a protected website and completes the actual focused pause.
 * @param fixture - Browser whose website is protected by packaged navigation rules.
 * @return Interruption tab with its real Continue button visible.
 * @since 0.1.0 Initial implementation.
 */
async function openReadyPause( fixture: FaviconTestFixture ): Promise<Page> {
	const pause = await fixture.context.newPage();

	await pause.goto( fixture.siteUrl );
	await pause.waitForURL( `${ fixture.extensionRoot }**` );
	await pause.bringToFront();
	await pause.getByRole( 'button', { name: 'Continue', exact: true } ).waitFor( { state: 'visible', timeout: 15_000 } );
	return pause;
}

test.describe( 'packaged Chrome favicon preservation', () => {
	for ( const legacyState of [ false, true ] ) {
		test( `preserves a website favicon through pause and Continue with legacy bookmark state: ${ String( legacyState ) }`, async ( { favicon: fixture } ) => {
			test.setTimeout( 45_000 );
			const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );

			await test.step( 'Prepare the original website favicon and optional legacy bookmark', async () => {
				if ( legacyState ) {
					await seedLegacyFavicon( fixture );
					await fixture.worker.evaluate( async ( url ) => {
						const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
						await chrome.bookmarks.create( { title: 'Independent website', url } );
					}, fixture.siteUrl );
				}
				const website = await fixture.context.newPage();

				await website.goto( fixture.siteUrl );
				await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
				await website.close();
			} );
			const pause = await test.step( 'Complete the real ten-second pause', async () => {
				await enableProtection( fixture );
				return openReadyPause( fixture );
			} );

			await test.step( 'Keep the original favicon before and after Continue', async () => {
				// Ready follows the real ten-second pause, leaving Chrome time to persist favicon updates.
				expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
				await pause.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await pause.waitForURL( fixture.siteUrl, { timeout: 5_000 } );
				await expect( pause.getByRole( 'heading', { name: 'Original website' } ) ).toBeVisible();
				expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
			} );
		} );
	}

	test( 'relearns a contaminated website favicon after Continue and preserves it at the next pause', async ( { favicon: fixture } ) => {
		test.setTimeout( 75_000 );
		const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );
		const brandedHash = await test.step( 'Seed the former extension favicon and redirect', async () => {
			await seedLegacyFavicon( fixture );
			const legacyHash = await readImageHash( fixture.reader, `${ fixture.extensionRoot }icons/tab-dark.png` );

			await enableProtection( fixture );
			// Recreate the old redirect using the browser API, without editing its favicon database.
			await fixture.worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				const rules = await chrome.declarativeNetRequest.getDynamicRules();

				await chrome.declarativeNetRequest.updateDynamicRules( {
					removeRuleIds: rules.map( ( rule ) => rule.id ),
					addRules: rules.map( ( rule ) => ( {
						...rule,
						action: { type: 'redirect', redirect: { extensionPath: '/interruption.html' } },
					} ) ),
				} );
			} );
			return legacyHash;
		} );
		const legacyPause = await test.step( 'Complete the first real ten-second pause', () => openReadyPause( fixture ) );

		await test.step( 'Observe the contaminated favicon and relearn the website icon after Continue', async () => {
			expect( legacyPause.url() ).toBe( `${ fixture.extensionRoot }interruption.html` );
			// Seeding a separate document does not deterministically populate a redirect's cache entry.
			// Recreate the old declaration on the redirected tab and observe its actual persisted effect.
			await declareLegacyFavicon( legacyPause );
			await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( brandedHash );
			await legacyPause.getByRole( 'button', { name: 'Continue', exact: true } ).click();
			await legacyPause.waitForURL( fixture.siteUrl, { timeout: 5_000 } );
			await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
			await legacyPause.close();
		} );
		await test.step( 'Preserve the repaired favicon through the second real ten-second pause', async () => {
			await restartVisitFixture( fixture );
			await enableProtection( fixture );
			await openReadyPause( fixture );
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		} );
	} );
} );
