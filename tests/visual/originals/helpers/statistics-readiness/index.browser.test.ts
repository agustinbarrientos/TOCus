import { expect, test } from '@playwright/test';
import { waitForStatisticsState } from './index';

for ( const name of [
	'settings-statistics-light.png',
	'settings-statistics-dark.png',
	'statistics-settings-screen-empty-light.png',
	'statistics-settings-screen-loading-light.png',
	'statistics-settings-screen-narrow-light.png',
	'statistics-settings-screen-populated-light.png',
	'statistics-settings-screen-populated-dark.png',
	'statistics-settings-screen-unavailable-dark.png',
] ) {
	test( `settles the actual Statistics scenario before capture: ${ name }`, async ( { page } ) => {
		const isolated = name.startsWith( 'statistics-settings-screen-' );
		const narrow = name.includes( 'narrow' );
		const theme = name.includes( 'dark' ) ? 'dark' : 'light';
		const parameters = new URLSearchParams( { original: name, theme, palette: 'brown',
			width: narrow ? '404' : '768' } );
		if ( isolated ) {
			parameters.set( 'isolated', 'true' );
		}
		await page.setViewportSize( { width: narrow ? 420 : 1280, height: 1200 } );
		await page.emulateMedia( { colorScheme: theme, reducedMotion: 'reduce' } );
		await page.goto( `/apps/extension/src/features/settings/components/shell/__fixtures__/index.html?${ parameters }#statistics` );
		await waitForStatisticsState( page, name );

		// Inspect immediately so a second locator wait cannot conceal premature fixture readiness.
		if ( name.includes( 'loading' ) ) {
			expect( await page.getByRole( 'status' ).getAttribute( 'class' ) ).toContain( 'mantine-Paper-root' );
		} else if ( name.includes( 'unavailable' ) ) {
			expect( await page.getByRole( 'alert' ).allTextContents() ).toEqual( [
				expect.stringContaining( 'Statistics are unavailable' ),
			] );
		} else {
			expect( await page.locator( '.settings-metrics dd' ).allTextContents() ).toEqual(
				name.includes( 'empty' ) ? [ '0 minutes', '0', '0', '0' ] : [ '27 minutes', '18', '24', '11' ],
			);
		}
	} );
}
