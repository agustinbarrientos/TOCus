import { expect } from '@playwright/test';
import { Language } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'Settings notifications', () => {
	for ( const action of [ 'Save', 'Discard' ] ) {
		test( `keeps confirmed ${ action } feedback visible after guarded navigation`, async ( { open } ) => {
			const page = await open();
			await page.getByRole( 'slider' ).first().focus();
			await page.keyboard.press( 'End' );
			await page.getByRole( 'link', { name: 'About', exact: true } ).click();
			await page.getByRole( 'dialog' ).getByRole( 'button', { name: action, exact: true } ).click();
			await expect( page ).toHaveURL( /#about$/ );
			const notification = page.locator( '.mantine-Notification-root[role="status"]' );
			await expect( notification ).toHaveText( action === 'Save' ? 'Changes saved.' : 'Changes discarded.' );
			await expect( page.getByRole( 'main' ).getByRole( 'status' ) ).toHaveCount( 0 );
			await notification.getByRole( 'button', { name: 'Dismiss notification' } ).click();
			await expect( notification ).toHaveCount( 0 );
		} );
	}

	test( 'waits for confirmed persistence and keeps failures inline', async ( { open, setting } ) => {
		const page = await open();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await setting( page, 'holdConfigurationWrites', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		const notification = page.locator( '.mantine-Notification-root[role="status"]' );
		await expect( notification ).toHaveCount( 0 );
		await page.evaluate( () => {
			window.settingsTest.releaseConfigurationWrites();
		} );
		await expect( notification ).toHaveText( 'Changes saved.' );
		await notification.getByRole( 'button', { name: 'Dismiss notification' } ).click();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'Home' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'main' ).getByRole( 'alert' ) ).toBeVisible();
		await expect( notification ).toHaveCount( 0 );
	} );

	test( 'uses regional copy for direct discard and does not replay after navigation', async ( { open } ) => {
		const page = await open( SettingsDestination.TIMING, Language.SPANISH_VOS );
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await page.getByRole( 'button', { name: 'Descartar', exact: true } ).click();
		const notification = page.locator( '.mantine-Notification-root[role="status"]' );
		await expect( notification ).toHaveText( 'Cambios descartados.' );
		await notification.getByRole( 'button', { name: 'Cerrar notificaci\u00f3n' } ).click();
		await page.locator( 'nav a[href="#about"]' ).click();
		await page.locator( 'nav a[href="#timing"]' ).click();
		await expect( page.getByRole( 'button', { name: 'Descartar', exact: true } ) ).toBeDisabled();
		await expect( notification ).toHaveCount( 0 );
	} );
} );
