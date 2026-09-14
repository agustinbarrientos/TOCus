import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test.describe( 'protected site item access recovery', () => {
	test( 'keeps the access recovery message and its keyboard action readable at every width', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.locator( '#site-address' ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 1 );
		await page.evaluate( () => window.settingsTest.revoke() );
		const alert = page.locator( '.settings-site-access' );
		const message = alert.getByText( 'Access required', { exact: true } );
		const icon = alert.locator( '.mantine-Alert-icon' );
		const allow = alert.getByRole( 'button', { name: 'Allow access', exact: true } );
		await expect( alert ).toBeVisible();

		await page.setViewportSize( { width: 1280, height: 900 } );
		const [ desktopAlert, desktopMessage, desktopIcon, desktopButton ] = await Promise.all( [
			alert.boundingBox(), message.boundingBox(), icon.boundingBox(), allow.boundingBox(),
		] );
		if ( ! desktopAlert || ! desktopMessage || ! desktopIcon || ! desktopButton ) {
			throw new TypeError( 'The access recovery alert must retain its icon, message, and action.' );
		}
		expect( desktopMessage.x - ( desktopIcon.x + desktopIcon.width ) ).toBeLessThanOrEqual( 16 );
		expect( Math.abs( desktopIcon.y + desktopIcon.height / 2 - ( desktopMessage.y + desktopMessage.height / 2 ) ) )
			.toBeLessThanOrEqual( 2 );
		expect( Math.abs( desktopIcon.y + desktopIcon.height / 2 - ( desktopButton.y + desktopButton.height / 2 ) ) )
			.toBeLessThanOrEqual( 2 );
		expect( desktopButton.x + desktopButton.width ).toBeLessThanOrEqual( desktopAlert.x + desktopAlert.width );
		await page.getByRole( 'button', { name: 'Edit', exact: true } ).click();
		const advanced = page.locator( '.settings-site-item' ).getByRole( 'button', { name: 'Advanced', exact: true } );
		const [ accessBox, advancedBox ] = await Promise.all( [ alert.boundingBox(), advanced.boundingBox() ] );
		if ( ! accessBox || ! advancedBox ) {
			throw new TypeError( 'The access recovery alert and editor disclosure must remain visible together.' );
		}
		expect( advancedBox.y - ( accessBox.y + accessBox.height ) ).toBe( 24 );

		await page.setViewportSize( { width: 320, height: 844 } );
		const [ narrowAlert, narrowMessage, narrowButton ] = await Promise.all( [
			alert.boundingBox(), message.boundingBox(), allow.boundingBox(),
		] );
		if ( ! narrowAlert || ! narrowMessage || ! narrowButton ) {
			throw new TypeError( 'The narrow access recovery alert must retain its message and action.' );
		}
		expect( narrowButton.y ).toBeGreaterThanOrEqual( narrowMessage.y + narrowMessage.height );
		expect( narrowButton.x ).toBeGreaterThanOrEqual( narrowAlert.x );
		expect( narrowButton.x + narrowButton.width ).toBeLessThanOrEqual( narrowAlert.x + narrowAlert.width );
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );

		await page.setViewportSize( { width: 1280, height: 900 } );
		await allow.focus();
		const focusOutline = await allow.evaluate( ( button ) => {
			let clippingAncestor = button.parentElement;
			while ( clippingAncestor !== null ) {
				const style = getComputedStyle( clippingAncestor );
				if ( [ style.overflow, style.overflowX, style.overflowY ].some( ( value ) =>
					value === 'clip' || value === 'hidden' ) ) {
					const bounds = clippingAncestor.getBoundingClientRect();
					const buttonBounds = button.getBoundingClientRect();
					return {
						bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
						buttonBounds: { x: buttonBounds.x, y: buttonBounds.y,
							width: buttonBounds.width, height: buttonBounds.height },
					};
				}
				clippingAncestor = clippingAncestor.parentElement;
			}
			return null;
		} );
		if ( focusOutline !== null ) {
			const focusRing = 5;
			expect( focusOutline.buttonBounds.x - focusRing ).toBeGreaterThanOrEqual( focusOutline.bounds.x );
			expect( focusOutline.buttonBounds.y - focusRing ).toBeGreaterThanOrEqual( focusOutline.bounds.y );
			expect( focusOutline.buttonBounds.x + focusOutline.buttonBounds.width + focusRing )
				.toBeLessThanOrEqual( focusOutline.bounds.x + focusOutline.bounds.width );
			expect( focusOutline.buttonBounds.y + focusOutline.buttonBounds.height + focusRing )
				.toBeLessThanOrEqual( focusOutline.bounds.y + focusOutline.bounds.height );
		}
		await page.keyboard.press( 'Enter' );
		await expect.poll( () => alert.count() ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	} );
} );
