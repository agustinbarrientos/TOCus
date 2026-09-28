import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';
import puppeteer from 'puppeteer-core';

/**
 * Resolves installed product executables without using any existing browser profile.
 * @param {string} product - Installed browser product.
 * @return {string} Platform-specific browser executable.
 */
function installedExecutable( product ) {
	if ( product === 'chrome' ) {
		return process.env.CHROME_EXECUTABLE_PATH ?? ( process.platform === 'darwin'
			? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
			: process.platform === 'win32'
				? join( process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe' )
				: '/opt/google/chrome/chrome' );
	}
	return process.env.EDGE_EXECUTABLE_PATH ?? ( process.platform === 'darwin'
		? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
		: process.platform === 'win32'
			? join( process.env[ 'PROGRAMFILES(X86)' ] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe' )
			: '/opt/microsoft/msedge/msedge' );
}

const browsers = [
	{ name: 'installed Google Chrome', executable: installedExecutable( 'chrome' ), build: 'chrome-mv3', installed: true },
	{ name: 'installed Microsoft Edge', executable: installedExecutable( 'edge' ), build: 'edge-mv3', installed: true },
	{ name: 'bundled Chromium fallback with Chrome artifact', executable: chromium.executablePath(), build: 'chrome-mv3', installed: false },
	{ name: 'bundled Chromium fallback with Edge artifact', executable: chromium.executablePath(), build: 'edge-mv3', installed: false },
];

/**
 * Serves a synthetic site over a real loopback connection for the active-tab journey.
 * @param {import('node:http').Server} server - Disposable HTTP server.
 * @return {Promise<string>} URL owned by this test.
 */
async function listen( server ) {
	await new Promise( ( resolve ) => server.listen( 0, '127.0.0.1', resolve ) );
	return `http://127.0.0.1:${ server.address().port }/toolbar-check`;
}

/**
 * Activates the installed toolbar action and proves the document is a native popup.
 * @param {import('puppeteer-core').Browser} browser - Isolated headed browser.
 * @param {import('puppeteer-core').Page} site - Real active website.
 * @param {import('puppeteer-core').Extension} extension - Installed production extension.
 * @param {string[]} errors - Collected production page errors.
 * @return {Promise<import('puppeteer-core').Page>} Native action popup.
 */
async function openToolbarPopup( browser, site, extension, errors ) {
	await site.bringToFront();
	await site.triggerExtensionAction( extension );
	const target = await browser.waitForTarget( ( candidate ) =>
		candidate.url() === `chrome-extension://${ extension.id }/popup.html`, { timeout: 10_000 } );
	const popup = await target.asPage();
	popup.on( 'pageerror', ( error ) => errors.push( error.message ) );
	await popup.waitForSelector( '.popup-view', { visible: true } );
	const contexts = await popup.evaluate( () => globalThis.chrome.runtime.getContexts( {
		documentUrls: [ globalThis.location.href ],
	} ) );
	expect( contexts ).toHaveLength( 1 );
	expect( contexts[ 0 ].contextType ).toBe( 'POPUP' );
	expect( contexts[ 0 ].tabId ).toBe( -1 );
	return popup;
}

/**
 * Captures browser-sized bounds and visible content without changing the popup viewport.
 * @param {import('puppeteer-core').Page} popup - Native popup whose size is owned by the browser.
 * @return {Promise<object>} Popup geometry and current-site evidence.
 */
async function measurePopup( popup ) {
	return popup.evaluate( () => {
		const { document, innerWidth, innerHeight } = globalThis;
		return {
			width: innerWidth,
			height: innerHeight,
			bodyWidth: document.body.getBoundingClientRect().width,
			scrollWidth: document.documentElement.scrollWidth,
			site: document.querySelector( '.popup-site-host' )?.textContent,
			text: document.body.innerText,
			links: Array.from( document.querySelectorAll( '.popup-footer a' ), ( link ) => {
				const bounds = link.getBoundingClientRect();
				return { text: link.textContent.trim(), href: link.href,
					x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom,
					width: bounds.width, height: bounds.height };
			} ),
		};
	} );
}

for ( const product of browsers ) {
	test( `${ product.name }: native toolbar popup has usable dimensions, reads the current site, and opens navigation`, async () => {
		test.skip( product.installed && ! existsSync( product.executable ),
			`${ product.name } is not installed; bundled Chromium coverage is reported separately.` );
		test.setTimeout( 60_000 );
		const testInfo = test.info();
		const directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-toolbar-' ) );
		const errors = [];
		let browser;
		let popup;
		let geometry;
		let version;
		const server = createServer( ( request, response ) => {
			response.writeHead( 200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } );
			response.end(
				'<!doctype html><html lang="en"><title>Toolbar test website</title><h1>Toolbar test website</h1></html>',
			);
		} );
		try {
			const destination = await listen( server );
			const extensionPath = join( directory, 'extension' );
			await cp( fileURLToPath( new URL( `../../../.output/${ product.build }/`, import.meta.url ) ),
				extensionPath,
				{ recursive: true } );
			const manifest = JSON.parse( await readFile( join( extensionPath, 'manifest.json' ), 'utf8' ) );
			expect( manifest.permissions ).not.toContain( 'tabs' );
			expect( manifest.permissions ).not.toContain( 'history' );
			// Production manifests, permissions, scripts, and styles are installed without modification.
			browser = await puppeteer.launch( {
				executablePath: product.executable,
				userDataDir: join( directory, 'profile' ),
				headless: false,
				defaultViewport: null,
				enableExtensions: true,
				pipe: true,
				timeout: 15_000,
				args: [ '--enable-unsafe-extension-debugging', '--disable-crash-reporter', '--lang=en-US',
					...( process.env.CI ? [ '--no-sandbox' ] : [] ) ],
			} );
			version = await browser.version();
			testInfo.annotations.push( { type: 'browser', description: `${ product.name }: ${ version }` } );
			const extensionId = await browser.installExtension( extensionPath );
			const extension = ( await browser.extensions() ).get( extensionId );
			expect( extension ).toBeDefined();
			// First installation opens onboarding asynchronously and can otherwise steal active-tab focus.
			await browser.waitForTarget( ( target ) =>
				target.url() === `chrome-extension://${ extensionId }/onboarding.html`, { timeout: 10_000 } );
			const site = await browser.newPage();
			await site.goto( destination );
			popup = await openToolbarPopup( browser, site, extension, errors );
			geometry = await measurePopup( popup );
			await testInfo.attach( 'native-toolbar-popup', { body: await popup.screenshot(), contentType: 'image/png' } );
			expect( geometry.width ).toBe( 352 );
			expect( geometry.bodyWidth ).toBe( 352 );
			expect( geometry.height ).toBeGreaterThan( 250 );
			expect( geometry.height ).toBeLessThan( 600 );
			expect( geometry.scrollWidth ).toBeLessThanOrEqual( geometry.width );
			expect( geometry.site ).toBe( '127.0.0.1' );
			expect( geometry.text ).toContain( 'Pause site' );
			expect( geometry.links.map( ( link ) => link.text ) ).toEqual( [ 'Statistics', 'Settings' ] );
			for ( const link of geometry.links ) {
				expect( link.width ).toBeGreaterThan( 50 );
				expect( link.height ).toBeGreaterThan( 15 );
				expect( link.x ).toBeGreaterThanOrEqual( 0 );
				expect( link.y ).toBeGreaterThanOrEqual( 0 );
				expect( link.right ).toBeLessThanOrEqual( geometry.width );
				// Native popup windows round their fractional CSS height to device-independent pixels.
				expect( link.bottom ).toBeLessThanOrEqual( geometry.height + 1 );
			}
			for ( const navigation of [
				{ label: 'Settings', route: 'protected-sites', heading: 'Websites' },
				{ label: 'Statistics', route: 'statistics', heading: 'Statistics' },
			] ) {
				await test.step( `Open ${ navigation.label } from the native popup`, async () => {
					if ( popup.isClosed() ) {
						popup = await openToolbarPopup( browser, site, extension, errors );
					}
					const destinationUrl = `chrome-extension://${ extensionId }/options.html#${ navigation.route }`;
					await popup.locator( `a[href="${ destinationUrl }"]` ).click();
					const target = await browser.waitForTarget( ( candidate ) => candidate.url() === destinationUrl );
					const settings = await target.asPage();
					settings.on( 'pageerror', ( error ) => errors.push( error.message ) );
					await settings.waitForSelector( 'h1', { visible: true } );
					await expect.poll( () => settings.$eval( 'h1', ( heading ) => heading.textContent ) )
						.toBe( navigation.heading );
					await settings.close();
				} );
			}
			expect( errors ).toEqual( [] );
		} finally {
			await testInfo.attach( 'toolbar-diagnostics', {
				body: JSON.stringify( {
					product: product.name, executable: product.executable, build: product.build,
					version, geometry, errors,
				}, null, 2 ),
				contentType: 'application/json',
			} );
			try {
				await browser?.close();
			} finally {
				server.closeAllConnections();
				await new Promise( ( resolve ) => server.close( resolve ) );
				await rm( directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 } );
			}
		}
	} );
}
