import { test, expect, withBrowser, readView, enroll, continuePause, reload } from './__fixtures__/journey.mjs';

/**
 * Seeds exception policies only after real native consent has granted their shared host.
 * @param {object} browser - Disposable installed browser driver.
 * @param {object[]} entries - Child policy overrides for the already enrolled fixture host.
 * @since 1.1.0
 */
async function configureExceptions( browser, entries ) {
	await browser.navigate( browser.extensionUrl( 'options.html#about' ) );
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'About' );
	await browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.configuration.v1').then(async data => {
		const configuration = data['tocus.protection.configuration.v1'];
		if (configuration.sites.length !== 1) throw new Error('Expected exactly one natively enrolled fixture host.');
		const root = configuration.sites[0];
		const timing = {...configuration.timingConfiguration, initialWaitMilliseconds:10000,
			ladderIncreaseMilliseconds:0, allowanceMilliseconds:120000, completionAction:'show-continue'};
		const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
		const inactive = {mode:'custom',windows:[{weekday:weekdays[(new Date().getDay()+1)%7],startMinute:0,endMinute:1440}]};
		await browser.storage.local.set({'tocus.protection.configuration.v1':{
			...configuration, timingConfiguration:timing,
			sites:[root,...arguments[0].map(entry => ({...root,
				rule:{...root.rule,pathPrefix:entry.path,...(entry.allow?{behavior:'allow'}:{})},
				...(entry.inactive?{schedule:inactive}:{}),
				...(entry.timing?{timingConfiguration:{...timing,...entry.timing}}:{})
			}))]
		}});
	});`, [ entries ] );
	await expect.poll( () => browser.viewScript( 'onboarding',
		'return browser.declarativeNetRequest.getDynamicRules().then(rules => rules.length);' ) ).toBe( entries.length + 1 );
}

/**
 * Reads the actual shared pause without adding a runtime test API.
 * @param {object} browser - Disposable installed browser driver.
 * @return {Promise<object|undefined>} Stored session scope, when present.
 * @since 1.1.0
 */
function readSharedPause( browser ) {
	return browser.viewScript( 'onboarding', `return browser.storage.session.get('tocus.protection.session.v1')
		.then(data => data['tocus.protection.session.v1']?.document.scopes.scope_default);` );
}

test( 'native exceptions bypass a broad pause while a more specific path still pauses and retains text fragments', async () => {
	await withBrowser( async ( browser, url, network ) => {
		await enroll( browser, url );
		await configureExceptions( browser, [
			{ path: '/open', allow: true },
			{ path: '/scheduled', inactive: true },
			{ path: '/open/private' },
		] );
		for ( const path of [ 'open/child', 'scheduled' ] ) {
			await browser.navigate( `${ url }${ path }` );
			await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
			expect( await browser.currentUrl() ).toBe( `${ url }${ path }` );
			expect( network.requests( `/${ path }` ) ).toBe( 1 );
			expect( ( await readSharedPause( browser ) )?.type ).not.toBe( 'waiting' );
		}
		// History navigation must use the same winning path policy as a network navigation.
		await browser.viewScript( 'selected', 'history.pushState({}, "", "/open/in-page");' );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }open/in-page` );
		expect( ( await readSharedPause( browser ) )?.type ).not.toBe( 'waiting' );

		const destination = `${ url }open/private?source=fixture#chapter:~:text=Protected%20destination`;
		await browser.navigate( destination );
		await expect.poll( () => browser.currentUrl() ).toBe( browser.extensionUrl( 'pause.html' ) );
		await expect.poll( async () => ( await readSharedPause( browser ) )?.participants
			?.map( ( participant ) => participant.retainedDestination ) )
			.toEqual( [ destination ] );
		await reload( browser );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("tocus-f-interruption-screen")?.shadowRoot?.querySelector("h1")?.textContent;' ) )
			.toMatch( /^Breathe (in|out)$/u );
		await continuePause( browser );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		await expect.poll( () => browser.viewScript( 'onboarding', 'return browser.tabs.query({active:true,currentWindow:true}).then(([tab]) => tab.url);' ) )
			.toBe( destination );
	} );
} );

test( 'native longer exceptions extend one shared countdown and retain the initiator policy after its tab closes', async () => {
	test.setTimeout( 90_000 );
	await withBrowser( async ( browser, url ) => {
		await enroll( browser, url );
		await configureExceptions( browser, [ { path: '/shorts', timing: {
			initialWaitMilliseconds: 20_000, allowanceMilliseconds: 300_000, completionAction: 'open-automatically',
		} } ] );
		await browser.navigate( `${ url }feed` );
		await expect.poll( () => browser.currentUrl() ).toBe( browser.extensionUrl( 'pause.html' ) );
		await expect.poll( async () => ( await readSharedPause( browser ) )?.confirmedFocusedDurationMilliseconds ?? 0 )
			.toBeGreaterThanOrEqual( 1_000 );
		const initial = await readSharedPause( browser );
		const initiatorTabId = await browser.viewScript( 'onboarding', 'return browser.tabs.query({active:true,currentWindow:true}).then(([tab]) => tab.id);' );
		expect( initial.capturedWaitDurationMilliseconds ).toBe( 10_000 );
		expect( initial.capturedAllowanceDurationMilliseconds ).toBe( 120_000 );
		expect( initial.capturedCompletionAction ).toBe( 'show-continue' );

		await browser.openPage( `${ url }shorts/item` );
		await expect.poll( () => browser.currentUrl() ).toBe( browser.extensionUrl( 'pause.html' ) );
		await expect.poll( async () => ( await readSharedPause( browser ) )?.capturedWaitDurationMilliseconds )
			.toBe( 20_000 );
		const extended = await readSharedPause( browser );
		expect( extended.waitId ).toBe( initial.waitId );
		expect( extended.confirmedFocusedDurationMilliseconds )
			.toBeGreaterThanOrEqual( initial.confirmedFocusedDurationMilliseconds );
		expect( extended.capturedAllowanceDurationMilliseconds ).toBe( 120_000 );
		expect( extended.capturedCompletionAction ).toBe( 'show-continue' );
		await browser.viewScript( 'onboarding', 'return browser.tabs.remove(arguments[0]);', [ initiatorTabId ] );
		await reload( browser );
		await expect.poll( async () => ( await readSharedPause( browser ) )?.participants?.length ).toBe( 1 );
		const restored = await readSharedPause( browser );
		expect( restored.waitId ).toBe( initial.waitId );
		expect( restored.capturedAllowanceDurationMilliseconds ).toBe( 120_000 );
		expect( restored.capturedCompletionAction ).toBe( 'show-continue' );
		await continuePause( browser );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }shorts/item` );
		const allowance = await browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.protection.durable.v1')
			.then(data => data['tocus.protection.durable.v1']?.document.scopes.scope_default?.allowance);` );
		expect( allowance.expiresAtEpochMilliseconds - allowance.startedAtEpochMilliseconds ).toBe( 120_000 );
		await expect.poll( () => browser.viewScript( 'onboarding', `return browser.storage.local.get('tocus.statistics.v1')
			.then(data => data['tocus.statistics.v1']?.dailyTotals.reduce((count, day) => count+day.completedWaitCount,0));` ) ).toBe( 1 );
	} );
} );
