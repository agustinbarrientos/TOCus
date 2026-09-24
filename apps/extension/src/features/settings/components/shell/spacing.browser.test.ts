import { expect } from '@playwright/test';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

const firstContentSelectors = {
	[ SettingsDestination.PROTECTED_SITES ]: '.settings-site-add',
	[ SettingsDestination.SCHEDULE ]: '.settings-behavior-label',
	[ SettingsDestination.TIMING ]: '.tocus-field-header',
	[ SettingsDestination.APPEARANCE ]: '.preferences-section-label',
	[ SettingsDestination.LANGUAGE ]: '.preferences-language-field-label',
	[ SettingsDestination.STATISTICS ]: '.settings-statistics-period',
	[ SettingsDestination.PRIVACY ]: '.tocus-section h2',
	[ SettingsDestination.ABOUT ]: '.settings-about-brand',
};

for ( const width of [ 1280, 390 ] ) {
	test( `keeps the same title-to-content spacing on every Settings page at ${ String( width ) }px`, async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.setViewportSize( { width, height: 1000 } );
		for ( const destination of Object.values( SettingsDestination ) ) {
			await page.locator( `nav a[href="#${ destination }"]` ).click();
			const firstContent = page.locator( '.settings-page' ).locator( firstContentSelectors[ destination ] ).first();
			await expect( firstContent ).toBeVisible();
			const spacing = await firstContent.evaluate( ( content ) => {
				const heading = document.querySelector( '.settings-page h1' );
				if ( ! heading ) {
					throw new Error( 'Expected a Settings page title.' );
				}
				return content.getBoundingClientRect().top - heading.getBoundingClientRect().bottom;
			} );
			expect.soft( spacing, destination ).toBe( 32 );
		}
	} );
}
