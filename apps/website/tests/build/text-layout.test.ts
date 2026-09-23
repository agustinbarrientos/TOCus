import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const TextLayouts = [
	{ path: '/privacy/', selector: '.information-page h1, .information-page h2, .information-page p' },
] as const;

test.describe( 'website text layout', () => {
	test.use( { javaScriptEnabled: false } );

	for ( const width of [ 1440, 768 ] ) {
		for ( const { path, selector } of TextLayouts ) {
			test( `${ String( width ) } ${ path }: text uses the available parent width`, async ( { page } ) => {
				await page.setViewportSize( { width, height: 1100 } );
				await page.route( 'http://website.test/**', async ( route ) => {
					const request = new URL( route.request().url() );
					const pathname = request.pathname.endsWith( '/' ) ? `${ request.pathname }index.html` : request.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ pathname }`, WebsiteOutput ) ) } );
				} );
				await page.goto( `http://website.test${ path }` );
				await page.evaluate( () => document.fonts.ready );
				const textWidths = await page.locator( selector ).evaluateAll( ( elements ) =>
					elements.map( ( element ) => {
						const parent = element.parentElement;
						if ( ! parent ) {
							throw new Error( 'Text must have a layout parent.' );
						}
						const style = getComputedStyle( parent );
						const padding = parseFloat( style.paddingLeft ) + parseFloat( style.paddingRight );
						return {
							text: element.textContent,
							width: element.getBoundingClientRect().width,
							available: parent.clientWidth - padding,
						};
					} ),
				);
				expect( textWidths.length ).toBeGreaterThan( 0 );
				expect( textWidths.filter( ( text ) => Math.abs( text.width - text.available ) > 1 ) ).toEqual( [] );
				expect( await page.evaluate( () => document.documentElement.scrollWidth <= window.innerWidth ) )
					.toBe( true );
			} );
		}
	}
} );
