import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer-core';

const executeFile = promisify( execFile );

/**
 * Resolves a required installed product without falling back to a different browser.
 * @param {string} product - Chrome or Edge installation to exercise.
 * @return {string} Installed browser executable.
 */
function installedExecutable( product ) {
	if ( product !== 'chrome' && product !== 'edge' ) {
		throw new Error( `Unsupported installed Chromium product: ${ product }` );
	}
	const executable = product === 'chrome'
		? process.env.CHROME_EXECUTABLE_PATH ?? ( process.platform === 'darwin'
			? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/opt/google/chrome/chrome' )
		: process.env.EDGE_EXECUTABLE_PATH ?? ( process.platform === 'darwin'
			? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' : '/opt/microsoft/msedge/msedge' );
	if ( ! existsSync( executable ) ) {
		throw new Error( `The required installed ${ product } browser is missing: ${ executable }` );
	}
	return executable;
}

/**
 * Installs the untouched production artifact into the actual Chrome or Edge browser.
 * @param {string} directory - Temporary directory owned by this test.
 * @param {string} product - Required installed browser, chrome or edge.
 * @return {Promise<object>} Real browser views, native consent, and cleanup commands.
 * @since 1.0.1
 */
export async function launchNativeChromium( directory, product ) {
	const profile = join( directory, 'profile' );
	const extensionPath = join( directory, 'extension' );
	let browser;
	let extension;
	let extensionId;
	let popup;
	let closed;
	const errors = [];
	const permissionDecisions = [];
	const observedPages = new WeakSet();

	/**
	 * Collects errors from unchanged production extension documents only.
	 * @param {import('puppeteer-core').Page} page - Browser page to observe.
	 */
	function observePage( page ) {
		if ( observedPages.has( page ) ) {
			return;
		}
		observedPages.add( page );
		page.on( 'pageerror', ( error ) => {
			if ( page.url().startsWith( `chrome-extension://${ extensionId }/` ) ) {
				errors.push( { url: page.url(), message: error.message } );
			}
		} );
	}

	/**
	 * Produces a URL in the actual installed extension origin.
	 * @param {string} path - Extension document path.
	 * @return {string} Installed extension URL.
	 */
	function extensionUrl( path ) {
		return `chrome-extension://${ extensionId }/${ path }`;
	}

	/**
	 * Resolves the visible tab without requiring optional access to website URLs.
	 * @return {Promise<import('puppeteer-core').Page>} Actual selected document.
	 */
	async function selectedPage() {
		const deadline = Date.now() + 10_000;
		do {
			for ( const page of await browser.pages() ) {
				if ( page.url() === extensionUrl( 'popup.html' ) || page.isClosed() ) {
					continue;
				}
				try {
					if ( await page.evaluate( () => globalThis.document.visibilityState === 'visible' ) ) {
						return page;
					}
				} catch ( error ) {
					if ( ! page.isClosed() && ! error.message.includes( 'Execution context was destroyed' ) ) {
						throw error;
					}
				}
			}
			await delay( 50 );
		} while ( Date.now() < deadline );
		throw new Error( 'The installed browser has no visible selected tab.' );
	}

	/**
	 * Resolves one installed extension view without changing browser focus.
	 * @param {string} view - Selected, popup, or onboarding view.
	 * @return {Promise<import('puppeteer-core').Page>} Real document page.
	 */
	async function pageForView( view ) {
		if ( view === 'selected' ) {
			return selectedPage();
		}
		if ( view === 'popup' ) {
			if ( ! popup || popup.isClosed() ) {
				throw new Error( 'The native browser action popup is closed.' );
			}
			return popup;
		}
		if ( view === 'onboarding' ) {
			const target = await browser.waitForTarget( ( candidate ) => candidate.url() === extensionUrl( 'onboarding.html' ), { timeout: 10_000 } );
			return target.asPage();
		}
		throw new Error( `Unknown installed browser view: ${ view }` );
	}

	/**
	 * Executes observation code against the unmodified native extension API.
	 * @param {string} view - Real browser view to inspect.
	 * @param {string} script - JavaScript function body.
	 * @param {unknown[]} [args] - Serializable function arguments.
	 * @return {Promise<unknown>} Observed result.
	 */
	async function viewScript( view, script, args = [] ) {
		const page = await pageForView( view );
		return page.evaluate( `(function() { const browser = globalThis.browser ?? globalThis.chrome; ${ script } }).apply(null, ${ JSON.stringify( args ) })` );
	}

	/**
	 * Clicks a real visible element through browser input with trusted user activation.
	 * @param {string} view - Real browser view.
	 * @param {string} selector - Element CSS selector.
	 * @return {Promise<void>} Completion of the input operation.
	 */
	async function viewClick( view, selector ) {
		await ( await pageForView( view ) ).locator( selector ).click();
	}

	/**
	 * Types actual keyboard text into a visible form control.
	 * @param {string} view - Real browser view.
	 * @param {string} selector - Input CSS selector.
	 * @param {string} text - Characters to enter.
	 * @return {Promise<void>} Completion of the keyboard operation.
	 */
	async function viewType( view, selector, text ) {
		const page = await pageForView( view );
		await page.waitForSelector( selector, { visible: true } );
		await page.type( selector, text );
	}

	/**
	 * Sends real keyboard input to one focused browser control.
	 * @param {string} view - Real browser view.
	 * @param {string} selector - Control CSS selector.
	 * @param {string} key - Puppeteer key name or platform-neutral select-all shortcut.
	 * @return {Promise<void>} Completion of native keyboard input.
	 */
	async function viewKey( view, selector, key ) {
		const page = await pageForView( view );
		await page.waitForSelector( selector, { visible: true } );
		await page.focus( selector );
		if ( key === 'ControlOrMeta+A' ) {
			const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
			await page.keyboard.down( modifier );
			await page.keyboard.press( 'KeyA' );
			await page.keyboard.up( modifier );
		} else {
			await page.keyboard.press( key );
		}
	}

	/**
	 * Opens and selects a real tab through the installed browser.
	 * @param {string} url - Destination URL.
	 * @return {Promise<void>} Completion of initial navigation.
	 */
	async function openPage( url ) {
		const page = await browser.newPage();
		await page.bringToFront();
		await page.goto( url );
	}

	/**
	 * Starts same-tab navigation without waiting for a deliberately delayed server.
	 * @param {string} url - Destination URL.
	 * @return {Promise<void>} Completion of the native navigation command.
	 */
	async function navigate( url ) {
		const page = await selectedPage();
		await page.evaluate( ( destination ) => {
			globalThis.location.href = destination;
		}, url );
	}

	/**
	 * Reads the selected tab's actual document URL during and after navigation.
	 * @return {Promise<string>} Browser-reported current URL.
	 */
	async function currentUrl() {
		return ( await selectedPage() ).url();
	}

	/** Reloads the selected real tab. */
	async function reload() {
		await ( await selectedPage() ).reload();
	}

	/** Closes the selected real tab without changing any other browser session. */
	async function closePage() {
		await ( await selectedPage() ).close();
	}

	/**
	 * Activates the genuine action and verifies its browser-owned POPUP context.
	 * @return {Promise<void>} Completion when the native popup becomes visible.
	 */
	async function openPopup() {
		const site = await selectedPage();
		await site.bringToFront();
		await site.triggerExtensionAction( extension );
		const target = await browser.waitForTarget( ( candidate ) =>
			candidate.url() === extensionUrl( 'popup.html' ), { timeout: 10_000 } );
		popup = await target.asPage();
		await popup.waitForSelector( '.popup-view', { visible: true } );
		const contexts = await popup.evaluate( () => globalThis.chrome.runtime.getContexts( {
			documentUrls: [ globalThis.location.href ],
		} ) );
		if ( contexts.length !== 1 || contexts[ 0 ].contextType !== 'POPUP' || contexts[ 0 ].tabId !== -1 ) {
			throw new Error( `The browser did not open a native action popup: ${ JSON.stringify( contexts ) }` );
		}
	}

	/** Closes the native action popup using focus on the selected browser tab. */
	async function closePopup() {
		await ( await selectedPage() ).bringToFront();
	}

	/**
	 * Chooses an enabled native permission button belonging only to this test browser.
	 * @param {boolean} allow - True selects Allow, false selects Cancel or Deny.
	 * @return {Promise<object>} Native control evidence, including the selected label.
	 */
	async function consent( allow ) {
		const pid = browser.process()?.pid;
		if ( ! pid ) {
			throw new Error( 'Native consent requires the PID of the owned browser process.' );
		}
		const decision = allow ? 'allow' : 'deny';
		if ( process.platform !== 'linux' ) {
			throw new Error( 'Reproducible native Chromium consent requires Linux with the checked-in AT-SPI, D-Bus, and Xvfb setup.' );
		}
		const result = await executeFile( process.env.NATIVE_BROWSER_PYTHON ?? '/usr/bin/python3', [
			fileURLToPath( new URL( './linux-consent.py', import.meta.url ) ), String( pid ), decision ], { timeout: 20_000 } );
		const evidence = JSON.parse( result.stdout.trim() );
		permissionDecisions.push( evidence );
		return evidence;
	}

	/**
	 * Stops only this disposable browser and removes its owned files.
	 * @return {Promise<void>} Idempotent browser cleanup.
	 */
	function close() {
		closed ??= ( async () => {
			const deadline = setTimeout( () => browser?.process()?.kill( 'SIGKILL' ), 5_000 );
			try {
				await browser?.close();
			} finally {
				clearTimeout( deadline );
				await rm( profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 } );
				await rm( extensionPath, { recursive: true, force: true } );
			}
		} )();
		return closed;
	}

	try {
		const executablePath = installedExecutable( product );
		await cp( fileURLToPath( new URL( `../../../../.output/${ product }-mv3/`, import.meta.url ) ), extensionPath, { recursive: true } );
		browser = await puppeteer.launch( {
			executablePath, userDataDir: profile, headless: false, defaultViewport: null,
			enableExtensions: true, pipe: true, timeout: 15_000,
			args: [ '--enable-unsafe-extension-debugging', '--disable-crash-reporter', '--lang=en-US', '--force-renderer-accessibility',
				...( process.env.CI ? [ '--no-sandbox' ] : [] ) ],
		} );
		browser.on( 'targetcreated', ( target ) => {
			if ( target.type() === 'page' ) {
				void target.asPage().then( observePage ).catch( ( error ) => {
					if ( ! error.message.includes( 'Target closed' ) ) {
						errors.push( { url: target.url(), message: `Page observation failed: ${ error.message }` } );
					}
				} );
			}
		} );
		extensionId = await browser.installExtension( extensionPath );
		extension = ( await browser.extensions() ).get( extensionId );
		await browser.waitForTarget( ( candidate ) => candidate.url() === extensionUrl( 'onboarding.html' ), { timeout: 10_000 } );
		return {
			browser, extensionId, version: await browser.version(), errors, permissionDecisions, extensionUrl,
			openPage, navigate, currentUrl, reload, closePage, openPopup, closePopup, consent,
			viewScript, viewClick, viewType, viewKey, close,
		};
	} catch ( error ) {
		await close();
		throw error;
	}
}
