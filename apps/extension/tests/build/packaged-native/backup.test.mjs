import {
	clickButton, continuePause, enroll, expect, fill, protectionState, readView, reload,
	setSelect, settings, test, withBrowser,
} from './__fixtures__/journey.mjs';

const configurationKey = 'tocus.protection.configuration.v1';
const preferencesKey = 'tocus.preferences.v1';
const statisticsKey = 'tocus.statistics.v1';

/**
 * Reads real persisted records without seeding or replacing product state.
 * @param {object} browser - Disposable installed browser.
 * @param {string} key - Product storage key.
 * @return {Promise<object>} Current authoritative document.
 */
function stored( browser, key ) {
	return readView( browser, 'selected', `return browser.storage.local.get(${ JSON.stringify( key ) }).then(values => values[${ JSON.stringify( key ) }]);` );
}

/**
 * Saves through the production settings control and waits for persistence to settle.
 * @param {object} browser - Disposable installed browser.
 */
async function save( browser ) {
	await clickButton( browser, 'Save', '.settings-page' );
	await expect.poll( () => readView( browser, 'selected', 'return [...document.querySelectorAll(".settings-page button")].some(button => button.textContent.trim() === "Save" && button.disabled);' ) ).toBe( true );
}

/**
 * Uploads actual file bytes and waits for a readable production preview.
 * @param {object} browser - Disposable installed browser.
 * @param {string} path - Local backup selected by the native file input.
 */
async function preview( browser, path ) {
	await browser.viewUpload( 'selected', '.settings-backup input[type=file]', path );
	await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("[role=dialog]")?.textContent;' ) )
		.toContain( 'Replace your settings and statistics?' );
}

test( 'Portable backup round trip preserves real settings and history across denied and restored access', async () => {
	test.setTimeout( 180_000 );
	await withBrowser( async ( browser, url, files ) => {
		await enroll( browser, url );
		await settings( browser, 'protected-sites' );
		await expect.poll( () => readView( browser, 'selected', 'return Boolean(document.querySelector(".settings-site-manage"));' ) ).toBe( true );
		await browser.viewClick( 'selected', '.settings-site-manage' );
		await fill( browser, '.settings-site-editor input[id$="-name"]', 'Backup focus site' );
		await browser.viewClick( 'selected', '.settings-site-editor input[type=checkbox]' );
		const weekend = await readView( browser, 'selected', 'return [0, 6].includes(new Date().getDay());' );
		await clickButton( browser, weekend ? 'Sat - Sun, all day' : 'Mon - Fri, all day', '.settings-site-editor' );
		await clickButton( browser, 'Done', '.settings-site-editor' );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("[role=dialog]") === null;' ) ).toBe( true );
		await save( browser );
		await settings( browser, 'appearance' );
		await browser.viewClick( 'selected', '.preferences-theme-card[aria-label="Dark"]' );
		await browser.viewClick( 'selected', '.preferences-palette-card[data-palette="purple"]' );
		await browser.viewClick( 'selected', 'input[name="pause-mode"][value="quiet"]' );
		await save( browser );
		await browser.openPage( `${ url }backup-history` );
		await continuePause( browser );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }backup-history` );
		await browser.closePage();
		await settings( browser, 'privacy' );
		await clickButton( browser, 'Export backup', '.settings-backup' );
		const backup = await files.readBackup();
		expect( backup ).toMatchObject( { application: 'TOCus', dataFormatVersion: '1.1.0',
			settings: { sites: [ { displayNameOverride: 'Backup focus site' } ] },
			preferences: { theme: 'dark', palette: 'purple', pauseMode: 'quiet' },
			statistics: { scopes: { scope_default: { completedWaitCount: 1, allowanceGrantedCount: 1 } } },
		} );
		expect( backup.statistics.scopes.scope_default ).not.toHaveProperty( 'activeAllowance' );
		expect( backup.settings ).not.toHaveProperty( 'measurementRevisionsByScope' );
		const configuration = await stored( browser, configurationKey );
		const preferences = await stored( browser, preferencesKey );
		const history = await stored( browser, statisticsKey );
		const unsupported = await files.writeBackup( { ...backup, dataFormatVersion: '9.0.0' } );
		await browser.viewUpload( 'selected', '.settings-backup input[type=file]', unsupported );
		await expect.poll( () => readView( browser, 'selected', 'return document.body.innerText;' ) ).toContain( "data format isn't supported" );
		expect( await stored( browser, configurationKey ) ).toEqual( configuration );
		expect( await stored( browser, preferencesKey ) ).toEqual( preferences );
		expect( await stored( browser, statisticsKey ) ).toEqual( history );
		const path = await files.writeBackup( backup );
		await preview( browser, path );
		await clickButton( browser, 'Cancel', '[role=dialog]' );
		expect( await stored( browser, configurationKey ) ).toEqual( configuration );
		await clickButton( browser, 'Reset all TOCus data', '.settings-page' );
		await clickButton( browser, 'Reset all TOCus data', '[role=dialog]' );
		await expect.poll( () => browser.currentUrl() ).toContain( '/onboarding.html' );
		await settings( browser, 'privacy' );
		await preview( browser, path );
		await clickButton( browser, 'Replace settings and statistics', '[role=dialog]' );
		await browser.consent( false );
		await expect.poll( () => readView( browser, 'selected', 'return document.body.innerText;' ) ).toContain( 'Some websites still need browser access' );
		expect( ( await stored( browser, configurationKey ) ).sites ).toEqual( configuration.sites );
		expect( ( await stored( browser, preferencesKey ) ) ).toEqual( preferences );
		const restored = await stored( browser, statisticsKey );
		expect( restored.dailyTotals ).toEqual( backup.statistics.dailyTotals );
		expect( restored.scopes.scope_default.totals ).toEqual( backup.statistics.scopes.scope_default );
		expect( restored.generationId ).not.toBe( history.generationId );
		expect( await protectionState( browser ) ).toMatchObject( { navigation: false, rules: 0 } );
		await browser.openPage( `${ url }without-access` );
		await expect.poll( () => browser.currentUrl() ).toBe( `${ url }without-access` );
		await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("h1")?.textContent;' ) ).toBe( 'Protected destination' );
		await browser.closePage();
		await settings( browser, 'protected-sites' );
		await expect.poll( () => readView( browser, 'selected', 'return document.body.innerText;' ) ).toContain( 'Access required' );
		await clickButton( browser, 'Allow access', '.settings-site-access' );
		await browser.consent( true );
		await expect.poll( () => protectionState( browser ) ).toMatchObject( { navigation: true, rules: 1 } );
		await settings( browser, 'statistics' );
		await reload( browser );
		for ( const range of [ 'current-week', 'current-month', 'all-time' ] ) {
			await setSelect( browser, '.settings-statistics-period-select select', range );
			await expect.poll( () => readView( browser, 'selected', 'return document.querySelector(".settings-metrics")?.textContent;' ) ).toContain( '1' );
		}
		await browser.openPage( `${ url }after-restore` );
		await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
	} );
} );
