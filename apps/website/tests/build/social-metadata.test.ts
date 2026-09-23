import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

test( 'every generated page shares the matching localized image without JavaScript', async ( { browser } ) => {
	const context = await browser.newContext( { javaScriptEnabled: false } );
	try {
		const page = await context.newPage();
		await page.route( 'http://website.test/**', async ( route ) => {
			const url = new URL( route.request().url() );
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		for ( const [ path, imageLanguage ] of [
			[ '/', 'en' ], [ '/es/', 'es-tu' ], [ '/es-ar/', 'es-vos' ], [ '/de/', 'de' ],
			[ '/fr/', 'fr' ], [ '/it/', 'it' ], [ '/ja/', 'ja' ], [ '/pt-br/', 'pt-br' ],
			[ '/pt-pt/', 'pt-pt' ], [ '/ru/', 'ru' ], [ '/privacy/', 'en' ],
			[ '/support/', 'en' ], [ '/mascot-lab/', 'en' ],
		] as const ) {
			await test.step( `Check social preview for ${ path }`, async () => {
				await page.goto( `http://website.test${ path }` );
				const imagePath = `/images/og/${ imageLanguage }.png`;
				const imageUrl = `https://tocus.uo.ar${ imagePath }`;
				await expect( page.locator( 'meta[property="og:image"]' ) ).toHaveAttribute( 'content', imageUrl );
				await expect( page.locator( 'meta[name="twitter:image"]' ) ).toHaveAttribute( 'content', imageUrl );
				await expect( page.locator( 'meta[name="twitter:card"]' ) ).toHaveAttribute( 'content', 'summary_large_image' );
				await expect( page.locator( 'meta[property="og:url"]' ) )
					.toHaveAttribute( 'content', `https://tocus.uo.ar${ path }` );
				await expect( page.locator( 'meta[property="og:title"]' ) ).toHaveAttribute( 'content', await page.title() );
				await expect( page.locator( 'meta[property="og:image:alt"]' ) ).toHaveAttribute( 'content', /\S/u );
				await expect( page.locator( 'meta[property="og:image:type"]' ) ).toHaveAttribute( 'content', 'image/png' );
				const image = await readFile( new URL( `.${ imagePath }`, WebsiteOutput ) );
				expect( image.subarray( 1, 4 ).toString() ).toBe( 'PNG' );
				for ( const [ name, dimension ] of [
					[ 'width', image.readUInt32BE( 16 ) ], [ 'height', image.readUInt32BE( 20 ) ],
				] as const ) {
					await expect( page.locator( `meta[property="og:image:${ name }"]` ) )
						.toHaveAttribute( 'content', String( dimension ) );
				}
			} );
		}
	} finally {
		await context.close();
	}
} );
