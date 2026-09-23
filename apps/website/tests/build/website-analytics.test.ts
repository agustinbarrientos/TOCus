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

test( 'analytics waits for consent, remembers rejection and supports later acceptance and withdrawal', async ( { page } ) => {
	const requests = await serveWebsite( page );
	await page.goto( ProductionOrigin );
	const prompt = page.getByRole( 'region', { name: 'Website analytics', exact: true } );
	await expect( prompt ).toBeVisible();
	expect( requests ).toEqual( [] );
	await prompt.getByRole( 'button', { name: 'Reject', exact: true } ).click();
	await expect( prompt ).toBeHidden();
	await page.reload();
	await expect( page.getByRole( 'button', { name: 'Analytics preferences', exact: true } ) ).toBeVisible();
	await expect( prompt ).toBeHidden();
	expect( requests ).toEqual( [] );
	await page.getByRole( 'button', { name: 'Analytics preferences', exact: true } ).click();
	await prompt.getByRole( 'button', { name: 'Accept', exact: true } ).click();
	await expect.poll( () => requests.length ).toBe( 1 );
	expect( requests[ 0 ] ).toBe( 'https://www.googletagmanager.com/gtag/js?id=G-RBHGLDECJ9' );
	const commands = await page.evaluate( () => JSON.stringify( Reflect.get( window, 'dataLayer' ) ) );
	expect( commands ).toContain( 'G-RBHGLDECJ9' );
	expect( commands ).toContain( 'analytics_storage' );
	expect( commands ).toContain( 'granted' );
	expect( commands ).toContain( '"allow_google_signals":false' );
	await page.goto( `${ ProductionOrigin }/es/privacy/` );
	await expect.poll( () => requests.length ).toBe( 2 );
	await expect( page.locator( '.analytics-prompt' ) ).toBeHidden();
	await expect( page.locator( '#website-analytics' ) ).toContainText( 'Google Analytics' );
	await page.goto( `${ ProductionOrigin }/privacy/` );
	await expect.poll( () => requests.length ).toBe( 3 );
	await page.evaluate( () => {
		document.cookie = '_ga=test; path=/; SameSite=Lax; Secure';
	} );
	await page.getByRole( 'button', { name: 'Analytics preferences', exact: true } ).click();
	await prompt.getByRole( 'button', { name: 'Reject', exact: true } ).click();
	await expect( page.locator( 'script[data-website-analytics]' ) ).toHaveCount( 0 );
	await expect( prompt ).toBeHidden();
	expect( requests ).toHaveLength( 3 );
	expect( await page.context().cookies() ).not.toEqual( expect.arrayContaining( [
		expect.objectContaining( { name: '_ga' } ),
	] ) );
} );

test( 'local and preview hosts never load Google Analytics', async ( { page } ) => {
	const requests = await serveWebsite( page );
	await page.goto( 'http://website.test/privacy/' );
	await expect( page.locator( '.information-website' ) ).toHaveAttribute( 'data-enhanced', 'true' );
	await expect( page.locator( '.analytics-prompt' ) ).toHaveCount( 0 );
	await expect( page.locator( 'script[data-website-analytics]' ) ).toHaveCount( 0 );
	expect( requests ).toEqual( [] );
} );
