import { SettingsDestination } from '../../services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { createSettingsBrowserHarness } from '../../utils/browser-test-harness';

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s privacy resets', ( _name, engine ) => {
		const { open, setting } = createSettingsBrowserHarness( engine );

		it( 'keeps the permissions disclosure styled as a section heading and keyboard-operable', async () => {
			const page = await open( SettingsDestination.PRIVACY );
			const heading = page.locator( '.tocus-section h2' ).first();
			const summary = page.locator( 'summary' );
			const typography = await heading.evaluate( ( element ) => {
				const style = getComputedStyle( element );
				return [ style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight ];
			} );
			const disclosureTypography = await summary.evaluate( ( element ) => {
				const style = getComputedStyle( element.firstElementChild ?? element );
				return [ style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight ];
			} );
			expect( disclosureTypography ).toEqual( typography );
			await summary.focus();
			await page.keyboard.press( 'Enter' );
			expect( await page.locator( 'details' ).getAttribute( 'open' ) ).not.toBeNull();
			await page.keyboard.press( 'Enter' );
			expect( await page.locator( 'details' ).getAttribute( 'open' ) ).toBeNull();
			await page.close();
		} );

		it.each( [ 'Reset statistics', 'Reset all TOCus data' ] )(
			'confirms %s, preserves cancellation and supports explicit retry', async ( label ) => {
				const page = await open( SettingsDestination.PRIVACY );
				const action = page.getByRole( 'main' ).getByRole( 'button', { name: label, exact: true } );
				await action.click();
				const dialog = page.getByRole( 'dialog' );
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
				await page.close();
			}, 20000,
		);
	},
);
