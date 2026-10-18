import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
 * Saves a real focus destination through Settings and captures its generated stable identity.
 * @param {object} browser - Disposable installed browser.
 * @param {string} destination - Local fixture address saved by the user.
 * @return {Promise<object>} Persisted link with its production-generated identity.
 * @since 1.1.0
 */
async function saveFocusLink( browser, destination ) {
	await settings( browser, 'focus-links' );
	await expect.poll( () => readView( browser, 'selected', `const control = document.querySelector('.settings-focus-links-add');
		return control instanceof HTMLButtonElement && !control.disabled && control.getClientRects().length > 0;` ) ).toBe( true );
	await clickButton( browser, 'Add link', '.settings-focus-links' );
	await fill( browser, 'input[id^="label-focus_link_"]', 'Return to my project' );
	await fill( browser, 'input[id^="url-focus_link_"]', destination );
	await save( browser );
	await expect.poll( async () => ( await stored( browser, preferencesKey ) )?.focusLinks ).toEqual( [ {
		id: expect.stringMatching( /^focus_link_[A-Za-z0-9_-]+$/ ), label: 'Return to my project', url: destination,
	} ] );
	const preferences = await stored( browser, preferencesKey );
	return preferences.focusLinks[ 0 ];
}

/**
 * Waits for the authoritative statistics projection before selecting its native period control.
 * @param {object} browser - Disposable installed browser.
 * @param {string} range - Exact calendar range option.
 */
async function selectStatisticsRange( browser, range ) {
	const selector = '.settings-statistics-period-select select';
	await expect.poll( () => readView( browser, 'selected', `const select = document.querySelector(${ JSON.stringify( selector ) });
		return select instanceof HTMLSelectElement && !select.disabled && select.getClientRects().length > 0 &&
			[...select.options].some(option => option.value === ${ JSON.stringify( range ) } && !option.disabled);` ) ).toBe( true );
	await setSelect( browser, selector, range );
}

/**
 * Waits for asynchronously loaded appearance preferences before the single trusted theme click.
 * @param {object} browser - Disposable installed browser.
 */
