import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { firefox } from '@playwright/test';
import { start } from 'geckodriver';

/**
 * Selects an available loopback port without sharing the user's browser endpoints.
 * @return {Promise<number>} Available local port.
 */
async function availablePort() {
	const server = createServer();
	await new Promise( ( resolve, reject ) => {
		server.once( 'error', reject );
		server.listen( 0, '127.0.0.1', resolve );
	} );
	const { port } = server.address();
	await new Promise( ( resolve ) => server.close( resolve ) );
	return port;
}

/**
 * Waits for a read-only readiness condition, preserving its last error on failure.
 * @param {() => Promise<unknown>} predicate - Readiness check without mutations.
 * @return {Promise<void>} Resolves when the condition is truthy.
 */
async function waitUntil( predicate ) {
	const deadline = Date.now() + 15_000;
	let lastError;
	do {
		try {
			if ( await predicate() ) {
				return;
			}
		} catch ( error ) {
			lastError = error;
		}
		await delay( 100 );
	} while ( Date.now() < deadline );
	throw new Error( 'Native Firefox did not become ready.', { cause: lastError } );
}

/**
 * Reports whether a process still exists, including after a failed browser handshake.
 * @param {number} pid - Process identity obtained from the owned test browser.
 * @return {boolean} Whether the process is still running.
 */
function isRunning( pid ) {
	try {
		process.kill( pid, 0 );
		return true;
	} catch ( error ) {
		if ( error.code === 'ESRCH' ) {
			return false;
		}
		throw error;
	}
}

/**
 * Terminates one owned process and escalates only when graceful shutdown fails.
 * @param {number} pid - Process belonging to this disposable browser or driver.
 * @return {Promise<void>} Resolves after the process exits.
 */
async function stopProcess( pid ) {
	try {
		if ( ! isRunning( pid ) ) {
			return;
		}
		process.kill( pid, 'SIGTERM' );
		for ( let attempt = 0; attempt < 30 && isRunning( pid ); attempt += 1 ) {
			await delay( 100 );
		}
		if ( isRunning( pid ) ) {
			process.kill( pid, 'SIGKILL' );
			await waitUntil( async () => ! isRunning( pid ) );
		}
	} catch ( error ) {
		if ( error.code !== 'ESRCH' ) {
			throw error;
		}
	}
}

/**
 * Finds only Firefox instances whose command line names this unique profile.
 * @param {string} profile - Disposable profile owned by this fixture.
 * @return {Promise<void>} Resolves after any remaining owned Firefox instance exits.
 */
async function stopProfileFirefox( profile ) {
	if ( process.platform === 'win32' ) {
		return;
	}
	const processes = execFileSync( '/bin/ps', [ '-axo', 'pid=,command=' ], { encoding: 'utf8' } );
	for ( const line of processes.split( '\n' ) ) {
		const match = line.match( /^\s*(\d+)\s+(.+)$/u );
		if ( match && /\/firefox(?:-bin)?\s/u.test( match[ 2 ] ) &&
			` ${ match[ 2 ] } `.includes( ` -profile ${ profile } ` ) ) {
			await stopProcess( Number( match[ 1 ] ) );
		}
	}
}

/**
 * Resolves an extension view inside browser chrome and forwards genuine actor commands.
 * The callback envelope makes rejected actor operations fail the test immediately.
 */
const VIEW_COMMAND = `
const [view, operation, input, extra, done] = arguments;
try {
  const target = view === 'popup'
    ? document.querySelector('browser[webextension-view-type="popup"]')
    : view === 'selected' ? gBrowser.selectedBrowser
    : view === 'onboarding' ? Array.from(gBrowser.tabs).find(tab =>
      tab.linkedBrowser.currentURI.spec.endsWith('/onboarding.html'))?.linkedBrowser : null;
  if (!target) throw new Error('Firefox view is unavailable: ' + view);
  const actor = target.browsingContext.currentWindowGlobal.getActor('MarionetteCommands');
  const capabilities = {toJSON: () => ({'moz:webdriverClick': true})};
  let result;
  if (operation === 'script') result = actor.executeScript(input, extra, {});
  else result = actor.findElement('css selector', input, {}).then(element =>
    operation === 'click' ? actor.clickElement(element, capabilities)
      : actor.sendKeysToElement(element, extra, capabilities));
  Promise.resolve(result).then(value => done({ok: true, value}),
    error => done({ok: false, message: String(error), stack: error?.stack}));
} catch (error) {
  done({ok: false, message: String(error), stack: error?.stack});
}`;

