import { setTimeout as delay } from 'node:timers/promises';
import { test, expect, withBrowser, readView, reload, protectionState, enroll, settings, openPopup, clickButton, fill, continuePause } from './__fixtures__/journey.mjs';

test( 'native toolbar fits its controls and opens Settings and Statistics for the current website', async () => {
	await withBrowser( async ( browser, url ) => {
		await browser.openPage( url );
		await openPopup( browser );
		const geometry = await browser.viewScript( 'popup', `return {
			width: innerWidth, height: innerHeight, bodyWidth: document.body.getBoundingClientRect().width,
			scrollWidth: document.documentElement.scrollWidth,
			links: Array.from(document.querySelectorAll('.popup-footer a'), a => a.getBoundingClientRect().toJSON())
		};` );
		await test.info().attach( 'native-popup-geometry', { body: JSON.stringify( geometry ), contentType: 'application/json' } );
		expect( geometry.width ).toBe( 352 );
		expect( geometry.bodyWidth ).toBe( 352 );
		expect( geometry.height ).toBeGreaterThan( 250 );
		expect( geometry.height ).toBeLessThan( 600 );
		expect( geometry.scrollWidth ).toBe( geometry.width );
		expect( geometry.links ).toHaveLength( 2 );
		for ( const rect of geometry.links ) {
			expect( rect.width ).toBeGreaterThan( 50 );
			expect( rect.right ).toBeLessThanOrEqual( geometry.width );
			expect( rect.bottom ).toBeLessThanOrEqual( geometry.height );
		}
		for ( const [ route, heading ] of [ [ 'protected-sites', 'Websites' ], [ 'statistics', 'Statistics' ] ] ) {
			await browser.viewClick( 'popup', `a[href$="#${ route }"]` );
			await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( heading );
			await browser.closePage();
			if ( route === 'protected-sites' ) {
				await openPopup( browser );
			}
		}
	} );
} );

test( 'denied native access saves nothing and retry enables a real pause and Continue', async () => {
	await withBrowser( async ( browser, url ) => {
		await browser.openPage( url );
		await openPopup( browser );
		const empty = { origins: [], navigation: false, sites: [], rules: 0 };
		expect( await protectionState( browser, 'popup' ) ).toEqual( empty );
		await browser.viewClick( 'popup', 'button' );
		await browser.consent( false );
		await expect.poll( () => protectionState( browser, 'onboarding' ) ).toEqual( empty );
		if ( await browser.isPopupOpen() ) {
			await expect.poll( () => readView( browser, 'popup', 'return document.body.innerText;' ) )
				.toContain( 'Browser access is needed to add a pause here.' );
		}
		await browser.closePopup();
		await openPopup( browser );
		await browser.viewClick( 'popup', 'button' );
		await browser.consent( true );
		await expect.poll( () => protectionState( browser, 'onboarding' ) ).toMatchObject( { sites: [ '127.0.0.1' ], rules: 1 } );
		await browser.closePopup();
		await reload( browser );
		await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		await continuePause( browser );
		await expect.poll( () => browser.currentUrl() ).toBe( url );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		await expect.poll( () => browser.viewScript( 'onboarding', `return browser.tabs.query({active:true,currentWindow:true})
			.then(([tab]) => browser.tabs.sendMessage(tab.id, {type:'get-protected-page-presentation-status'}))
			.catch(error => { if(error.message.includes('Receiving end does not exist')) return null; throw error; });` ) )
			.toMatchObject( { interruptionLayerPresented: false } );
		await openPopup( browser );
		expect( await protectionState( browser, 'popup' ) ).toMatchObject( { sites: [ '127.0.0.1' ], rules: 0 } );
		await expect.poll( () => browser.viewScript( 'popup', `return browser.storage.local.get('tocus.statistics.v1')
			.then(data => data['tocus.statistics.v1']?.dailyTotals.map(({completedWaitCount, allowanceGrantedCount}) => ({completedWaitCount, allowanceGrantedCount})));` ) )
			.toEqual( [ { completedWaitCount: 1, allowanceGrantedCount: 1 } ] );
	} );
} );

test( 'first-use onboarding preserves appearance and enrolls websites through native consent', async () => {
	await withBrowser( async ( browser ) => {
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("button[type=submit]")?.textContent;' ) ).toBe( 'Continue' );
		await browser.viewClick( 'selected', 'button[type="submit"]' );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("[aria-label=Blue]") !== null;' ) ).toBe( true );
		await browser.viewClick( 'selected', '[aria-label="Blue"]' );
		await browser.viewClick( 'selected', '[aria-label="Dark"]' );
		await browser.viewClick( 'selected', 'button[type="submit"]' );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("input[aria-label]")?.getAttribute("aria-label");' ) ).toBe( 'Website address' );
		await browser.viewType( 'selected', 'input[aria-label="Website address"]', '127.0.0.1' );
		await browser.viewClick( 'selected', '.manual-form button[type="submit"]' );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector(".finish-action")?.disabled;' ) ).toBe( false );
		await browser.viewClick( 'selected', '.finish-action' );
		await browser.consent( false );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector(".finish-action")?.disabled;' ) ).toBe( false );
		expect( await protectionState( browser ) ).toMatchObject( { sites: [], rules: 0 } );
		await browser.viewClick( 'selected', '.finish-action' );
		await browser.consent( true );
		await settings( browser, 'appearance' );
		await expect.poll( () => protectionState( browser ) ).toMatchObject( { sites: [ '127.0.0.1' ], rules: 1 } );
		await reload( browser );
		await expect.poll( () => readView( browser, 'selected', `return {
			blue: document.querySelector('[aria-label="Blue"]')?.getAttribute('aria-checked'),
			dark: document.querySelector('[aria-label="Dark"]')?.getAttribute('aria-checked')
		};` ) ).toEqual( { blue: 'true', dark: 'true' } );
	} );
} );

