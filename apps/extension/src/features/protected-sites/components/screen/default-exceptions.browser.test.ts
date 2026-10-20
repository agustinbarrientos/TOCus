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

test( 'edits a main website to No pause while retaining its paused child and saved custom preferences', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'youtube.com' );
	await expect( page.getByLabel( 'When visited', { exact: true } ) ).toHaveCount( 0 );
	await page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await page.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
	await page.getByLabel( 'End', { exact: true } ).fill( '17:00' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await addSite( page, 'youtube.com/shorts' );
	const main = page.locator( '.settings-site-item:not(.settings-site-exception)' );
	const shorts = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	const edit = main.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } );
	await edit.click();
	const dialog = page.getByRole( 'dialog', { name: 'YouTube', exact: true } );
	const behavior = dialog.getByLabel( 'When visited', { exact: true } );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
	await expect( behavior ).toHaveValue( 'pause' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await save( page, 1 );
	const initialSites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	const initialMain = initialSites.find( ( site ) => site.rule.host === 'youtube.com' && ! site.rule.pathPrefix );
	const initialShorts = initialSites.find( ( site ) => site.rule.pathPrefix === '/shorts' );
	await edit.click();
	await behavior.selectOption( 'allow' );
	await expect( dialog.getByRole( 'switch' ) ).toHaveCount( 0 );
	await expect( dialog.locator( '.settings-weekly-editor' ) ).toHaveCount( 0 );
	await expect( dialog.getByRole( 'slider' ) ).toHaveCount( 0 );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( main ).not.toContainText( 'No pause' );
	await expect( main ).toContainText( 'Custom schedule' );
	await expect( main ).toContainText( 'Custom pause timing' );
	await edit.click();
	await expect( behavior ).toHaveValue( 'pause' );
	await behavior.selectOption( 'allow' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( main ).toContainText( 'No pause' );
	await expect( main ).not.toContainText( 'Custom schedule' );
	await expect( main ).not.toContainText( 'Custom pause timing' );
	await expect( shorts ).not.toContainText( 'No pause' );
	await save( page, 2 );
	const savedSites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	const savedMain = savedSites.find( ( site ) => site.rule.host === 'youtube.com' && ! site.rule.pathPrefix );
	expect( savedMain?.rule.behavior ).toBe( 'allow' );
	expect( savedMain?.schedule ).toEqual( initialMain?.schedule );
	expect( savedMain?.timingConfiguration ).toEqual( initialMain?.timingConfiguration );
	expect( savedSites.find( ( site ) => site.rule.pathPrefix === '/shorts' ) ).toEqual( initialShorts );
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
	await edit.click();
	await expect( behavior ).toHaveValue( 'allow' );
	await expect( dialog.getByRole( 'switch' ) ).toHaveCount( 0 );
	await behavior.selectOption( 'pause' );
	await expect( dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ) ).toBeChecked();
	await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveValue( '09:00' );
	await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveValue( '17:00' );
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( main ).toContainText( 'No pause' );
	await shorts.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	await expect( page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ) ).toHaveValue( 'pause' );
	await page.keyboard.press( 'Escape' );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( savedSites );
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

test( 'hides Studio scheduling for No pause and retains valid overrides when Pause returns', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSite( page, 'youtube.com' );
	const studio = page.locator( '.settings-site-exception' ).filter( { hasText: 'studio.youtube.com' } );
	const edit = studio.getByRole( 'button', { name: 'Edit exception', exact: true } );
	await edit.click();
	const dialog = page.getByRole( 'dialog' );
	const behavior = dialog.getByLabel( 'When visited', { exact: true } );
	const schedule = dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } );
	await expect( behavior ).toHaveValue( 'allow' );
	await expect( schedule ).toHaveCount( 0 );
	await behavior.selectOption( 'pause' );
	await expect( schedule ).toBeVisible();
	await schedule.click();
	await dialog.getByLabel( 'Day', { exact: true } ).selectOption( 'Wednesday' );
	await dialog.getByLabel( 'Start', { exact: true } ).fill( '09:30' );
	await dialog.getByLabel( 'End', { exact: true } ).fill( '17:45' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await behavior.selectOption( 'allow' );
	await expect( schedule ).toHaveCount( 0 );
	await expect( dialog.locator( '.settings-weekly-editor' ) ).toHaveCount( 0 );
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveCount( 0 );
	await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 0 );
	await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveCount( 0 );
	await behavior.selectOption( 'pause' );
	await expect( schedule ).toBeChecked();
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveValue( 'Wednesday' );
	await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveValue( '09:30' );
	await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveValue( '17:45' );
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await behavior.selectOption( 'allow' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( dialog ).toHaveCount( 0 );
	await expect( studio ).toContainText( 'No pause' );
	await expect( studio ).not.toContainText( 'Custom schedule' );
	await save( page, 1 );
	const saved = await page.evaluate( () => window.settingsTest.getConfiguration().sites.find(
		( site ) => site.rule.host === 'studio.youtube.com' ) );
	expect( saved?.rule.behavior ).toBe( 'allow' );
	expect( saved?.schedule ).toEqual( {
		mode: 'custom', windows: [ { weekday: 'Wednesday', startMinute: 570, endMinute: 1065 } ],
	} );
	expect( saved?.timingConfiguration?.initialWaitMilliseconds ).toBe( 15000 );
	await edit.click();
	await expect( schedule ).toHaveCount( 0 );
	await behavior.selectOption( 'pause' );
	await expect( schedule ).toBeChecked();
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveValue( 'Wednesday' );
	await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveValue( '09:30' );
	await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveValue( '17:45' );
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
} );

test( 'applies No pause after an unfinished custom schedule without blocking Done or Save', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSite( page, 'youtube.com' );
	const studio = page.locator( '.settings-site-exception' ).filter( { hasText: 'studio.youtube.com' } );
	await studio.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	const dialog = page.getByRole( 'dialog' );
	const behavior = dialog.getByLabel( 'When visited', { exact: true } );
	await behavior.selectOption( 'pause' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( dialog ).toBeVisible();
	await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveAttribute( 'aria-invalid', 'true' );
	await behavior.selectOption( 'allow' );
	await behavior.selectOption( 'pause' );
	await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveValue( '09:00' );
	await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveValue( '' );
	await behavior.selectOption( 'allow' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( dialog ).toHaveCount( 0 );
	await expect( studio ).toContainText( 'No pause' );
	await expect( studio ).not.toContainText( 'Custom schedule' );
	await save( page, 1 );
	const saved = await page.evaluate( () => window.settingsTest.getConfiguration().sites.find(
		( site ) => site.rule.host === 'studio.youtube.com' ) );
	expect( saved?.rule.behavior ).toBe( 'allow' );
	expect( saved?.schedule ).toBeUndefined();
	expect( saved?.timingConfiguration?.initialWaitMilliseconds ).toBe( 15000 );
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
