import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { expect, test, firefox as playwrightFirefox } from '@playwright/test';
import puppeteer from 'puppeteer-core';

/**
 * Starts a loopback server on an available port.
 * @return {Promise<number>} Bound port.
 * @param {import('node:http').Server} server - Local HTTP server.
 */
async function listen( server ) {
	await new Promise( ( resolve ) => server.listen( 0, '127.0.0.1', resolve ) );
	return server.address().port;
}

/**
 * Stops only the Firefox process launched with this disposable profile, even if BiDi never connected.
 * @param {string} profile - Unique temporary profile directory.
 */
async function stopMacFirefox( profile ) {
	if ( process.platform !== 'darwin' ) {
		return;
	}
	const processes = execFileSync( '/bin/ps', [ '-axo', 'pid=,command=' ], { encoding: 'utf8' } );
	for ( const line of processes.split( '\n' ) ) {
		const match = line.match( /^\s*(\d+)\s+(.+)$/u );
		if ( ! match || ! match[ 2 ].includes( '/Contents/MacOS/firefox ' ) || ! match[ 2 ].includes( ` -profile ${ profile } ` ) ) {
			continue;
		}
		const pid = Number( match[ 1 ] );
		try {
			process.kill( pid, 'SIGTERM' );
			await expect.poll( () => {
				try {
					process.kill( pid, 0 );
					return false;
				} catch ( error ) {
					return error.code === 'ESRCH';
				}
			} ).toBe( true );
		} catch ( error ) {
			if ( error.code !== 'ESRCH' ) {
				throw error;
			}
		}
	}
}

/**
 * Launches a disposable Firefox profile, using LaunchServices for macOS app-data protection.
 * @return {Promise<import('puppeteer-core').Browser>} Connected test browser.
 * @param {string} profile - Disposable profile directory.
 * @param {string} uuid - Temporary extension document identity.
 */
async function launchFirefox( profile, uuid ) {
	const executablePath = process.env.FIREFOX_EXECUTABLE_PATH ?? playwrightFirefox.executablePath();
	const extraPrefsFirefox = {
		'extensions.webextensions.uuids': JSON.stringify( { 'tocus@agustinbarrientos.com': uuid } ),
		'browser.shell.checkDefaultBrowser': false,
		'browser.startup.homepage_override.mstone': 'ignore',
	};
	if ( process.platform !== 'darwin' ) {
		return puppeteer.launch( {
			browser: 'firefox', executablePath, userDataDir: profile, headless: true,
			args: [ '--remote-allow-system-access' ], extraPrefsFirefox,
		} );
	}
	const portReservation = createServer();
	const port = await listen( portReservation );
	await new Promise( ( resolve ) => portReservation.close( resolve ) );
	await writeFile( join( profile, 'user.js' ), Object.entries( extraPrefsFirefox )
		.map( ( [ key, value ] ) => `user_pref(${ JSON.stringify( key ) }, ${ JSON.stringify( value ) });` ).join( '\n' ) );
	execFileSync( '/usr/bin/open', [
		'-n', '-a', dirname( dirname( dirname( executablePath ) ) ), '--args',
		'-no-remote', '-profile', profile, '--remote-allow-system-access', '--remote-debugging-port', String( port ),
		'about:blank',
	] );
	let browser;
	await expect.poll( async () => {
		try {
			browser = await puppeteer.connect( {
				browserWSEndpoint: `ws://127.0.0.1:${ port }/session`, protocol: 'webDriverBiDi',
			} );
			return true;
		} catch {
			return false;
		}
	}, { timeout: 15_000 } ).toBe( true );
	return browser;
}

/**
 * Uses BiDi's no-wait navigation because Firefox omits extension-page navigation events.
 * @param {import('puppeteer-core').Page} page - Isolated test page.
 * @param {string} url - Test destination.
 */
async function navigate( page, url ) {
	await page.mainFrame().browsingContext.navigate( url, 'none' );
}

