import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test( 'groups sibling paths without adding a root and edits complete exception policies tentatively', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com/shorts', 'youtube.com/feed' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 2 );
	await expect( page.getByText( 'Exceptions', { exact: true } ) ).toHaveCount( 1 );
	const child = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	const dialog = page.getByRole( 'dialog', { name: 'youtube.com/shorts', exact: true } );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toHaveCount( 0 );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider' ) ).toHaveCount( 4 );
	await expect( dialog.getByRole( 'radio' ) ).toHaveCount( 2 );
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Mon - Fri, all day', exact: true } ).click();
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveCount( 5 );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).toContainText( 'Custom pause timing' );
	await expect( child ).toContainText( 'Custom schedule' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) => site.rule.pathPrefix ) ) ).toEqual( [ '/shorts', '/feed' ] );
} );

test( 'starts child timing from the staged main policy and retains tentative toggles until Done', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com', 'youtube.com/shorts' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	const main = page.locator( '.settings-site-item:not(.settings-site-exception)' );
	const child = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	const edit = 'Change when TOCus pauses this site, or rename it';
	await main.getByRole( 'button', { name: edit, exact: true } ).click();
	let dialog = page.getByRole( 'dialog' );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await expect( page.locator( '#initial-wait' ) ).toHaveCount( 1 );
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '20' );
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( child ).not.toContainText( 'Custom pause timing' );
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await main.getByRole( 'button', { name: edit, exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	dialog = page.getByRole( 'dialog' );
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).not.toContainText( 'Custom pause timing' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) =>
		site.timingConfiguration?.initialWaitMilliseconds ) ) ).toEqual( [ 20000, undefined, undefined ] );
} );

test( 'keeps no-pause behavior isolated through Escape, Done, Save and Discard', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'studio.youtube.com' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	const child = page.locator( '.settings-site-exception' );
	const edit = child.getByRole( 'button', { name: 'Edit exception', exact: true } );
	await edit.click();
	await page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await expect( page.getByRole( 'dialog' ).getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ) ).toHaveCount( 0 );
	await page.keyboard.press( 'Escape' );
	await expect( child ).not.toContainText( 'No pause' );
	await edit.click();
	await expect( page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ) ).toHaveValue( 'pause' );
	await page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).toContainText( 'No pause' );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( child ).not.toContainText( 'No pause' );
	await edit.click();
	await page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ]?.rule ) ).toMatchObject( { host: 'studio.youtube.com', includeSubdomains: false, behavior: 'allow' } );
} );

test( 'rejects exact duplicates and selects or removes only captured group members', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com', 'youtube.com/shorts', 'youtube.com/feed' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'www.youtube.com/shorts/' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	const shorts = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	await expect( shorts ).toHaveAttribute( 'data-highlighted', 'true' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 4 );
	await page.getByLabel( 'Website address', { exact: true } ).fill( '' );
	await shorts.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 2 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } ).focus();
	await page.keyboard.press( 'Space' );
	await expect( page.getByRole( 'button', { name: 'Remove selected (4)', exact: true } ) ).toBeVisible();
	for ( const checkbox of await page.getByRole( 'checkbox' ).all() ) {
		await expect( checkbox ).toBeChecked();
	}
	await page.getByRole( 'button', { name: 'Remove selected (4)', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	for ( const checkbox of await page.getByRole( 'checkbox' ).all() ) {
		await expect( checkbox ).not.toBeChecked();
	}
	await page.locator( '.settings-site-item:not(.settings-site-exception)' ).getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 0 );
} );

test( 'keeps exception fields usable with narrow enlarged text and reduced motion', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.setViewportSize( { width: 320, height: 844 } );
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.addStyleTag( { content: 'html { font-size: 125%; }' } );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'youtube.com/shorts' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	const child = page.locator( '.settings-site-exception' );
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	const dialog = page.getByRole( 'dialog', { name: 'youtube.com/shorts', exact: true } );
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Mon - Fri, all day', exact: true } ).click();
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveCount( 5 );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Allowance', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'radio', { name: 'Open the site automatically', exact: true } ).check();
	await expect( dialog.getByText( /automatically/ ).last() ).toBeVisible();
	expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Allowance', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '6' );
	await expect( dialog.getByRole( 'radio', { name: 'Open the site automatically', exact: true } ) ).toBeChecked();
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).not.toContainText( 'Custom schedule' );
	await expect( child ).toContainText( 'Custom pause timing' );
} );

test( 'retains browser access for a main website when only its exception is removed', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com', 'youtube.com/shorts' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	const requests = await page.evaluate( () => window.settingsTest.controls.requests );
	await page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } )
		.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	await expect( page.getByText( 'Access required', { exact: true } ) ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) => site.rule.host ) ) ).toEqual( [ 'youtube.com', 'studio.youtube.com' ] );
} );
