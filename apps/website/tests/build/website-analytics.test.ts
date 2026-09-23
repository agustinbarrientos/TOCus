import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const ProductionOrigin = 'https://tocus.uo.ar';

/**
 * Serves built pages and intercepts Google so tests never send visitor data.
 * @param page - Isolated browser page.
 * @return Recorded Google tag requests.
 */
async function serveWebsite( page: Page ): Promise<string[]> {
	const googleRequests: string[] = [];
	await page.route( '**/*', async ( route ) => {
		const url = new URL( route.request().url() );
		if ( url.hostname === 'www.googletagmanager.com' ) {
			googleRequests.push( url.href );
			await route.fulfill( { contentType: 'application/javascript', body: '' } );
			return;
		}
		if ( url.origin !== ProductionOrigin && url.origin !== 'http://website.test' ) {
			await route.abort();
			return;
		}
		const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
		await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
	} );
	return googleRequests;
}

test.use( { reducedMotion: 'reduce' } );

test( 'production pages load analytics without a banner or preferences control', async ( { page } ) => {
	const requests = await serveWebsite( page );
	for ( const [ index, path ] of [ '/', '/es/privacy/', '/privacy/' ].entries() ) {
		await page.goto( `${ ProductionOrigin }${ path }` );
		await expect( page.locator( '.website' ) ).toHaveAttribute( 'data-enhanced', 'true' );
		await expect( page.locator( '.analytics-prompt, .analytics-preferences' ) ).toHaveCount( 0 );
		await expect.poll( () => requests.length ).toBe( index + 1 );
		expect( requests[ index ] ).toBe( 'https://www.googletagmanager.com/gtag/js?id=G-RBHGLDECJ9' );
		await expect( page.locator( 'script[data-website-analytics]' ) ).toHaveCount( 1 );
		if ( path.includes( 'privacy' ) ) {
			await expect( page.locator( '#website-analytics' ) ).toContainText( 'Google Analytics' );
		}
	}
	const commands = await page.evaluate( () => {
		const queue = Reflect.get( window, 'dataLayer' ) as ArrayLike<unknown>[];
		return queue.map( ( command ) => Array.from( command ) );
	} );
	expect( commands ).toContainEqual( [ 'config', 'G-RBHGLDECJ9', {
		allow_google_signals: false,
		allow_ad_personalization_signals: false,
		cookie_domain: 'none',
	} ] );
} );

test( 'local and preview hosts never load Google Analytics', async ( { page } ) => {
	const requests = await serveWebsite( page );
	await page.goto( 'http://website.test/privacy/' );
	await expect( page.locator( '.information-website' ) ).toHaveAttribute( 'data-enhanced', 'true' );
	await expect( page.locator( '.analytics-prompt' ) ).toHaveCount( 0 );
	await expect( page.locator( 'script[data-website-analytics]' ) ).toHaveCount( 0 );
	expect( requests ).toEqual( [] );
} );