test( 'Firefox Continue reaches a slow destination without canceling and restarting it', async () => {
	const testInfo = test.info();
	test.setTimeout( 60_000 );
	const directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-firefox-' ) );
	let browser;
	let destinationRequests = 0;
	let releaseResponse;
	const responseBarrier = new Promise( ( resolve ) => {
		releaseResponse = resolve;
	} );
	const server = createServer( async ( request, response ) => {
		if ( request.url === '/entry' ) {
			destinationRequests += 1;
			await responseBarrier;
		}
		response.writeHead( 200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } );
		response.end( '<!doctype html><title>Destination loaded</title><h1>Destination loaded</h1>' );
	} );
	try {
		const port = await listen( server );
		const destination = `http://127.0.0.1:${ port }/entry`;
		const extensionPath = join( directory, 'extension' );
		await cp( fileURLToPath( new URL( '../../../.output/firefox-mv2/', import.meta.url ) ),
			extensionPath,
			{ recursive: true } );
		const manifestPath = join( extensionPath, 'manifest.json' );
		const manifest = JSON.parse( await readFile( manifestPath, 'utf8' ) );
		expect( manifest.permissions ).not.toContain( 'tabs' );
		expect( manifest.permissions ).not.toContain( 'history' );
		// Only the disposable install grants the synthetic site; production scripts are untouched.
		manifest.permissions.push( 'webNavigation', '*://127.0.0.1/*' );
		await writeFile( manifestPath, JSON.stringify( manifest ) );
		const profile = join( directory, 'profile' );
		await mkdir( profile );
		const uuid = randomUUID();
		browser = await launchFirefox( profile, uuid );
		await browser.installExtension( extensionPath );
		const control = await browser.newPage();
		await navigate( control, `moz-extension://${ uuid }/onboarding.html` );
		await expect.poll( () => control.evaluate( () => typeof globalThis.browser ) ).toBe( 'object' );
		await control.evaluate( async () => {
			const { browser } = globalThis;
			await browser.storage.local.set( {
				'tocus.protection.configuration.v1': {
					schemaVersion: 5,
					sites: [ { identityHost: '127.0.0.1', rule: {
						host: '127.0.0.1', includeSubdomains: false, scopeId: 'scope_default',
					} } ],
					timingConfiguration: {
						initialWaitMilliseconds: 10_000, ladderIncreaseMilliseconds: 5_000,
						maximumWaitMilliseconds: 60_000, allowanceMilliseconds: 300_000, completionAction: 'show-continue',
					},
					schedule: { mode: 'always' }, measurementRevisionsByScope: { scope_default: 'revision_packaged' },
				},
			} );
		} );
		await expect.poll( () => control.evaluate( async () =>
			( await globalThis.browser.declarativeNetRequest.getDynamicRules() ).length ) ).toBe( 1 );
		const page = await browser.newPage();
		await page.bringToFront();
		await navigate( page, destination );
		await expect.poll( () => control.evaluate( () => {
			const view = globalThis.browser.extension.getViews( { type: 'tab' } )
				.find( ( candidate ) => candidate.location.pathname === '/pause.html' );
			return view?.document.querySelector( 'tocus-f-interruption-screen' )?.shadowRoot
				?.querySelector( 'button' )?.textContent;
		} ), { timeout: 20_000 } ).toBe( 'Continue' );
		const tabId = await control.evaluate( async () => {
			const { browser } = globalThis;
			const pauseUrl = browser.runtime.getURL( '/pause.html' );
			const tab = ( await browser.tabs.query( {} ) ).find( ( candidate ) => candidate.url === pauseUrl );
			const view = browser.extension.getViews( { type: 'tab' } ).find( ( candidate ) => candidate.location.href === pauseUrl );
			view.document.querySelector( 'tocus-f-interruption-screen' ).shadowRoot.querySelector( 'button' ).click();
			return tab.id;
		} );
		await expect.poll( () => destinationRequests ).toBeGreaterThan( 0 );
		// Hold a real network response long enough for repeated onBeforeNavigate cancellation to surface.
		await setTimeout( 1_000 );
		expect( destinationRequests ).toBe( 1 );
		const pending = await control.evaluate( ( id ) => globalThis.browser.tabs.get( id ), tabId );
		expect( pending.url ).toBe( `moz-extension://${ uuid }/pause.html` );
		expect( pending.pendingUrl ).toBeUndefined();
		expect( pending.status ).toBe( 'loading' );
		releaseResponse();
		await expect.poll( () => control.evaluate( async ( id ) => {
			const tab = await globalThis.browser.tabs.get( id );
			return { url: tab.url, status: tab.status, title: tab.title };
		}, tabId ) ).toEqual( { url: destination, status: 'complete', title: 'Destination loaded' } );
		expect( destinationRequests ).toBe( 1 );
		await expect.poll( () => control.evaluate( () =>
			globalThis.browser.declarativeNetRequest.getDynamicRules() ) ).toEqual( [] );
	} catch ( error ) {
		await testInfo.attach( 'firefox-diagnostics', {
			body: JSON.stringify( { destinationRequests, error: String( error ) } ), contentType: 'application/json',
		} );
		throw error;
	} finally {
		releaseResponse();
		try {
			await browser?.close();
		} finally {
			await stopMacFirefox( join( directory, 'profile' ) );
			server.closeAllConnections();
			await new Promise( ( resolve ) => server.close( resolve ) );
			await rm( directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 } );
		}
	}
} );
