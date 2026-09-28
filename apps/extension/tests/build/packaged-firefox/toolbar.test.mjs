import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import { launchNativeFirefox } from './__fixtures__/native-firefox.mjs';

const toolbarSelector = '#tocus_agustinbarrientos_com-BAP';
const notificationSelector = '#addon-webext-permissions-notification';

/**
 * Clicks Firefox's actual toolbar button without resizing its popup.
 * @param {object} browser - Disposable Firefox driver.
 */
async function openPopup( browser ) {
	const element = await browser.command( '/element', { using: 'css selector', value: toolbarSelector } );
	await browser.command( `/element/${ element[ 'element-6066-11e4-a52e-4f735466cecf' ] }/click`, {} );
	await expect.poll( () => browser.viewScript( 'popup',
		'return document.querySelector(".popup-site-host")?.textContent;' ).catch( () => null ) ).toBe( '127.0.0.1' );
}

/**
 * Reads actual permissions, saved sites, and browser redirect rules without changing them.
 * @param {object} browser - Disposable Firefox driver.
 * @param {string} view - Extension document to inspect.
 * @return {Promise<object>} Actual persisted protection state.
 */
async function protectionState( browser, view = 'popup' ) {
	return browser.viewScript( view, `return Promise.all([
		browser.permissions.getAll(), browser.storage.local.get('tocus.protection.configuration.v1'),
		browser.declarativeNetRequest.getDynamicRules()
	]).then(([permissions, stored, rules]) => ({
		origins: permissions.origins, navigation: permissions.permissions.includes('webNavigation'),
		sites: stored['tocus.protection.configuration.v1']?.sites.map(site => site.identityHost) ?? [], rules: rules.length
	}));` );
}

/**
 * Chooses a displayed Firefox permission decision, leaving the native permission API intact.
 * @param {object} browser - Disposable Firefox driver.
 * @param {boolean} allow - Whether to select Allow or Deny.
 */
async function decidePermission( browser, allow ) {
	await expect.poll( () => browser.execute( `const panel = document.querySelector('#notification-popup');
		const notification = document.querySelector('${ notificationSelector }');
		return panel.state === 'open' && notification?.getAttribute('name')?.startsWith('TOCus') && !notification.button.disabled;` ) ).toBe( true );
	await browser.execute( `document.querySelector('${ notificationSelector }').${ allow ? 'button' : 'secondaryButton' }.click();` );
}

/**
 * Opens a real HTTP destination in the disposable browser window.
 * @param {object} browser - Disposable Firefox driver.
 * @param {string} url - Local destination URL.
 */
async function openWebsite( browser, url ) {
	await browser.execute( `const tab = gBrowser.addTab(arguments[0], {
		triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
	}); gBrowser.selectedTab = tab;`, [ url ] );
	await expect.poll( () => browser.execute( 'return gBrowser.selectedBrowser.currentURI.spec;' ) ).toBe( url );
}

/**
 * Creates an unchanged Firefox installation and a local website, and always removes their temporary state.
 * @param {(browser: object, url: string, network: object) => Promise<void>} run - Acceptance journey using the installed browser.
 */
async function withFirefox( run ) {
	const directory = await mkdtemp( join( tmpdir(), 'tocus-native-firefox-' ) );
	let slowRequests = 0;
	const pendingResponses = new Set();
	const html = '<!doctype html><title>Firefox destination</title><h1>Firefox destination</h1><input aria-label="Preserved text">';
	const server = createServer( ( request, response ) => {
		response.writeHead( 200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } );
		if ( request.url === '/slow' ) {
			slowRequests += 1;
			pendingResponses.add( response );
			return;
		}
		response.end( html );
	} );
	/** Releases only responses held by the slow-navigation regression. */
	function releaseResponses() {
		for ( const response of pendingResponses ) {
			response.end( html );
		}
		pendingResponses.clear();
	}
	/**
	 * Reads the number of requests that reached the delayed server endpoint.
	 * @return {number} Actual HTTP request count.
	 */
	function countRequests() {
		return slowRequests;
	}
	let browser;
	try {
		await new Promise( ( resolve ) => server.listen( 0, '127.0.0.1', resolve ) );
		browser = await launchNativeFirefox( directory );
		const url = `http://127.0.0.1:${ server.address().port }/`;
		await test.info().attach( 'firefox-version', { body: browser.version, contentType: 'text/plain' } );
		await run( browser, url, { requests: countRequests, release: releaseResponses } );
	} finally {
		releaseResponses();
		try {
			await browser?.close();
		} finally {
			server.closeAllConnections();
			await new Promise( ( resolve ) => server.close( resolve ) );
			await rm( directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 } );
		}
	}
}

