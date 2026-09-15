import { expect } from '@playwright/test';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'privacy resets', () => {
	test( 'keeps browser permissions visible as a matching section heading', async ( { open } ) => {
		const page = await open( SettingsDestination.PRIVACY );
		const heading = page.locator( '.tocus-section h2' ).first();
		const permissions = page.locator( '.settings-privacy-permissions' );
		await expect( permissions.getByRole( 'heading', { level: 2 } ) ).toBeVisible();
		await expect( permissions.locator( 'li' ) ).toHaveCount( 5 );
		await expect( page.locator( 'details, summary' ) ).toHaveCount( 0 );
		const typography = await heading.evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return [ style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight ];
		} );
		const permissionTypography = await permissions.getByRole( 'heading' ).evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return [ style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight ];
		} );
		expect( permissionTypography ).toEqual( typography );
		for ( const width of [ 768, 390 ] ) {
			await page.setViewportSize( { width, height: 900 } );
			for ( const item of await permissions.getByRole( 'listitem' ).all() ) {
				await expect( item ).toBeVisible();
			}
			expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		}
		await page.emulateMedia( { forcedColors: 'active' } );
		await expect( permissions.getByRole( 'heading' ) ).toBeVisible();
	} );

	for ( const label of [ 'Reset statistics', 'Reset all TOCus data' ] ) {
		test( `confirms ${ label }, preserves cancellation and supports explicit retry`, async ( { open, setting } ) => {
			test.setTimeout( 20000 );
			const page = await open( SettingsDestination.PRIVACY );
			const action = page.getByRole( 'main' ).getByRole( 'button', { name: label, exact: true } );
			await action.click();
			const dialog = page.getByRole( 'dialog' );
			const shape = await dialog.evaluate( ( element ) => {
				const style = getComputedStyle( element );
				return { radius: parseFloat( style.borderTopLeftRadius ),
					padding: [ style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft ] };
			} );
			expect( shape.radius ).toBe( 12 );
			expect( new Set( shape.padding ).size ).toBe( 1 );
			await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
			await dialog.waitFor( { state: 'hidden' } );
			expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 0 );
			await setting( page, 'rejectResets', true );
			await action.click();
			await dialog.getByRole( 'button', { name: label, exact: true } ).click();
			await dialog.getByRole( 'alert' ).waitFor();
			expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 1 );
			await setting( page, 'rejectResets', false );
			await dialog.getByRole( 'button', { name: 'Try again', exact: true } ).click();
			await dialog.waitFor( { state: 'hidden' } );
			await page.locator( '.mantine-Alert-root[role="status"]' ).waitFor();
			expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 2 );
			expect( await page.getByRole( 'button', { name: 'Save', exact: true } ).count() ).toBe( 0 );
		} );
	}
} );
