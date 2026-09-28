import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchFirefox } from './firefox.mjs';
import { launchNativeChromium } from './chromium.mjs';

export { expect, test };

const transientViewErrors = new RegExp( [
	"Actor 'MarionetteCommands' destroyed before query", 'Execution context was destroyed',
	'Cannot find context with specified id', 'view is unavailable', 'Popup is unavailable',
].join( '|' ), 'iu' );

/**
 * Observes a document, tolerating only transient document replacement during navigation.
 * @param {object} browser - Installed browser driver.
 * @param {string} view - Selected page, popup, or onboarding.
 * @param {string} script - Read-only script body.
 * @return {Promise<unknown>} Observation, or undefined while the view is replaced.
 * @since 1.0.1
 */
export async function readView( browser, view, script ) {
	try {
		return await browser.viewScript( view, script );
	} catch ( error ) {
		if ( transientViewErrors.test( error.message ) ) {
			return undefined;
		}
		throw error;
	}
}

/**
 * Reads real stored protection and native grants without changing either.
 * @param {object} browser - Installed browser driver.
 * @param {string} [view] - An extension view.
 * @return {Promise<object>} Persisted sites, grants and active redirect count.
 * @since 1.0.1
 */
export function protectionState( browser, view = 'selected' ) {
	return readView( browser, view, `return Promise.all([
		browser.permissions.getAll(), browser.storage.local.get('tocus.protection.configuration.v1'),
		browser.declarativeNetRequest.getDynamicRules()
	]).then(([permissions, stored, rules]) => ({
		origins: permissions.origins.sort(), navigation: permissions.permissions.includes('webNavigation'),
		sites: stored['tocus.protection.configuration.v1']?.sites.map(site => site.identityHost) ?? [], rules: rules.length
	}));` );
}

/**
 * Runs a journey against an unchanged build and a real local HTTP server.
 * @param {(browser: object, url: string, network: object) => Promise<void>} run - User journey.
 * @since 1.0.1
 */