async function waitForAppearance( browser ) {
	await expect.poll( () => readView( browser, 'selected', `const control =
		document.querySelector('.preferences-theme-card[aria-label="Dark"]');
		return control !== null && control.getClientRects().length > 0 &&
			!control.matches(':disabled, [aria-disabled="true"], [data-disabled]');` ) ).toBe( true );
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
	const transfer = await mkdtemp( join( tmpdir(), 'tocus-backup-restore-' ) );
	const path = join( transfer, 'downloaded-backup.json' );
	let backup;
	let configuration;
	let preferences;
	let history;
	let focusLink;
	try {
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
			await waitForAppearance( browser );
			await browser.viewClick( 'selected', '.preferences-theme-card[aria-label="Dark"]' );
			await browser.viewClick( 'selected', '.preferences-palette-card[data-palette="purple"]' );
			await browser.viewClick( 'selected', 'input[name="pause-mode"][value="quiet"]' );
			await save( browser );
			focusLink = await saveFocusLink( browser, `${ url }backup-project` );
			await browser.openPage( `${ url }backup-history` );
			await continuePause( browser );
			await expect.poll( () => browser.currentUrl() ).toBe( `${ url }backup-history` );
			await browser.closePage();
			await settings( browser, 'backup-reset' );
			await clickButton( browser, 'Export backup', '.settings-backup' );
			backup = await files.readBackup();
			// Move away from hover-paused export feedback before starting the next decision.
			await browser.viewClick( 'selected', 'h1' );
			await expect.poll( () => readView( browser, 'selected', 'return document.querySelector(".tocus-snackbar") === null;' ) ).toBe( true );
			expect( backup ).toMatchObject( { application: 'TOCus', dataFormatVersion: '1.1.0',
				settings: { sites: [ { displayNameOverride: 'Backup focus site' } ] },
				preferences: { theme: 'dark', palette: 'purple', pauseMode: 'quiet', focusLinks: [ focusLink ] },
				statistics: { scopes: { scope_default: { completedWaitCount: 1, allowanceGrantedCount: 1 } } },
			} );
			expect( backup.preferences.focusLinks ).toEqual( [ focusLink ] );
			expect( backup.statistics.scopes.scope_default ).not.toHaveProperty( 'activeAllowance' );
			expect( backup.settings ).not.toHaveProperty( 'measurementRevisionsByScope' );
			configuration = await stored( browser, configurationKey );
			preferences = await stored( browser, preferencesKey );
			history = await stored( browser, statisticsKey );
			const unsupported = await files.writeBackup( { ...backup, dataFormatVersion: '9.0.0' } );
			await browser.viewUpload( 'selected', '.settings-backup input[type=file]', unsupported );
			await expect.poll( () => readView( browser, 'selected', 'return document.body.innerText;' ) ).toContain( "data format isn't supported" );
			expect( await stored( browser, configurationKey ) ).toEqual( configuration );
			expect( await stored( browser, preferencesKey ) ).toEqual( preferences );
			expect( await stored( browser, statisticsKey ) ).toEqual( history );
			const downloaded = await files.backupPath();
			const bytes = await readFile( downloaded );
			await cp( downloaded, path, { errorOnExist: true, force: false } );
			expect( await readFile( path ) ).toEqual( bytes );
			await preview( browser, path );
			await clickButton( browser, 'Cancel', '[role=dialog]' );
			expect( await stored( browser, configurationKey ) ).toEqual( configuration );
			await clickButton( browser, 'Reset all TOCus data', '.settings-page' );
			await clickButton( browser, 'Reset all TOCus data', '[role=dialog]' );
			await expect.poll( () => browser.currentUrl() ).toContain( '/onboarding.html' );
			await expect.poll( () => protectionState( browser ) ).toEqual( {
				origins: [], navigation: false, sites: [], rules: 0,
			} );
		} );
		// A fresh installation has no remembered grant that could suppress the native permission decision.
		await withBrowser( async ( browser, url ) => {
			await settings( browser, 'backup-reset' );
			await preview( browser, path );
			await clickButton( browser, 'Replace settings and statistics', '[role=dialog]' );
			await browser.consent( false );
			await expect.poll( () => readView( browser, 'selected', 'return document.body.innerText;' ) ).toContain( 'Some websites still need browser access' );
			expect( ( await stored( browser, configurationKey ) ).sites ).toEqual( configuration.sites );
			const restoredPreferences = await stored( browser, preferencesKey );
			expect( restoredPreferences ).toEqual( preferences );
			expect( restoredPreferences.focusLinks ).toEqual( [ focusLink ] );
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
				await selectStatisticsRange( browser, range );
				await expect.poll( () => metrics( browser ) ).toMatchObject( {
					'Completed waits': '1', 'Allowances granted': '1', 'Reconsidered visits': '0',
				} );
			}
			await clickButton( browser, 'Reset statistics', '.settings-statistics-data' );
			await expect.poll( () => readView( browser, 'selected', 'return Boolean(document.querySelector("[role=dialog]"));' ) ).toBe( true );
			await clickButton( browser, 'Reset statistics', '[role=dialog]' );
			await expect.poll( () => metrics( browser ) ).toMatchObject( {
				'Completed waits': '0', 'Allowances granted': '0', 'Reconsidered visits': '0',
			} );
			expect( await stored( browser, preferencesKey ) ).toEqual( restoredPreferences );
			await reload( browser );
			await expect.poll( () => metrics( browser ) ).toMatchObject( { 'Completed waits': '0', 'Allowances granted': '0' } );
			expect( ( await stored( browser, preferencesKey ) ).focusLinks ).toEqual( [ focusLink ] );
			await browser.openPage( `${ url }after-restore` );
			await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		} );
	} finally {
		await rm( transfer, { recursive: true, force: true } );
	}
} );


/**
 * Reads every visible metric by its localized label rather than matching stray digits.
 * @param {object} browser - Disposable installed browser.
 * @return {Promise<object>} Individual historical metrics displayed by production UI.
 */
function metrics( browser ) {
	return readView( browser, 'selected', `return Object.fromEntries([...document.querySelectorAll('.settings-metrics > div')]
		.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));` );
}

