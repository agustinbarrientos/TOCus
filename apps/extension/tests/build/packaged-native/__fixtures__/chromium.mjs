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
 * @param {object} [options] - Optional real-network fixture routing.
 * @param {string} [options.hostname] - Exact fixture host to resolve to loopback in this browser only.
 * @param {boolean} [options.https] - Whether the owned loopback server uses a disposable test certificate.
 * @return {Promise<object>} Real browser views, native consent, and cleanup commands.
 * @since 1.0.1
 */
export async function launchNativeChromium( directory, product, options = {} ) {
	const profile = join( directory, 'profile' );
	const extensionPath = join( directory, 'extension' );
	let browser;
	let extension;
	let extensionId;
	let popup;
	let closed;
	const errors = [];
	const permissionDecisions = [];
	const observations = new Map();
	const pendingExceptions = [];
	const tabPages = new Map();

	/**
	 * Bounds individual native commands without changing explicit real-time expiry polling.
	 * @param {import('puppeteer-core').Page} page - Actual page whose command deadlines are configured.
	 * @return {import('puppeteer-core').Page} The same page with bounded test waits.
	 */
	function configurePage( page ) {
		page.setDefaultTimeout( 15_000 );
		page.setDefaultNavigationTimeout( 15_000 );
		return page;
	}

	/**
	 * Collects script locations across synchronous and asynchronous exception stacks.
	 * @param {object | undefined} stack - Protocol stack trace, including optional parent stacks.
	 * @return {string[]} Script URLs reported by the actual runtime.
	 */
	function stackSources( stack ) {
		return stack ? [ ...stack.callFrames.map( ( frame ) => frame.url ), ...stackSources( stack.parent ) ] : [];
	}

	/**
	 * Records only exceptions whose actual script source belongs to this installed artifact.
	 * @param {object} details - Native Runtime.exceptionThrown exception details.
	 * @param {string} targetUrl - Browser document or worker that reported the exception.
	 */
	function recordException( details, targetUrl ) {
		if ( ! extensionId ) {
			pendingExceptions.push( { details, targetUrl } );
			return;
		}
		const source = [ details.url, ...stackSources( details.stackTrace ) ]
			.find( ( url ) => url?.startsWith( extensionUrl( '' ) ) );
		if ( source ) {
			errors.push( { url: source, targetUrl, message: details.exception?.description ?? details.text,
				line: details.lineNumber + 1, column: details.columnNumber + 1 } );
		}
	}

	/**
	 * Observes uncaught runtime errors in real pages, isolated content worlds, and workers.
	 * @param {import('puppeteer-core').Target} target - Actual browser page or service-worker target.
	 * @return {Promise<void>} Completion when runtime diagnostics are enabled for the target.
	 */
	function observeTarget( target ) {
		if ( ! observations.has( target ) ) {
			observations.set( target, ( async () => {
				if ( ! [ 'page', 'service_worker' ].includes( target.type() ) ) {
					return;
				}
				try {
					const session = await target.createCDPSession();
					session.on( 'Runtime.exceptionThrown', ( { exceptionDetails } ) => {
						recordException( exceptionDetails, target.url() );
					} );
					await session.send( 'Runtime.enable' );
				} catch ( error ) {
					errors.push( { url: target.url(), message: `Runtime observation failed: ${ error.message }` } );
				}
			} )() );
		}
		return observations.get( target );
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
	 * Reads the native active tab identity without requiring permission to read its URL.
	 * @return {Promise<object>} Actual active tab metadata.
	 */
	async function activeTab() {
		const target = await browser.waitForTarget( ( candidate ) => candidate.type() === 'service_worker' &&
			candidate.url() === extensionUrl( 'background.js' ), { timeout: 10_000 } );
		const worker = await target.worker();
		const [ tab ] = await worker.evaluate( () => globalThis.chrome.tabs.query( { active: true } ) );
		if ( ! tab ) {
			throw new Error( 'The installed browser has no native active tab.' );
		}
		return tab;
	}

	/**
	 * Resolves actual tab selection without relying on desktop window visibility.
	 * @return {Promise<import('puppeteer-core').Page>} Actual selected document.
	 */
	async function selectedPage() {
		const tab = await activeTab();
		const known = tabPages.get( tab.id );
		if ( known && ! known.isClosed() ) {
			return known;
		}
		const url = tab.url ?? tab.pendingUrl;
		if ( ! url ) {
			throw new Error( `The active native tab has no mapped page: ${ JSON.stringify( tab ) }` );
		}
		const target = await browser.waitForTarget( ( candidate ) =>
			candidate.type() === 'page' && candidate.url() === url, { timeout: 10_000 } );
		const page = configurePage( await target.asPage() );
		await observeTarget( target );
		tabPages.set( tab.id, page );
		return page;
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
			return configurePage( await target.asPage() );
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
		const page = await pageForView( view );
		const deadline = Date.now() + 15_000;
		let readiness;
		do {
			const element = await page.locator( selector )
				.setTimeout( Math.max( 1, deadline - Date.now() ) ).waitHandle();
			try {
				if ( ! await element.isIntersectingViewport( { threshold: 1 } ) ) {
					await element.scrollIntoView();
				}
				const point = await element.clickablePoint();
				readiness = await element.evaluate( async ( target, coordinate ) => {
					const before = target.getBoundingClientRect().toJSON();
					await new Promise( ( resolve ) => {
						globalThis.requestAnimationFrame( () => globalThis.requestAnimationFrame( resolve ) );
					} );
					const after = target.getBoundingClientRect().toJSON();
					if ( ! target.isConnected || JSON.stringify( before ) !== JSON.stringify( after ) ) {
						return { ready: false, reason: 'The control is detached or still moving.' };
					}
					if ( target.matches( ':disabled' ) || target.getAttribute( 'aria-disabled' ) === 'true' ) {
						return { ready: false, reason: 'The control is disabled.' };
					}
					let hit = target.ownerDocument.elementFromPoint( coordinate.x, coordinate.y );
					while ( hit?.shadowRoot ) {
						const inner = hit.shadowRoot.elementFromPoint( coordinate.x, coordinate.y );
						if ( ! inner || inner === hit ) {
							break;
						}
						hit = inner;
					}
					let candidate = hit;
					while ( candidate ) {
						if ( candidate === target || target.contains( candidate ) ) {
							return { ready: true };
						}
						candidate = candidate.getRootNode().host;
					}
					return { ready: false, reason: `Click center is covered by ${ hit?.tagName ?? 'no element' }.` };
				}, point );
				if ( readiness.ready ) {
					// Send exactly one trusted click at the same point checked above.
					await page.mouse.click( point.x, point.y );
					return;
				}
			} finally {
				await element.dispose();
			}
			await delay( 50 );
		} while ( Date.now() < deadline );
		throw new Error( `Native click did not become actionable: ${ selector }. ${ readiness?.reason }` );
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
		const page = configurePage( await browser.newPage() );
		await observeTarget( page.target() );
		await page.bringToFront();
		tabPages.set( ( await activeTab() ).id, page );
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
		popup = configurePage( await target.asPage() );
		await observeTarget( target );
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
		if ( isPopupOpen() ) {
			await ( await selectedPage() ).bringToFront();
		}
	}

	/**
	 * Reports whether the genuine action popup survived the latest native prompt.
	 * @return {boolean} Whether this browser's popup document is still open.
	 */
	function isPopupOpen() {
		return Boolean( popup && ! popup.isClosed() );
	}

	/**
	 * Captures each actual document and native consent evidence for CI failures.
	 * @return {Promise<object>} Production errors, native decisions, and browser view state.
	 */
	async function diagnostics() {
		await Promise.all( observations.values() );
		const pages = [];
		for ( const target of browser.targets().filter( ( candidate ) => candidate.type() === 'page' ) ) {
			try {
				// Reuse asPage's cached wrapper; mixing page() and asPage() loses existing execution contexts.
				const page = configurePage( await target.asPage() );
				pages.push( await page.evaluate( () => ( {
					url: globalThis.location.href, visibility: globalThis.document.visibilityState,
					focused: globalThis.document.hasFocus(), ready: globalThis.document.readyState,
					text: globalThis.document.body?.innerText.slice( 0, 2_000 ),
				} ) ) );
			} catch ( error ) {
				pages.push( { url: target.url(), error: error.message } );
			}
		}
		return { errors, permissionDecisions, pages,
			activeTab: await activeTab().catch( ( error ) => ( { error: error.message } ) ),
			popupOpen: isPopupOpen() };
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
		if ( options.hostname && ! /^[a-z0-9.-]+$/u.test( options.hostname ) ) {
			throw new Error( `Invalid loopback fixture hostname: ${ options.hostname }` );
		}
		const executablePath = installedExecutable( product );
		await cp( fileURLToPath( new URL( `../../../../.output/${ product }-mv3/`, import.meta.url ) ), extensionPath, { recursive: true } );
		browser = await puppeteer.launch( {
			executablePath, userDataDir: profile, headless: false, defaultViewport: null,
			acceptInsecureCerts: Boolean( options.hostname && options.https ),
			...( process.platform === 'linux' ? {
				env: { ...process.env, ACCESSIBILITY_ENABLED: '1', NO_AT_BRIDGE: '0' },
			} : {} ),
			enableExtensions: true, pipe: true, timeout: 15_000, protocolTimeout: 15_000,
			args: [ '--enable-unsafe-extension-debugging', '--disable-crash-reporter', '--lang=en-US', '--force-renderer-accessibility',
				...( options.hostname ? [ `--host-resolver-rules=MAP ${ options.hostname } 127.0.0.1` ] : [] ),
				...( process.env.CI ? [ '--no-sandbox' ] : [] ) ],
		} );
		browser.on( 'targetcreated', ( target ) => void observeTarget( target ) );
		extensionId = await browser.installExtension( extensionPath );
		for ( const { details, targetUrl } of pendingExceptions.splice( 0 ) ) {
			recordException( details, targetUrl );
		}
		await Promise.all( observations.values() );
		extension = ( await browser.extensions() ).get( extensionId );
		const onboardingTarget = await browser.waitForTarget( ( candidate ) =>
			candidate.url() === extensionUrl( 'onboarding.html' ), { timeout: 10_000 } );
		const onboarding = configurePage( await onboardingTarget.asPage() );
		await onboarding.bringToFront();
		tabPages.set( ( await activeTab() ).id, onboarding );
		return {
			browser, extensionId, version: await browser.version(), errors, permissionDecisions, extensionUrl,
			openPage, navigate, currentUrl, reload, closePage, openPopup, closePopup, isPopupOpen, consent,
			viewScript, viewClick, viewType, viewKey, diagnostics, close,
		};
	} catch ( error ) {
		await close();
		throw error;
	}
}