export async function withBrowser( run ) {
	const product = test.info().project.name;
	const directory = await mkdtemp( join( tmpdir(), `tocus-installed-${ product }-` ) );
	const requests = new Map();
	const pending = new Set();
	const html = `<!doctype html><meta charset="utf-8"><title>Protected destination</title>
		<link rel="icon" href="/favicon.svg"><h1>Protected destination</h1>
		<input aria-label="Preserved text"><a id="redirect" href="/redirect">Redirect</a>
		<a id="next" href="/next">Next</a><a id="new-tab" href="/new" target="_blank">New tab</a>
		<button id="play" onclick="document.querySelector('video').play()">Play video</button>
		<video loop muted src="/media.wav"></video>`;
	// A real PCM track exercises native media playback without external codecs or downloads.
	const wave = Buffer.alloc( 44 + 8000 * 2 );
	wave.write( 'RIFF', 0 ); wave.writeUInt32LE( wave.length - 8, 4 ); wave.write( 'WAVEfmt ', 8 );
	wave.writeUInt32LE( 16, 16 ); wave.writeUInt16LE( 1, 20 ); wave.writeUInt16LE( 1, 22 );
	wave.writeUInt32LE( 8000, 24 ); wave.writeUInt32LE( 16000, 28 ); wave.writeUInt16LE( 2, 32 );
	wave.writeUInt16LE( 16, 34 ); wave.write( 'data', 36 ); wave.writeUInt32LE( wave.length - 44, 40 );
	for ( let i = 44; i < wave.length; i += 2 ) {
		wave.writeInt16LE( Math.round( Math.sin( i / 16 ) * 1000 ), i );
	}
	const server = createServer( ( request, response ) => {
		const path = request.url;
		requests.set( path, ( requests.get( path ) ?? 0 ) + 1 );
		if ( path === '/redirect' ) {
			response.writeHead( 302, { Location: '/redirected' } ).end();
		} else if ( path === '/favicon.svg' ) {
			response.writeHead( 200, { 'Content-Type': 'image/svg+xml' } ).end( '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="green"/></svg>' );
		} else if ( path === '/media.wav' ) {
			response.writeHead( 200, { 'Content-Type': 'audio/wav', 'Content-Length': wave.length } ).end( wave );
		} else {
			response.writeHead( 200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store',
				...( path === '/strict' ? { 'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'none'; font-src 'none'" } : {} ) } );
			if ( path === '/slow' ) {
				pending.add( response );
			} else {
				response.end( html );
			}
		}
	} );
	/** Releases responses held for the pending-navigation regression. */
	const release = () => {
		for ( const response of pending ) {
			response.end( html );
		}
		pending.clear();
	};
	/**
	 * Counts requests that reached the real server for one exact path.
	 * @param {string} path - HTTP request path.
	 * @return {number} Actual network request count.
	 */
	const countRequests = ( path ) => requests.get( path ) ?? 0;
	let browser;
	let failure;
	try {
		await new Promise( ( resolve ) => server.listen( 0, '127.0.0.1', resolve ) );
		browser = product === 'firefox' ? await launchFirefox( directory ) : await launchNativeChromium( directory, product );
		await test.info().attach( 'installed-browser', { body: `${ product }: ${ browser.version }`, contentType: 'text/plain' } );
		await run( browser, `http://127.0.0.1:${ server.address().port }/`, { requests: countRequests, release } );
	} catch ( error ) {
		failure = error;
	} finally {
		release();
		try {
			if ( browser ) {
				const diagnostics = browser.diagnostics ? await browser.diagnostics() : {
					errors: browser.errors ?? [], permissionDecisions: browser.permissionDecisions ?? [],
				};
				await test.info().attach( 'installed-browser-diagnostics', {
					body: JSON.stringify( diagnostics, null, 2 ), contentType: 'application/json',
				} );
				if ( ! failure ) {
					expect( diagnostics.errors ).toEqual( [] );
				}
			}
		} catch ( error ) {
			failure ??= error;
		}
		try {
			await browser?.close();
		} catch ( error ) {
			failure ??= error;
		}
		server.closeAllConnections();
		await new Promise( ( resolve ) => server.close( resolve ) );
		try {
			await rm( directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 } );
		} catch ( error ) {
			failure ??= error;
		}
	}
	if ( failure ) {
		throw failure;
	}
}

/**
 * Opens the native toolbar and waits for its real current-site result.
 * @param {object} browser - Installed browser driver.
 * @since 1.0.1
 */
export async function openPopup( browser ) {
	await browser.openPopup();
	await expect.poll( () => readView( browser, 'popup', 'return document.querySelector(".popup-site-host")?.textContent;' ) ).toBe( '127.0.0.1' );
}

/**
 * Reopens an action popup only when a native permission prompt dismissed it.
 * @param {object} browser - Installed browser driver.
 * @since 1.0.1
 */
export async function ensurePopup( browser ) {
	if ( ! await browser.isPopupOpen() ) {
		await openPopup( browser );
	}
}

/**
 * Protects the local destination through the real toolbar and native Allow decision.
 * @param {object} browser - Installed browser driver.
 * @param {string} url - Actual local destination.
 * @since 1.0.1
 */
export async function enroll( browser, url ) {
	await browser.openPage( url );
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
	await openPopup( browser );
	await browser.viewClick( 'popup', 'button' );
	await browser.consent( true );
	await expect.poll( () => protectionState( browser, 'onboarding' ) ).toEqual( { origins: [ '*://127.0.0.1/*' ], navigation: true, sites: [ '127.0.0.1' ], rules: 1 } );
	await browser.closePopup();
}

/**
 * Opens an actual Settings route in the selected tab.
 * @param {object} browser - Installed browser driver.
 * @param {string} route - Settings route fragment.
 * @since 1.0.1
 */
export async function settings( browser, route ) {
	await browser.openPage( browser.extensionUrl( `options.html#${ route }` ) );
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent?.length > 0;' ) ).toBe( true );
}

/**
 * Clicks a displayed button with an exact label using native pointer input.
 * @param {object} browser - Installed browser driver.
 * @param {string} label - Exact visible label.
 * @param {string} [scope] - Selector limiting the search.
 * @since 1.0.1
 */
export async function clickButton( browser, label, scope = 'body' ) {
	const selector = await browser.viewScript( 'selected', `const nodes = [...document.querySelector(arguments[0]).querySelectorAll('button')];
		const node = nodes.find(button => button.textContent.trim() === arguments[1]);
		if (!node) throw new Error('Missing button: ' + arguments[1]);
		node.setAttribute('data-native-test-target', 'click'); return '[data-native-test-target="click"]';`, [ scope, label ] );
	await browser.viewClick( 'selected', selector );
	await browser.viewScript( 'selected', 'document.querySelector("[data-native-test-target]")?.removeAttribute("data-native-test-target");' ).catch( () => {
		// Navigation can replace the clicked document before its locator marker is removed.
	} );
}

/**
 * Replaces a field using native keyboard input.
 * @param {object} browser - Installed browser driver.
 * @param {string} selector - Field selector.
 * @param {string} value - New text.
 * @since 1.0.1
 */
export async function fill( browser, selector, value ) {
	await browser.viewKey( 'selected', selector, 'ControlOrMeta+A' );
	await browser.viewKey( 'selected', selector, 'Backspace' );
	await browser.viewType( 'selected', selector, value );
}

/**
 * Changes a native select through its focused keyboard selection.
 * @param {object} browser - Installed browser driver.
 * @param {string} selector - Select selector.
 * @param {string} value - Exact option value.
 * @since 1.0.1
 */
export async function setSelect( browser, selector, value ) {
	if ( browser.viewSelect ) {
		await browser.viewSelect( 'selected', selector, value );
	} else {
		const index = await browser.viewScript( 'selected', `return [...document.querySelector(arguments[0]).options]
			.filter(option => !option.disabled).findIndex(option => option.value === arguments[1]);`, [ selector, value ] );
		if ( index < 0 ) {
			throw new Error( `Missing select option ${ value }` );
		}
		await browser.viewKey( 'selected', selector, 'Home' );
		for ( let position = 0; position < index; position += 1 ) {
			await browser.viewKey( 'selected', selector, 'ArrowDown' );
		}
		await browser.viewKey( 'selected', selector, 'Enter' );
	}
	await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector(arguments[0]).value;', [ selector ] ) ).toBe( value );
}

/**
 * Waits for and activates Continue on the real interruption document.
 * @param {object} browser - Installed browser driver.
 * @since 1.0.1
 */
export async function continuePause( browser ) {
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector(\'tocus-f-interruption-screen\')?.shadowRoot?.querySelector(\'button\')?.textContent;' ), { timeout: 30_000 } ).toBe( 'Continue' );
	await browser.viewClick( 'selected', 'tocus-f-interruption-screen >>> button' );
}
