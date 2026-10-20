import { expect, type Page } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

/**
 * Stages an explicit address through the production website form.
 * @param page - Isolated Settings page.
 * @param address - User-entered host or path.
 * @return Completion of the staged addition.
 */
async function add( page: Page, address: string ): Promise<void> {
	await page.getByLabel( 'Website address', { exact: true } ).fill( address );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
}

test( 'marks an unconfigured parent No pause without saving an extra rule', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await add( page, 'news.example.com' );
	const parent = page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name: 'Example', exact: true } ) } );
	await expect( parent ).toContainText( 'No pause' );
	await expect( parent.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ) ).toHaveCount( 0 );
	await expect( page.locator( '.settings-site-exception' ) ).not.toContainText( 'No pause' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map(
		( site ) => site.rule.host ) ) )
		.toEqual( [ 'news.example.com' ] );
} );

test( 'groups product paths under their own identity and selects only that product', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'mail.google.com', 'drive.google.com', 'mail.google.com/inbox' ] ) {
		await add( page, address );
	}
	await expect( page.getByRole( 'heading', { name: 'Gmail', exact: true } ) ).toBeVisible();
	await expect( page.getByRole( 'heading', { name: 'Google Drive', exact: true } ) ).toBeVisible();
	await expect( page.getByRole( 'heading', { name: 'Google', exact: true } ) ).toHaveCount( 0 );
	await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 1 );
	await expect( page.locator( '.settings-site-exception' ) ).toContainText( 'mail.google.com/inbox' );
	const main = page.getByRole( 'checkbox', { name: 'Select Gmail', exact: true } );
	const path = page.getByRole( 'checkbox', { name: 'Select mail.google.com/inbox', exact: true } );
	await path.focus();
	await page.keyboard.press( 'Space' );
	await expect( main ).toHaveAttribute( 'aria-checked', 'mixed' );
	await main.check();
	await expect( path ).toBeChecked();
	await expect( page.getByRole( 'checkbox', { name: 'Select Google Drive', exact: true } ) ).not.toBeChecked();
	await page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Gmail', exact: true } ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'heading', { name: 'Google Drive', exact: true } ) ).toBeVisible();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map(
		( site ) => site.rule.host ) ) )
		.toEqual( [ 'drive.google.com' ] );
} );

test( 'checks broad ancestor coverage before marking a path-only product No pause', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await add( page, 'mail.google.com/inbox' );
	const parent = page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name: 'Gmail', exact: true } ) } );
	await expect( parent ).toContainText( 'No pause' );
	await add( page, 'google.com' );
	await expect( parent ).not.toContainText( 'No pause' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) =>
		[ site.rule.host, site.rule.pathPrefix ] ) ) ).toEqual( [ [ 'mail.google.com', '/inbox' ], [ 'google.com', undefined ] ] );
} );

test( 'retains product names and editable pause behavior in a top-level product editor', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await add( page, 'music.youtube.com' );
	const product = page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name: 'YouTube Music', exact: true } ) } );
	await product.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
	const dialog = page.getByRole( 'dialog' );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
	await expect( dialog.getByLabel( 'When visited', { exact: true } ) ).toHaveValue( 'pause' );
	await expect( dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ) ).toBeVisible();
	await dialog.getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( product ).toContainText( 'No pause' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) =>
		[ site.rule.host, site.rule.behavior ] ) ) ).toEqual( [ [ 'music.youtube.com', 'allow' ] ] );
} );

test( 'keeps separate product rows readable at phone width', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.setViewportSize( { width: 320, height: 844 } );
	await add( page, 'music.youtube.com' );
	await add( page, 'music.youtube.com/playlist' );
	await expect( page.getByRole( 'heading', { name: 'YouTube Music', exact: true } ) ).toBeVisible();
	await expect( page.getByText( 'music.youtube.com/playlist', { exact: true } ) ).toBeVisible();
	expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
} );

test( 'names a legacy broad rule for its actual website rather than a separate product identity', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await add( page, 'google.com' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	await page.evaluate( () => {
		const site = window.settingsTest.getConfiguration().sites[ 0 ];
		if ( site ) {
			site.identityHost = 'mail.google.com';
		}
	} );
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Google', exact: true } ) ).toBeVisible();
	await expect( page.getByRole( 'heading', { name: 'Gmail', exact: true } ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
	await expect( page.getByRole( 'dialog' ).getByLabel( 'Name', { exact: true } ) ).toHaveAttribute( 'placeholder', 'Google' );
	await page.getByRole( 'dialog' ).getByLabel( 'Name', { exact: true } ).fill( 'Work search' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'heading', { name: 'Work search', exact: true } ) ).toBeVisible();
} );

test( 'shows each product cached favicon beside its own website row', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.evaluate( () => {
		window.settingsTest.setFaviconProvider( {
			/**
			 * Supplies distinct local cache images for each product and its umbrella.
			 * @param host - Exact canonical host requested by the existing cache boundary.
			 * @return Embedded synthetic icon without website requests.
			 */
			getSource: ( host ) => {
				const color = host === 'mail.google.com' ? 'red' : host === 'drive.google.com' ? 'green' : 'blue';
				return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="${ color }"/%3E%3C/svg%3E`;
			},
		} );
	} );
	await add( page, 'mail.google.com' );
	await add( page, 'drive.google.com' );
	for ( const { name, color } of [ { name: 'Gmail', color: 'red' }, { name: 'Google Drive', color: 'green' } ] ) {
		const row = page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name, exact: true } ) } );
		await expect( row.locator( 'img' ) ).toHaveAttribute( 'src', new RegExp( `fill="${ color }"` ) );
	}
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
} );
