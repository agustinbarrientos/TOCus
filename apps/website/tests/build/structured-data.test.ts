import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { StructuredData } from '../../src/services/structured-data/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Checks that parsed JSON-LD holds the website's two-node graph before the test reads its fields.
 * @param value - Parsed JSON-LD.
 * @return Whether the value has a two-node graph.
 */
function isStructuredData( value: unknown ): value is StructuredData {
	if ( typeof value !== 'object' || value === null || ! ( '@graph' in value ) ) {
		return false;
	}
	const graph: unknown = value[ '@graph' ];
	return Array.isArray( graph ) && graph.length === 2;
}

/**
 * Parses the page's JSON-LD into its website and app nodes.
 * @param script - JSON-LD text from the page.
 * @return The website node and the app node.
 */
function parseStructuredData( script = '' ): StructuredData[ '@graph' ] {
	const value: unknown = JSON.parse( script );
	if ( ! isStructuredData( value ) ) {
		throw new Error( 'The page has no website and app structured data.' );
	}
	return value[ '@graph' ];
}

test( 'every home page describes the website and the app for search engines without JavaScript', async ( { browser } ) => {
	const context = await browser.newContext( { javaScriptEnabled: false } );
	try {
		const page = await context.newPage();
		await page.route( 'http://website.test/**', async ( route ) => {
			const url = new URL( route.request().url() );
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		for ( const path of [ '/', '/es/', '/es-ar/', '/de/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ] ) {
			await test.step( `Check structured data for ${ path }`, async () => {
				await page.goto( `http://website.test${ path }` );
				const scripts = await page.locator( 'script[type="application/ld+json"]' ).allTextContents();
				expect( scripts ).toHaveLength( 1 );
				const [ website, app ] = parseStructuredData( scripts[ 0 ] );
				expect( website ).toMatchObject( { '@type': 'WebSite', name: 'TOCus', url: 'https://tocus.uo.ar/' } );
				expect( app ).toMatchObject( {
					'@type': 'SoftwareApplication',
					'@id': 'https://tocus.uo.ar/#app',
					offers: { '@type': 'Offer', price: 0 },
					author: { '@id': 'https://agustinbarrientos.com/#person' },
				} );
				await expect( page.locator( 'meta[property="og:description"]' ) ).toHaveAttribute( 'content', app.description );
				for ( const feature of app.featureList ) {
					await expect( page.getByText( feature, { exact: true } ) ).toBeVisible();
				}
				for ( const image of app.image ) {
					await access( fileURLToPath( new URL( `.${ new URL( image ).pathname }`, WebsiteOutput ) ) );
				}
			} );
		}
	} finally {
		await context.close();
	}
} );