test( 'Imports the exact downloaded backup from a different installed browser', async () => {
	test.setTimeout( 180_000 );
	const sourceProduct = { chrome: 'firefox', edge: 'chrome', firefox: 'edge' }[ test.info().project.name ];
	if ( ! sourceProduct ) {
		throw new Error( 'Unknown destination browser.' );
	}
	const transfer = await mkdtemp( join( tmpdir(), 'tocus-backup-transfer-' ) );
	const path = join( transfer, 'downloaded-backup.json' );
	let backup;
	let focusLink;
	const expectedMetrics = {};
	try {
		await withBrowser( async ( browser, url, files ) => {
			await enroll( browser, url );
			await settings( browser, 'appearance' );
			await waitForAppearance( browser );
			await browser.viewClick( 'selected', '.preferences-theme-card[aria-label="Dark"]' );
			await browser.viewClick( 'selected', '.preferences-palette-card[data-palette="purple"]' );
			await save( browser );
			focusLink = await saveFocusLink( browser, `${ url }portable-project` );
			await browser.openPage( `${ url }portable-history` );
			await continuePause( browser );
			await expect.poll( () => browser.currentUrl() ).toBe( `${ url }portable-history` );
			await browser.closePage();
			await settings( browser, 'statistics' );
			for ( const range of [ 'current-week', 'current-month', 'all-time' ] ) {
				await selectStatisticsRange( browser, range );
				await expect.poll( () => metrics( browser ) ).toMatchObject( { 'Completed waits': '1', 'Allowances granted': '1' } );
				expectedMetrics[ range ] = await metrics( browser );
			}
			await settings( browser, 'backup-reset' );
			await clickButton( browser, 'Export backup', '.settings-backup' );
			const downloaded = await files.backupPath();
			const bytes = await readFile( downloaded );
			await cp( downloaded, path, { errorOnExist: true, force: false } );
			expect( await readFile( path ) ).toEqual( bytes );
			backup = JSON.parse( bytes.toString( 'utf8' ) );
			expect( backup.preferences.focusLinks ).toEqual( [ focusLink ] );
		}, { product: sourceProduct } );
		await withBrowser( async ( browser, url ) => {
			await settings( browser, 'backup-reset' );
			await preview( browser, path );
			await clickButton( browser, 'Replace settings and statistics', '[role=dialog]' );
			await browser.consent( true );
			await expect.poll( () => readView( browser, 'selected', 'return document.querySelector("[role=dialog]") === null;' ) ).toBe( true );
			const configuration = await stored( browser, configurationKey );
			expect( configuration.sites ).toEqual( backup.settings.sites );
			expect( configuration.schedule ).toEqual( backup.settings.schedule );
			expect( configuration.timingConfiguration ).toEqual( backup.settings.timingConfiguration );
			const preferences = await stored( browser, preferencesKey );
			const portablePreferences = Object.fromEntries( Object.entries( preferences ).filter( ( [ key ] ) => key !== 'schemaVersion' ) );
			expect( portablePreferences ).toEqual( backup.preferences );
			expect( preferences.focusLinks ).toEqual( [ focusLink ] );
			const statistics = await stored( browser, statisticsKey );
			expect( statistics.dailyTotals ).toEqual( backup.statistics.dailyTotals );
			for ( const [ scope, totals ] of Object.entries( backup.statistics.scopes ) ) {
				expect( statistics.scopes[ scope ].totals ).toEqual( totals );
				expect( statistics.scopes[ scope ] ).not.toHaveProperty( 'activeAllowance' );
			}
			await settings( browser, 'statistics' );
			await reload( browser );
			for ( const range of [ 'current-week', 'current-month', 'all-time' ] ) {
				await selectStatisticsRange( browser, range );
				await expect.poll( () => metrics( browser ) ).toEqual( expectedMetrics[ range ] );
			}
			await browser.openPage( `${ url }portable-protection` );
			await expect.poll( () => browser.currentUrl() ).toContain( '/pause.html' );
		} );
	} finally {
		await rm( transfer, { recursive: true, force: true } );
	}
} );
