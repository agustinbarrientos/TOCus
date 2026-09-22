import { test, expect } from '../packaged-protection/__fixtures__';
import { PackagedExtensionBuild } from '../packaged-protection/types';

test.use( { extensionBuild: PackagedExtensionBuild.EDGE, pregrantSite: false } );

test( 'mounts Edge-built extension pages in bundled Chromium', async ( { page, extensionRoot } ) => {
	const errors: string[] = [];
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );
	for ( const document of [ 'popup.html', 'options.html', 'onboarding.html' ] ) {
		await test.step( `Mount ${ document } from the Edge artifact`, async () => {
			await page.goto( new URL( document, extensionRoot ).href );
			await expect( page.locator( '[data-tocus-ui]' ).first() ).toBeVisible();
		} );
	}
	expect( errors ).toEqual( [] );
} );
