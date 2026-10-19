import {
	clickButton, continuePause, enroll, expect, fill, readView, settings, test, withBrowser,
} from './__fixtures__/journey.mjs';


/**
 * Configures a focus destination through the production Settings form.
 * @param {object} browser - Disposable installed browser.
 * @param {URL} destination - User-selected alternative address.
 * @since 1.1.0
 */
async function configureFocusLink( browser, destination ) {
	await settings( browser, 'focus-links' );
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Quick links' );
	await expect.poll( () => readView( browser, 'selected', `const control = document.querySelector('.settings-focus-links-add');
		return control instanceof HTMLButtonElement && !control.disabled && control.getClientRects().length > 0;` ) ).toBe( true );
	await clickButton( browser, 'Add site', '.settings-focus-links' );
	await fill( browser, '[role=dialog] input[id^="label-focus_link_"]', 'Return to my project' );
	await fill( browser, '[role=dialog] input[id^="url-focus_link_"]', destination.href );
	await clickButton( browser, 'Done', '[role=dialog]' );
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("[role=dialog]") === null;' ) ).toBe( true );
	await clickButton( browser, 'Save', '.settings-page' );
	await expect.poll( () => readView( browser, 'selected', `return browser.storage.local.get('tocus.preferences.v1')
		.then(data => data['tocus.preferences.v1']?.focusLinks?.map(({label, url}) => ({label, url})));` ) )
		.toEqual( [ { label: 'Return to my project', url: destination.href } ] );
}



test( 'a saved focus link leaves an unfinished pause without granting browsing time or additional access', async () => {
	await withBrowser( async ( browser, url, network ) => {
		await enroll( browser, url );
		const destination = new URL( 'slow', url );
		destination.hostname = 'localhost';
		await configureFocusLink( browser, destination );
		const permissions = await browser.viewScript( 'onboarding', 'return browser.permissions.getAll();' );
		await browser.navigate( `${ url }focus-link-test` );
		await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		await expect.poll( () => readView( browser, 'selected', `return document.querySelector('tocus-f-interruption-screen')?.shadowRoot
			?.querySelector('.focus-link-button')?.textContent;` ) ).toBe( 'Return to my project' );
		await browser.viewClick( 'selected', 'tocus-f-interruption-screen >>> .focus-link-button' );
		await expect.poll( () => network.requests( '/slow' ) ).toBe( 1 );
		await expect.poll( () => readView( browser, 'onboarding', `return browser.storage.local.get('tocus.statistics.v1')
			.then(data => data['tocus.statistics.v1']?.dailyTotals.map(({reconsideredVisitCount, completedWaitCount, allowanceGrantedCount}) =>
			({reconsideredVisitCount, completedWaitCount, allowanceGrantedCount})));` ) )
			.toEqual( [ { reconsideredVisitCount: 1, completedWaitCount: 0, allowanceGrantedCount: 0 } ] );
		expect( await browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.durable.v1')
			.then(data => data['tocus.protection.durable.v1'].document.scopes.scope_default);` ) )
			.toMatchObject( { ladder: { completedWaits: 0 } } );
		expect( await browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.durable.v1')
			.then(data => data['tocus.protection.durable.v1'].document.scopes.scope_default.allowance ?? null);` ) ).toBeNull();
		expect( await browser.viewScript( 'onboarding', 'return browser.permissions.getAll();' ) ).toEqual( permissions );
		network.release();
		await expect.poll( () => browser.currentUrl() ).toBe( destination.href );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		expect( network.requests( '/focus-link-test' ) ).toBe( 0 );
	} );
} );


test( 'a focus link on the live-page expiry pause navigates away without completing another wait', async () => {
	test.setTimeout( 200_000 );
	await withBrowser( async ( browser, url, network ) => {
		await enroll( browser, url );
		const destination = new URL( 'slow', url );
		destination.hostname = 'localhost';
		await configureFocusLink( browser, destination );
		await settings( browser, 'timing' );
		await browser.viewKey( 'selected', '#allowance', 'Home' );
		await clickButton( browser, 'Save', '.tocus-form-actions' );
		await expect.poll( () => readView( browser, 'selected', `return browser.storage.local.get('tocus.protection.configuration.v1')
			.then(data => data['tocus.protection.configuration.v1'].timingConfiguration.allowanceMilliseconds);` ) ).toBe( 120_000 );
		await browser.navigate( `${ url }expiry-focus-link` );
		await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		await continuePause( browser );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }expiry-focus-link` );
		await expect.poll( () => readView( browser, 'onboarding', `return browser.tabs.query({active:true,currentWindow:true})
			.then(([tab]) => browser.tabs.sendMessage(tab.id, {type:'get-protected-page-presentation-status'}))
			.then(status => status.interruptionLayerPresented).catch(error => {
				if(error.message.includes('Receiving end does not exist')) return false; throw error;
			});` ), { timeout: 135_000, intervals: [ 500 ] } ).toBe( true );
		// The modal contains focus; use native keyboard input through its closed isolation boundary.
		await browser.viewPressKey( 'selected', 'Tab' );
		if ( browser.viewFocusedElement ) {
			let focused = await browser.viewFocusedElement( 'selected' );
			if ( focused?.tag === 'div' && focused.classes.includes( 'scene' ) ) {
				await browser.viewPressKey( 'selected', 'Tab' );
				focused = await browser.viewFocusedElement( 'selected' );
			}
			expect( focused ).toMatchObject( { tag: 'button', classes: expect.arrayContaining( [ 'focus-link-button' ] ),
				label: 'Return to my project', disabled: false } );
		}
		await browser.viewPressKey( 'selected', 'Enter' );
		await expect.poll( () => network.requests( '/slow' ) ).toBe( 1 );
		const observationEnds = Date.now() + 2_500;
		await expect.poll( async () => ( {
			presented: await readView( browser, 'onboarding', `return browser.tabs.query({active:true,currentWindow:true})
				.then(([tab]) => browser.tabs.sendMessage(tab.id, {type:'get-protected-page-presentation-status'}))
				.then(status => status.interruptionLayerPresented);` ),
			observed: Date.now() >= observationEnds,
		} ), { timeout: 5_000, intervals: [ 250 ] } ).toEqual( { presented: true, observed: true } );
		network.release();
		await expect.poll( () => browser.currentUrl() ).toBe( destination.href );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		await expect.poll( () => readView( browser, 'onboarding', `return browser.storage.local.get('tocus.statistics.v1')
			.then(data => data['tocus.statistics.v1']?.dailyTotals.map(({reconsideredVisitCount, completedWaitCount, allowanceGrantedCount}) =>
			({reconsideredVisitCount, completedWaitCount, allowanceGrantedCount})));` ) )
			.toEqual( [ { reconsideredVisitCount: 0, completedWaitCount: 1, allowanceGrantedCount: 1 } ] );
		expect( await browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.durable.v1')
			.then(data => data['tocus.protection.durable.v1'].document.scopes.scope_default.allowance ?? null);` ) ).toBeNull();
	} );
} );
