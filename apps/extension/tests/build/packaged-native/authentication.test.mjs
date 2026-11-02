import { test, expect, withBrowser, readView, settings, fill, reload } from './__fixtures__/journey.mjs';

/**
 * Enrolls YouTube through Settings without visiting any live YouTube document.
 * @param {object} browser - Disposable installed browser with a loopback-only fixture host.
 */
async function protectYouTube( browser ) {
	await settings( browser, 'protected-sites' );
	await expect.poll( () => readView( browser, 'selected', `const input = document.querySelector('#site-address');
		return Boolean(input && input.getClientRects().length && !input.disabled);` ) ).toBe( true );
	await fill( browser, '#site-address', 'youtube.com' );
	await browser.viewClick( 'selected', '.settings-page > .tocus-form-actions > button:first-child' );
	await browser.consent( true );
	await expect.poll( () => browser.viewScript( 'onboarding', `return Promise.all([
		browser.permissions.getAll(), browser.storage.local.get('tocus.protection.configuration.v1'),
		browser.declarativeNetRequest.getDynamicRules()
	]).then(([permissions, stored, rules]) => ({
		granted: permissions.origins.includes('*://*.youtube.com/*') && permissions.permissions.includes('webNavigation'),
		protected: stored['tocus.protection.configuration.v1']?.sites.some(site => site.rule.host === 'youtube.com'
			&& site.rule.includeSubdomains && site.rule.behavior !== 'allow'),
		redirectsVideo: rules.some(rule => rule.action.type === 'redirect'
			&& new RegExp(rule.condition.regexFilter).test('https://www.youtube.com/watch?v=fixture'))
	}));` ) ).toEqual( { granted: true, protected: true, redirectsVideo: true } );
}

test( 'Google account authentication loads without a pause or browsing allowance while YouTube is protected', async () => {
	await withBrowser( async ( browser, url, network ) => {
		await protectYouTube( browser );
		const path = '/accounts/SetSID?source=fixture';
		const destination = new URL( path, url ).href;
		await browser.navigate( destination );
		await expect.poll( () => browser.currentUrl() ).toBe( destination );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) )
			.toBe( 'Protected destination' );
		expect( network.requests( path ) ).toBe( 1 );
		await reload( browser );
		expect( await browser.currentUrl() ).toBe( destination );
		expect( network.requests( path ) ).toBe( 2 );
		const state = await browser.viewScript( 'onboarding', `return Promise.all([
			browser.storage.session.get('tocus.protection.session.v1'),
			browser.storage.local.get('tocus.protection.durable.v1')
		]).then(([session, durable]) => ({
			waiting: session['tocus.protection.session.v1']?.document.scopes.scope_default?.type === 'waiting',
			allowance: Boolean(durable['tocus.protection.durable.v1']?.document.scopes.scope_default?.allowance)
		}));` );
		expect( state ).toEqual( { waiting: false, allowance: false } );
	}, { hostname: 'accounts.youtube.com', https: true } );
} );

test( 'YouTube video visits still open the breathing pause before reaching the network', async () => {
	await withBrowser( async ( browser, url, network ) => {
		await protectYouTube( browser );
		const path = '/watch?v=fixture';
		const destination = new URL( path, url ).href;
		await browser.navigate( destination );
		await expect.poll( () => browser.currentUrl() ).toBe( browser.extensionUrl( 'pause.html' ) );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("tocus-f-interruption-screen")?.shadowRoot?.querySelector("h1")?.textContent;' ) )
			.toMatch( /^Breathe (in|out)$/u );
		await expect.poll( () => browser.viewScript( 'onboarding', `return browser.storage.session.get('tocus.protection.session.v1')
			.then(data => data['tocus.protection.session.v1']?.document.scopes.scope_default?.participants
				?.map(participant => participant.retainedDestination));` ) ).toEqual( [ destination ] );
		expect( network.requests( path ) ).toBe( 0 );
	}, { hostname: 'www.youtube.com', https: true } );
} );
