import { fileURLToPath } from 'node:url';
import { expect, test, type Route } from '@playwright/test';

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

test.describe( 'localized statistics hydration', () => {
	for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
		const engineTest = test.extend( { browserName: engine, javaScriptEnabled: false } );

		engineTest( `${ engine }: preserves the server-rendered metrics in every locale`, async ( { browser, context: serverContext } ) => {
			engineTest.setTimeout( 60_000 );
			const clientContext = await browser.newContext( { javaScriptEnabled: true, reducedMotion: 'reduce' } );
			try {
				await serverContext.route( 'http://website.test/**', serveAsset );
				await clientContext.route( 'http://website.test/**', serveAsset );
				for ( const route of PublicRoutes ) {
					await engineTest.step( `Compare server and hydrated metrics for ${ route }`, async () => {
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
					} );
				}
			} finally {
				await clientContext.close();
			}
		} );
	}
} );