/**
 * Installs the unchanged Firefox artifact into an isolated native browser with chrome automation.
 * @param {string} directory - Caller-owned temporary directory for this installation.
 * @return {Promise<object>} Native commands, view interaction helpers, browser identity, and cleanup.
 */
export async function launchNativeFirefox( directory ) {
	const profile = join( directory, 'profile' );
	const extensionPath = join( directory, 'extension' );
	const uuid = randomUUID();
	const executablePath = process.env.FIREFOX_EXECUTABLE_PATH ?? ( process.platform === 'darwin'
		? '/Applications/Firefox.app/Contents/MacOS/firefox' : firefox.executablePath() );
	const [ port, marionettePort ] = await Promise.all( [ availablePort(), availablePort() ] );
	const endpoint = `http://127.0.0.1:${ port }`;
	let driver;
	let session;
	let closed;
	let driverOutput = '';
	const prefs = {
		'extensions.webextensions.uuids': JSON.stringify( { 'tocus@agustinbarrientos.com': uuid } ),
		'browser.shell.checkDefaultBrowser': false,
		'browser.startup.homepage_override.mstone': 'ignore',
		'marionette.port': marionettePort,
	};

	/**
	 * Sends a WebDriver request and surfaces protocol failures with their original details.
	 * @param {string} path - Endpoint relative to the current session.
	 * @param {object} [data] - Optional JSON request body.
	 * @param {string} [method] - HTTP method, inferred from the presence of a body.
	 * @return {Promise<unknown>} WebDriver response value.
	 */
	async function command( path, data, method = data === undefined ? 'GET' : 'POST' ) {
		const response = await fetch( `${ endpoint }${ session ? `/session/${ session }` : '' }${ path }`, {
			method,
			headers: { 'Content-Type': 'application/json' },
			...( data === undefined ? {} : { body: JSON.stringify( data ) } ),
			signal: AbortSignal.timeout( 30_000 ),
		} );
		const result = await response.json();
		if ( ! response.ok || result.value?.error ) {
			throw new Error( `WebDriver ${ method } ${ path }: ${ JSON.stringify( result.value ) }` );
		}
		return result.value;
	}

	/**
	 * Executes browser-chrome JavaScript without switching contexts or closing native panels.
	 * @param {string} script - Browser-chrome script body.
	 * @param {unknown[]} [args] - Arguments available through the script's arguments object.
	 * @return {Promise<unknown>} Script result.
	 */
	function execute( script, args = [] ) {
		return command( '/execute/sync', { script, args } );
	}

	/**
	 * Dispatches a view operation and propagates errors returned by the Firefox actor.
	 * @param {string} view - Popup, selected tab, or installed onboarding view.
	 * @param {string} operation - Actor operation to perform.
	 * @param {string} input - Script body or CSS selector.
	 * @param {unknown} extra - Script arguments or text to type.
	 * @return {Promise<unknown>} Actor result.
	 */
	async function viewCommand( view, operation, input, extra ) {
		const result = await command( '/execute/async', { script: VIEW_COMMAND, args: [ view, operation, input, extra ] } );
		if ( ! result?.ok ) {
			throw new Error( `Firefox ${ view } ${ operation }: ${ result?.message ?? 'Actor returned no result.' }` );
		}
		return result.value;
	}

	/**
	 * Executes code in the real view, retaining access to its extension browser globals.
	 * @param {string} view - Popup, selected tab, or installed onboarding view.
	 * @param {string} script - Script body executed by the view actor.
	 * @param {unknown[]} [args] - Script arguments.
	 * @return {Promise<unknown>} View script result.
	 */
	function viewScript( view, script, args = [] ) {
		return viewCommand( view, 'script', script, args );
	}

	/**
	 * Clicks a real view element through Marionette, preserving trusted user activation.
	 * @param {string} view - Popup, selected tab, or installed onboarding view.
	 * @param {string} selector - CSS selector for the interactive element.
	 * @return {Promise<unknown>} Completion of the native actor click.
	 */
	function viewClick( view, selector ) {
		return viewCommand( view, 'click', selector, null );
	}

	/**
	 * Types into a real view element through Marionette's native key input command.
	 * @param {string} view - Popup, selected tab, or installed onboarding view.
	 * @param {string} selector - CSS selector for the input element.
	 * @param {string} text - Characters or WebDriver key codes to type.
	 * @return {Promise<unknown>} Completion of the native actor typing operation.
	 */
	function viewType( view, selector, text ) {
		return viewCommand( view, 'type', selector, text );
	}

	/**
	 * Closes the session and terminates only this fixture's driver and profile processes.
	 * @return {Promise<void>} Completion of idempotent process and temporary-profile cleanup.
	 */
	function close() {
		closed ??= ( async () => {
			try {
				if ( session ) {
					await command( '', undefined, 'DELETE' );
				}
			} catch {
				// A disconnected session still requires process cleanup by its unique profile.
			} finally {
				try {
					if ( driver?.pid ) {
						await stopProcess( driver.pid );
					}
				} finally {
					await stopProfileFirefox( profile );
					await rm( profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 } );
					await rm( extensionPath, { recursive: true, force: true } );
				}
			}
		} )();
		return closed;
	}

	try {
		await mkdir( profile, { recursive: true } );
		await cp( process.env.FIREFOX_EXTENSION_PATH ?? fileURLToPath( new URL( '../../../../.output/firefox-mv2/', import.meta.url ) ),
			extensionPath,
			{ recursive: true } );
		await writeFile( join( profile, 'user.js' ), Object.entries( prefs )
			.map( ( [ key, value ] ) => `user_pref(${ JSON.stringify( key ) }, ${ JSON.stringify( value ) });` ).join( '\n' ) );
		driver = await start( {
			geckoDriverVersion: '0.37.1', host: '127.0.0.1', port, marionettePort, allowSystemAccess: true,
			...( process.platform === 'darwin' ? { connectExisting: true } : {} ),
			spawnOpts: { stdio: [ 'ignore', 'pipe', 'pipe' ] },
		} );
		driver.stdout.on( 'data', ( data ) => {
			driverOutput = ( driverOutput + data ).slice( -8_000 );
		} );
		driver.stderr.on( 'data', ( data ) => {
			driverOutput = ( driverOutput + data ).slice( -8_000 );
		} );
		await waitUntil( async () => ( await command( '/status' ) ).ready );
		if ( process.platform === 'darwin' ) {
			execFileSync( '/usr/bin/open', [
				'-n', '-a', dirname( dirname( dirname( executablePath ) ) ), '--args',
				'-no-remote', '-profile', profile, '--remote-allow-system-access', '--marionette', 'about:blank',
			] );
		}
		const created = await command( '/session', { capabilities: { alwaysMatch: {
			browserName: 'firefox',
			...( process.platform === 'darwin' ? {} : { 'moz:firefoxOptions': {
				binary: executablePath, args: [ '-profile', profile, '--remote-allow-system-access' ], prefs,
			} } ),
		} } } );
		session = created.sessionId;
		await command( '/timeouts', { script: 15_000, pageLoad: 15_000, implicit: 0 } );
		await command( '/moz/addon/install', { path: extensionPath, temporary: true } );
		await command( '/moz/context', { context: 'chrome' } );
		await waitUntil( () => execute( `return Array.from(gBrowser.tabs).some(tab =>
            tab.linkedBrowser.currentURI.spec.endsWith('/onboarding.html'));` ) );
		await execute( 'CustomizableUI.addWidgetToArea(\'tocus_agustinbarrientos_com-BAP\', CustomizableUI.AREA_NAVBAR);' );
		await waitUntil( () => execute( 'return Boolean(document.getElementById(\'tocus_agustinbarrientos_com-BAP\'));' ) );
		return {
			command, execute, viewScript, viewClick, viewType, close, uuid,
			version: created.capabilities.browserVersion,
		};
	} catch ( error ) {
		await close();
		throw new Error( `Native Firefox setup failed: ${ error.message }\n${ driverOutput }`, { cause: error } );
	}
}