test( 'Continue makes one slow request and keeps its allowance through redirects, new tabs and reloads', async () => {
	await withBrowser( async ( browser, url, network ) => {
		await enroll( browser, url );
		await browser.navigate( `${ url }slow` );
		await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		await continuePause( browser );
		await expect.poll( () => network.requests( '/slow' ) ).toBeGreaterThan( 0 );
		// The response stays pending long enough to expose repeated navigation cancellation.
		await delay( 1_000 );
		expect( network.requests( '/slow' ) ).toBe( 1 );
		network.release();
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		await browser.viewClick( 'selected', '#redirect' );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }redirected` );
		expect( network.requests( '/redirect' ) ).toBe( 1 );
		expect( network.requests( '/redirected' ) ).toBe( 1 );
		await browser.viewClick( 'selected', '#new-tab' );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }new` );
		await reload( browser );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		expect( network.requests( '/new' ) ).toBe( 2 );
		expect( network.requests( '/slow' ) ).toBe( 1 );
	} );
} );

test( 'real allowance expiry pauses playing media and Continue preserves the document and unfinished work', async () => {
	test.setTimeout( 240_000 );
	await withBrowser( async ( browser, url, network ) => {
		await enroll( browser, url, '*://*.youtube.com/*' );
		await settings( browser, 'timing' );
		await browser.viewKey( 'selected', '#allowance', 'Home' );
		await browser.viewKey( 'selected', '#wait-increase', 'Home' );
		await clickButton( browser, 'Save', '.tocus-form-actions' );
		await expect.poll( () => browser.viewScript( 'selected', `return browser.storage.local.get('tocus.protection.configuration.v1')
			.then(data => data['tocus.protection.configuration.v1'].timingConfiguration.allowanceMilliseconds);` ) ).toBe( 120_000 );
		await browser.navigate( `${ url }media` );
		await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		await continuePause( browser );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		const allowance = await browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.durable.v1')
			.then(data => data['tocus.protection.durable.v1']?.document.scopes.scope_default?.allowance);` );
		expect( allowance ).toBeDefined();
		expect( allowance.expiresAtEpochMilliseconds - allowance.startedAtEpochMilliseconds ).toBe( 120_000 );
		await test.info().attach( 'actual-allowance', { body: JSON.stringify( allowance ), contentType: 'application/json' } );
		await fill( browser, 'input', 'Keep my unfinished work' );
		await browser.viewScript( 'selected', 'document.body.dataset.identity = "original-document";' );
		await browser.viewClick( 'selected', '#play' );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("video")?.paused;' ) ).toBe( false );
		/**
		 * Reads native mute state and the installed content script presentation.
		 * @return {Promise<object>} Actual selected-tab playback protection.
		 */
		const status = () => browser.viewScript( 'onboarding', `return browser.tabs.query({active:true,currentWindow:true}).then(async ([tab]) => ({
			muted: tab.mutedInfo.muted,
			presentation: await browser.tabs.sendMessage(tab.id, {type:'get-protected-page-presentation-status'}).catch(error => {
				if (error.message.includes('Receiving end does not exist')) return {interruptionLayerPresented:false};
				throw error;
			})
		}));` );
		expect( ( await status() ).muted ).toBe( false );
		await expect.poll( async () => ( await status() ).presentation.interruptionLayerPresented,
			{ timeout: 135_000, intervals: [ 1_000 ] } ).toBe( true );
		expect( await browser.viewScript( 'selected', 'return Date.now();' ) ).toBeGreaterThanOrEqual( allowance.expiresAtEpochMilliseconds );
		expect( ( await status() ).muted ).toBe( true );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("video")?.paused;' ) ).toBe( true );
		await expect.poll( () => browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.durable.v1')
			.then(data => Boolean(data['tocus.protection.durable.v1']?.document.scopes.scope_default?.ready));` ), { timeout: 20_000 } ).toBe( true );
		expect( ( await status() ).muted ).toBe( true );
		await browser.viewKey( 'selected', 'body', 'Space' );
		await expect.poll( async () => ( await status() ).presentation.interruptionLayerPresented ).toBe( false );
		await expect.poll( async () => ( await status() ).muted ).toBe( false );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("video")?.paused;' ) ).toBe( false );
		expect( await browser.currentUrl() ).toBe( `${ url }media` );
		expect( await browser.viewScript( 'selected', 'return {text: document.querySelector("input").value, identity: document.body.dataset.identity};' ) )
			.toEqual( { text: 'Keep my unfinished work', identity: 'original-document' } );
		expect( network.requests( '/media' ) ).toBe( 1 );
	}, { hostname: 'youtube.com', https: true } );
} );
