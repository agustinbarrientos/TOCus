import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test.describe( 'Website action snackbars', () => {
	test( 'reveals an existing website without treating its valid address as a field error', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.setViewportSize( { width: 1100, height: 500 } );
		const address = page.getByLabel( 'Website address', { exact: true } );
		for ( let index = 0; index < 8; index++ ) {
			await address.fill( `reading-${ String( index ) }.com` );
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		}
		await address.fill( 'https://www.reading-7.com/article' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await expect( page.getByRole( 'status' ).filter( { hasText: 'This site is already in your list.' } ) ).toBeVisible();
		await expect( address ).not.toHaveAttribute( 'aria-invalid', 'true' );
		const row = page.locator( '.settings-site-item' ).filter( { hasText: 'reading-7.com' } );
		await expect( row ).toBeInViewport();
		await expect( row ).toHaveAttribute( 'data-highlighted', 'true' );
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 8 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await expect( row ).not.toHaveAttribute( 'data-highlighted', 'true' );
	} );

	test( 'distinguishes draft additions, edits and removals from saved configuration', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await expect( page.getByRole( 'status' ).filter( { hasText: 'Site added. Save to apply your changes.' } ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByLabel( 'Name', { exact: true } ).fill( 'My reading' );
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( page.getByRole( 'status' ).filter( { hasText: 'Site updated. Save to apply your changes.' } ) ).toBeVisible();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'status' ).filter( { hasText: 'Changes saved.' } ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ]?.displayNameOverride ) ).toBe( 'My reading' );
		await page.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
		await expect( page.getByRole( 'status' ).filter( { hasText: 'Site removed. Save to apply your changes.' } ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 1 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByRole( 'status' ).filter( { hasText: 'Changes discarded.' } ) ).toBeVisible();
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 1 );
	} );

	test( 'keeps invalid addresses inline and does not announce a successful action', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'not a website' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await expect( page.locator( '#site-address-error' ) ).toBeVisible();
		await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveAttribute( 'aria-invalid', 'true' );
		await expect( page.locator( '.tocus-snackbar' ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );
} );
