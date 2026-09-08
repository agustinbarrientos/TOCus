import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, type Route } from 'playwright';
import { describe, expect, test } from 'vitest';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const PublicRoutes = [ '/', '/de/', '/es/', '/es-ar/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ];

/**
 * Serves the built website without external dependencies.
 * @param route - Intercepted local website request.
 */
async function serveAsset( route: Route ): Promise<void> {
	const request = new URL( route.request().url() );
	const path = request.pathname.endsWith( '/' ) ? `${ request.pathname }index.html` : request.pathname;
	await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
}

describe( 'localized statistics hydration', () => {
	for ( const engine of [ chromium, firefox, webkit ] ) {
		test( `${ engine.name() }: preserves the server-rendered metrics in every locale`, async () => {
			const browser = await engine.launch();
			try {
				const serverContext = await browser.newContext( { javaScriptEnabled: false } );
				const clientContext = await browser.newContext( { reducedMotion: 'reduce' } );
				await serverContext.route( 'http://website.test/**', serveAsset );
				await clientContext.route( 'http://website.test/**', serveAsset );
				for ( const route of PublicRoutes ) {
					const serverPage = await serverContext.newPage();
					const clientPage = await clientContext.newPage();
					const errors: string[] = [];
					clientPage.on( 'pageerror', ( error ) => errors.push( error.message ) );
					await Promise.all( [ serverPage, clientPage ].map(
						( page ) => page.goto( `http://website.test${ route }` ),
					) );
					await clientPage.locator( '.homepage[data-enhanced="true"]' ).waitFor();
					const serverMetrics = await serverPage.locator( '.statistics-preview dd' ).allTextContents();
					const clientMetrics = await clientPage.locator( '.statistics-preview dd' ).allTextContents();
					expect( serverMetrics, route ).toHaveLength( 5 );
					expect( serverMetrics.every( ( value ) => value.trim().length > 0 ), route ).toBe( true );
					expect( clientMetrics, route ).toEqual( serverMetrics );
					expect( errors, route ).toEqual( [] );
					await Promise.all( [ serverPage.close(), clientPage.close() ] );
				}
			} finally {
				await browser.close();
			}
		}, 60_000 );
	}
} );
