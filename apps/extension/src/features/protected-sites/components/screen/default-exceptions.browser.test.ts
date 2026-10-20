import { expect, type Page } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

/**
 * Stages an address using the production form without committing its page draft.
 * @param page - Isolated Settings page.
 * @param address - Explicit address entered by the user.
 * @return Completion of the Add site action.
 */
async function addSite( page: Page, address: string ): Promise<void> {
	await page.getByLabel( 'Website address', { exact: true } ).fill( address );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
}

/**
 * Waits for a complete production configuration transaction.
 * @param page - Isolated Settings page.
 * @param writes - Expected total successful writes.
 * @return Completion of the atomic Save.
 */
async function save( page: Page, writes: number ): Promise<void> {
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( writes );
}

test( 'stages YouTube with an editable Studio no-pause exception and discards both together', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSite( page, 'https://www.youtube.com/' );
	const studio = page.locator( '.settings-site-exception' ).filter( { hasText: 'studio.youtube.com' } );
	await expect( page.getByRole( 'heading', { name: 'YouTube', exact: true } ) ).toBeVisible();
	await expect( studio ).toContainText( 'No pause' );
	await expect( studio.getByRole( 'checkbox', { name: 'Select studio.youtube.com', exact: true } ) ).toHaveCount( 1 );
	await studio.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	await expect( page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ) ).toHaveValue( 'allow' );
	await page.keyboard.press( 'Escape' );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
} );

test( 'saves a pending YouTube address and Studio atomically with the existing broad permission gesture', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'youtube.com' );
	await save( page, 1 );
	const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( sites.map( ( site ) => site.rule ) ).toEqual( [
		expect.objectContaining( { host: 'youtube.com', includeSubdomains: true } ),
		expect.objectContaining( { host: 'studio.youtube.com', includeSubdomains: false, behavior: 'allow' } ),
	] );
	expect( sites[ 0 ]?.rule.behavior ).toBeUndefined();
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
	await expect( page.locator( '.settings-site-exception' ) ).toContainText( 'No pause' );
	await expect( page.getByText( 'Access required', { exact: true } ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'button', { name: 'Allow access', exact: true } ) ).toHaveCount( 0 );
} );

test( 'preserves a Studio policy edited before the first Save and after duplicate root enrollment', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSite( page, 'youtube.com' );
	const studio = page.locator( '.settings-site-exception' ).filter( { hasText: 'studio.youtube.com' } );
	await studio.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	const dialog = page.getByRole( 'dialog' );
	await dialog.getByLabel( 'When visited', { exact: true } ).selectOption( 'pause' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await save( page, 1 );
	await expect( studio ).not.toContainText( 'No pause' );
	await expect( studio ).toContainText( 'Custom pause timing' );
	const saved = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( saved[ 1 ]?.timingConfiguration?.initialWaitMilliseconds ).toBe( 15000 );
	await addSite( page, 'www.youtube.com' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	await page.getByLabel( 'Website address', { exact: true } ).fill( '' );
	await addSite( page, 'example.com' );
	await save( page, 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.slice( 0, 2 ) ) ).toEqual( saved );
} );

test( 'does not recreate a default exception removed before saving YouTube', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSite( page, 'youtube.com' );
	const studio = page.locator( '.settings-site-exception' ).filter( { hasText: 'studio.youtube.com' } );
	await studio.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await save( page, 1 );
	await expect( studio ).toHaveCount( 0 );
	await addSite( page, 'www.youtube.com' );
	await page.getByLabel( 'Website address', { exact: true } ).fill( '' );
	await addSite( page, 'youtube.com/shorts' );
	await save( page, 2 );
	await expect( studio ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) =>
		[ site.rule.host, site.rule.pathPrefix ] ) ) ).toEqual( [ [ 'youtube.com', undefined ], [ 'youtube.com', '/shorts' ] ] );
} );

test( 'preserves an explicit Studio pause when the covering YouTube root is added later', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSite( page, 'studio.youtube.com' );
	await save( page, 1 );
	const savedStudio = await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] );
	await addSite( page, 'youtube.com' );
	await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 1 );
	await expect( page.locator( '.settings-site-exception' ) ).not.toContainText( 'No pause' );
	await save( page, 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] ) ).toEqual( savedStudio );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 2 );
} );

for ( const failure of [ 'denyAccess', 'rejectSaves' ] as const ) {
	test( `retains the complete YouTube and Studio draft when ${ failure } prevents Save`, async ( { open, setting } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await addSite( page, 'youtube.com' );
		await setting( page, failure, true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'alert' ).first() ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
		await expect( page.locator( '.settings-site-exception' ) ).toContainText( 'No pause' );
		await setting( page, failure, false );
		await save( page, 1 );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 2 );
	} );
}
