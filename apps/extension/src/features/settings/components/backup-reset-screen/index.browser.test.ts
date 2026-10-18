import { expect } from '@playwright/test';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'backup and reset operations', () => {
	for ( const label of [ 'Reset statistics', 'Reset all TOCus data' ] ) {
		test( `confirms ${ label }, preserves cancellation and supports explicit retry`, async ( { open, setting } ) => {
			test.setTimeout( 20000 );
			const page = await open( SettingsDestination.BACKUP_RESET );
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
			await page.locator( '.mantine-Notification-root[role="status"]' ).waitFor();
			expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 2 );
			expect( await page.getByRole( 'button', { name: 'Save', exact: true } ).count() ).toBe( 0 );
		} );
	}
} );
