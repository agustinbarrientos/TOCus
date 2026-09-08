import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium, type Page } from 'playwright';
import { describe, expect, test } from 'vitest';
import type { ExtensionManifest, ExtensionWorkerGlobal, FaviconTestFixture } from './types';

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

/**
 * Launches the packaged extension with only a disposable synthetic website grant.
 * @return Isolated browser, local server, and native favicon reader.
 * @since 0.1.0 Initial implementation.
 */
async function createFixture(): Promise<FaviconTestFixture> {
	const directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-favicons-' ) );
	const extensionPath = join( directory, 'extension' );
	const server = createServer( ( request, response ) => {
		if ( request.url === '/favicon.png' ) {
			response.writeHead( 200, { 'Content-Type': 'image/png' } );
			response.end( PNG.sync.write( createWebsiteIcon() ) );
			return;
		}
		response.writeHead( 200, { 'Content-Type': 'text/html' } );
		response.end( '<!doctype html><html lang="en"><title>Independent website</title><link rel="icon" type="image/png" sizes="32x32" href="/favicon.png"><body><h1>Original website</h1></body></html>' );
	} );
	let context: FaviconTestFixture[ 'context' ] | undefined;

	try {
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
		await new Promise<void>( ( resolve ) => server.listen( 0, '127.0.0.1', resolve ) );
		const address = server.address();

		if ( address === null || typeof address === 'string' ) {
			throw new Error( 'The synthetic favicon server is unavailable.' );
		}
		const siteUrl = `http://example.test:${ String( address.port ) }/`;

		context = await chromium.launchPersistentContext( join( directory, 'profile' ), {
			channel: 'chromium',
			headless: true,
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
		return { context, directory, extensionRoot, reader, server, siteUrl, worker };
	} catch ( error ) {
		await context?.close();
		server.close();
		await rm( directory, { recursive: true, force: true } );
		throw error;
	}
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
		await legacyPage.evaluate( () => {
			for ( const link of document.querySelectorAll( 'link[rel="icon"]' ) ) {
				link.remove();
			}
			const favicon = document.createElement( 'link' );

			favicon.rel = 'icon';
			favicon.href = '/icons/tab-dark.png';
			document.head.append( favicon );
		} );
		await expect.poll( () => readCachedFavicon( fixture, legacyUrl ) ).toBe( brandedHash );
	} finally {
		await legacyPage.close();
	}
}

/**
 * Enables real packaged protection with a fresh allowance scope when requested.
 * @param fixture - Disposable extension whose stored configuration should change.
 * @param scopeId - Scope separating a later interruption from an earlier allowance.
 * @return Promise resolved once the browser has installed its navigation rules.
 * @since 0.1.0 Initial implementation.
 */
async function enableProtection( fixture: FaviconTestFixture, scopeId = 'scope_default' ): Promise<void> {
	await fixture.worker.evaluate( async ( scope ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

		await chrome.storage.local.set( {
			'tocus.protection.configuration.v1': {
				schemaVersion: 4,
				sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: scope } } ],
				timingConfiguration: { initialWaitMilliseconds: 10000, ladderIncreaseMilliseconds: 5000, maximumWaitMilliseconds: 60000, allowanceMilliseconds: 300000, completionAction: 'show-continue' },
				schedulesByScope: { scope_default: { mode: 'always' }, [ scope ]: { mode: 'always' } },
				measurementRevisionsByScope: { scope_default: 'revision_packaged_favicon', [ scope ]: 'revision_packaged_favicon' },
			},
		} );
	}, scopeId );
	await expect.poll( () => fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
	} ) ).toBeGreaterThan( 0 );
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

describe( 'packaged Chrome favicon preservation', () => {
	test.each( [ false, true ] )( 'preserves a website favicon through pause and Continue with legacy bookmark state: %s', async ( legacyState ) => {
		const fixture = await createFixture();
		const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );

		try {
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
			await enableProtection( fixture );
			const pause = await openReadyPause( fixture );
			const continueButton = pause.getByRole( 'button', { name: 'Continue', exact: true } );

			// Ready follows the real ten-second pause, leaving Chrome time to persist favicon updates.
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
			await continueButton.click();
			await pause.waitForURL( fixture.siteUrl, { timeout: 5_000 } );
			expect( await pause.getByRole( 'heading', { name: 'Original website' } ).isVisible() ).toBe( true );
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		} finally {
			await fixture.context.close();
			fixture.server.close();
			await rm( fixture.directory, { recursive: true, force: true } );
		}
	}, 30_000 );

	test( 'relearns a contaminated website favicon after Continue and preserves it at the next pause', async () => {
		const fixture = await createFixture();
		const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );

		try {
			await seedLegacyFavicon( fixture );
			const brandedHash = await readImageHash( fixture.reader, `${ fixture.extensionRoot }icons/tab-dark.png` );

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
			const legacyPause = await openReadyPause( fixture );

			expect( legacyPause.url() ).toBe( `${ fixture.extensionRoot }interruption.html` );
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( brandedHash );
			await legacyPause.getByRole( 'button', { name: 'Continue', exact: true } ).click();
			await legacyPause.waitForURL( fixture.siteUrl, { timeout: 5_000 } );
			await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
			await legacyPause.close();

			await enableProtection( fixture, 'scope_revisit' );
			await openReadyPause( fixture );
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		} finally {
			await fixture.context.close();
			fixture.server.close();
			await rm( fixture.directory, { recursive: true, force: true } );
		}
	}, 45_000 );
} );