test( 'Firefox native toolbar has usable dimensions and opens Settings and Statistics', async () => {
	test.setTimeout( 60_000 );
	await withFirefox( async ( browser, url ) => {
		await openWebsite( browser, url );
		await openPopup( browser );
		const geometry = await browser.viewScript( 'popup', `return {
			width: innerWidth, height: innerHeight, bodyWidth: document.body.getBoundingClientRect().width,
			scrollWidth: document.documentElement.scrollWidth,
			links: Array.from(document.querySelectorAll('.popup-footer a'), a => ({
				text: a.textContent.trim(), rect: a.getBoundingClientRect().toJSON()
			}))
		};` );
		await test.info().attach( 'native-popup-geometry', { body: JSON.stringify( geometry ), contentType: 'application/json' } );
		expect( geometry.width ).toBe( 352 );
		expect( geometry.bodyWidth ).toBe( 352 );
		expect( geometry.height ).toBeGreaterThan( 250 );
		expect( geometry.height ).toBeLessThan( 600 );
		expect( geometry.scrollWidth ).toBe( geometry.width );
		for ( const { rect } of geometry.links ) {
			expect( rect.width ).toBeGreaterThan( 50 );
			expect( rect.right ).toBeLessThanOrEqual( geometry.width );
			expect( rect.bottom ).toBeLessThanOrEqual( geometry.height );
		}
		for ( const [ route, heading ] of [ [ 'protected-sites', 'Websites' ], [ 'statistics', 'Statistics' ] ] ) {
			await browser.viewClick( 'popup', `a[href$="#${ route }"]` );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( heading );
			await browser.execute( 'gBrowser.removeTab(gBrowser.selectedTab);' );
			if ( route === 'protected-sites' ) {
				await openPopup( browser );
			}
		}
	} );
} );

test( 'Firefox popup handles denied access, enrolls after Allow, and continues to the protected website', async () => {
	test.setTimeout( 90_000 );
	await withFirefox( async ( browser, url ) => {
		await openWebsite( browser, url );
		await openPopup( browser );
		const empty = { origins: [], navigation: false, sites: [], rules: 0 };
		expect( await protectionState( browser ) ).toEqual( empty );
		await test.step( 'Deny new access and keep the website unprotected', async () => {
			await browser.viewClick( 'popup', 'button' );
			await decidePermission( browser, false );
			await expect.poll( () => browser.viewScript( 'popup', 'return document.body.innerText;' ) )
				.toContain( 'Browser access is needed to add a pause here.' );
			expect( await protectionState( browser ) ).toEqual( empty );
		} );
		await browser.execute( 'document.querySelector("#customizationui-widget-panel").hidePopup();' );
		await openPopup( browser );
		expect( await protectionState( browser ) ).toEqual( empty );
		await test.step( 'Retry, grant native access, and persist protection', async () => {
			await browser.viewClick( 'popup', 'button' );
			await decidePermission( browser, true );
			await expect.poll( () => protectionState( browser ) ).toEqual( {
				origins: [ '*://127.0.0.1/*' ], navigation: true, sites: [ '127.0.0.1' ], rules: 1,
			} );
			await expect.poll( () => browser.viewScript( 'popup', 'return document.body.innerText;' ) ).toContain( 'TOCus is active' );
			await browser.execute( 'document.querySelector("#customizationui-widget-panel").hidePopup();' );
			await openPopup( browser );
			expect( await protectionState( browser ) ).toMatchObject( { sites: [ '127.0.0.1' ], rules: 1 } );
		} );
		await test.step( 'Wait and Continue through the actual protection rule', async () => {
			await browser.execute( 'document.querySelector("#customizationui-widget-panel").hidePopup();gBrowser.selectedBrowser.reload();' );
			await expect.poll( () => browser.execute( 'return gBrowser.selectedBrowser.currentURI.spec;' ) ).toContain( '/pause.html' );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector(\'tocus-f-interruption-screen\')?.shadowRoot?.querySelector(\'button\')?.textContent;' ), { timeout: 20_000 } ).toBe( 'Continue' );
			await browser.viewScript( 'selected', 'document.querySelector(\'tocus-f-interruption-screen\').shadowRoot.querySelector(\'button\').click();' );
			await expect.poll( () => browser.execute( 'return gBrowser.selectedBrowser.currentURI.spec;' ) ).toBe( url );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Firefox destination' );
			await openPopup( browser );
			expect( await protectionState( browser ) ).toMatchObject( { sites: [ '127.0.0.1' ], rules: 0 } );
			const totals = await browser.viewScript( 'popup', 'return browser.storage.local.get(\'tocus.statistics.v1\').then(data => data[\'tocus.statistics.v1\'].dailyTotals);' );
			expect( totals ).toEqual( [
				expect.objectContaining( { completedWaitCount: 1, allowanceGrantedCount: 1 } ),
			] );
		} );
		await test.step( 'Remove the website and revoke its optional access', async () => {
			await browser.viewClick( 'popup', 'a[href$="#protected-sites"]' );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector(".settings-site-remove") !== null;' ) ).toBe( true );
			await browser.viewClick( 'selected', '.settings-site-remove' );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("[role=dialog]") !== null;' ) ).toBe( true );
			await browser.viewClick( 'selected', '[role="dialog"] .tocus-form-actions button:nth-child(2)' );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelectorAll("[role=dialog]").length;' ) ).toBe( 0 );
			await browser.viewClick( 'selected', 'main .tocus-form-actions button:first-child' );
			await expect.poll( () => protectionState( browser, 'selected' ) ).toEqual( empty );
			await openWebsite( browser, url );
			await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Firefox destination' );
		} );
	} );
} );


test( 'Firefox first-use onboarding saves appearance and enrolls a website through native permission consent', async () => {
	test.setTimeout( 90_000 );
	await withFirefox( async ( browser ) => {
		await browser.execute( `gBrowser.selectedTab = Array.from(gBrowser.tabs).find(tab =>
			tab.linkedBrowser.currentURI.spec.endsWith('/onboarding.html'));` );
		await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("button[type=submit]")?.textContent;' ) ).toBe( 'Continue' );
		await browser.viewClick( 'selected', 'button[type="submit"]' );
		await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("[aria-label=Blue]") !== null;' ) ).toBe( true );
		await browser.viewClick( 'selected', '[aria-label="Blue"]' );
		await browser.viewClick( 'selected', '[aria-label="Dark"]' );
		await browser.viewClick( 'selected', 'button[type="submit"]' );
		await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("input[aria-label]")?.getAttribute("aria-label");' ) ).toBe( 'Website address' );
		await browser.viewType( 'selected', 'input[aria-label="Website address"]', '127.0.0.1' );
		await browser.viewClick( 'selected', '.manual-form button[type="submit"]' );
		await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector(".finish-action")?.disabled;' ) ).toBe( false );
		expect( await protectionState( browser, 'selected' ) ).toEqual( { origins: [], navigation: false, sites: [], rules: 0 } );
		await browser.viewClick( 'selected', '.finish-action' );
		await decidePermission( browser, false );
		await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector(".finish-action")?.disabled;' ) ).toBe( false );
		expect( await protectionState( browser, 'selected' ) ).toMatchObject( { sites: [], rules: 0 } );
		await browser.viewClick( 'selected', '.finish-action' );
		await decidePermission( browser, true );
		await expect.poll( () => browser.execute( `return Array.from(gBrowser.tabs).some(tab =>
			tab.linkedBrowser.currentURI.spec.endsWith('/onboarding.html'));` ) ).toBe( false );
		await openWebsite( browser, `moz-extension://${ browser.uuid }/options.html#appearance` );
		await expect.poll( () => protectionState( browser, 'selected' ) ).toEqual( {
			origins: [ '*://127.0.0.1/*' ], navigation: true, sites: [ '127.0.0.1' ], rules: 1,
		} );
		await browser.execute( 'gBrowser.selectedBrowser.reload();' );
		await expect.poll( () => browser.execute( 'return gBrowser.selectedBrowser.webProgress.isLoadingDocument;' ) ).toBe( false );
		await expect.poll( () => browser.viewScript( 'selected', `return {
			blue: document.querySelector('[aria-label="Blue"]')?.getAttribute('aria-checked'),
			dark: document.querySelector('[aria-label="Dark"]')?.getAttribute('aria-checked')
		};` ) ).toEqual( { blue: 'true', dark: 'true' } );
	} );
} );


test( 'Firefox Continue reaches a slow destination without canceling and restarting it', async () => {
	test.setTimeout( 90_000 );
	await withFirefox( async ( browser, url, network ) => {
		await openWebsite( browser, url );
		await openPopup( browser );
		await browser.viewClick( 'popup', 'button' );
		await decidePermission( browser, true );
		await expect.poll( () => protectionState( browser ) ).toMatchObject( { sites: [ '127.0.0.1' ], rules: 1 } );
		await browser.execute( `document.querySelector('#customizationui-widget-panel').hidePopup();
			gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]), {
				triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
			});`, [ `${ url }slow` ] );
		await expect.poll( () => browser.execute( 'return gBrowser.selectedBrowser.currentURI.spec;' ) ).toContain( '/pause.html' );
		await expect.poll( () => browser.viewScript( 'selected',
			'return document.querySelector("tocus-f-interruption-screen")?.shadowRoot?.querySelector("button")?.textContent;' ),
		{ timeout: 20_000 } ).toBe( 'Continue' );
		await browser.viewScript( 'selected',
			'document.querySelector("tocus-f-interruption-screen").shadowRoot.querySelector("button").click();' );
		await expect.poll( network.requests ).toBeGreaterThan( 0 );
		// Keep the real network response pending while Firefox still reports the preceding pause URL.
		await delay( 1_000 );
		expect( network.requests() ).toBe( 1 );
		const pending = await browser.viewScript( 'onboarding', `return browser.tabs.query({active:true, currentWindow:true})
			.then(([tab]) => ({url:tab.url, status:tab.status, pendingUrl:tab.pendingUrl ?? null}));` );
		expect( pending ).toEqual( { url: `moz-extension://${ browser.uuid }/pause.html`, status: 'loading', pendingUrl: null } );
		network.release();
		await expect.poll( () => browser.execute( 'return gBrowser.selectedBrowser.currentURI.spec;' ) ).toBe( `${ url }slow` );
		await expect.poll( () => browser.viewScript( 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Firefox destination' );
		expect( network.requests() ).toBe( 1 );
	} );
} );
