import { fileURLToPath } from 'node:url';
import { expect, test, type Route } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const PublicRoutes = [ '/', '/de/', '/es/', '/es-ar/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ];
const FeatureTitles = [
	'Only when you want', 'Custom schedules for each site', 'Your video pauses, too',
	'See how much time you saved', 'Stored on your device', 'Free and open source',
];

/**
 * Serves only local generated website assets.
 * @param route - Intercepted browser request.
 */
async function serveAsset( route: Route ): Promise<void> {
	const request = new URL( route.request().url() );
	const path = request.pathname.endsWith( '/' ) ? `${ request.pathname }index.html` : request.pathname;
	await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
}

test.describe( 'static illustrated product presentation', () => {
	test.use( { reducedMotion: 'reduce' } );

	test( 'explains four steps and six features with local artwork and direct downloads', async ( { page } ) => {
		await page.route( 'http://website.test/**', serveAsset );
		await page.goto( 'http://website.test/' );
		await expect( page.locator( '#how-it-works h2' ) ).toHaveText( 'How it works' );
		const steps = page.locator( '#how-it-works ol.how-steps > li' );
		await expect( steps ).toHaveCount( 4 );
		for ( const [ index, label ] of [ 'Open a site', '10s pause', 'Continue', '5m browsing' ].entries() ) {
			await expect( steps.nth( index ) ).toContainText( label );
		}
		await expect( page.locator( '#features h2' ) ).toHaveText( 'A calmer way to browse' );
		const features = page.locator( '#features ul.feature-grid > li' );
		await expect( features ).toHaveCount( 6 );
		await expect( features.locator( 'h3' ) ).toHaveText( FeatureTitles );
		for ( const feature of await features.all() ) {
			const art = feature.locator( 'img' );
			await expect( art ).toHaveCount( 1 );
			await expect( art ).toHaveAttribute( 'src', /^\/(?!\/)/u );
			await art.scrollIntoViewIfNeeded();
			await art.evaluate( ( image: HTMLImageElement ) => image.decode() );
			await expect( art ).toBeVisible();
		}
		await expect( page.locator( '#how-it-works button, #features button, #features select, #features canvas' ) )
			.toHaveCount( 0 );
		await expect( page.locator( '.product-demo, .story-player, .statistics-preview, .timing-diagram' ) ).toHaveCount( 0 );
		await expect( page.locator( '#downloads h2' ) ).toHaveText( 'Take a little pause.' );
		const primaryDownload = page.locator( '#downloads .store-primary[data-download-primary]' );
		await expect( primaryDownload ).toHaveCount( 1 );
		await expect( primaryDownload ).toHaveAttribute( 'href', /^https:/u );
		await expect( primaryDownload.locator( 'img' ) ).toHaveCount( 1 );
		await expect( page.locator( '#downloads a[href]' ) ).toHaveCount( 4 );
		await expect( page.locator( '.hero-actions a[data-store]' ) ).toHaveCount( 4 );
		await expect( page.locator( '.riverside-hero img' ) ).toHaveAttribute( 'src', '/images/riverside-hero.webp' );
		await expect( page.locator( '.site-footer a[href="/privacy/"]' ) ).toHaveCount( 1 );
		await expect( page.locator( '.site-footer a[href="https://github.com/agustinbarrientos/TOCus"]' ) ).toHaveCount( 1 );
		await expect( page.locator( '.site-footer a[href*="utm_medium=website"]' ) ).toContainText( 'Agustin Barrientos' );
		await expect( page.locator( 'a[href="/support/"]' ) ).toHaveCount( 0 );
	} );

	for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
		const engineTest = test.extend( { browserName: engine } );
		engineTest.describe( () => {
			engineTest.use( { javaScriptEnabled: false, viewport: { width: 320, height: 800 } } );

			engineTest( `${ engine }: every locale explains the product without JavaScript`, async ( { context, page } ) => {
				engineTest.setTimeout( 60_000 );
				const externalRequests: string[] = [];
				await context.route( '**/*', async ( route ) => {
					if ( new URL( route.request().url() ).origin !== 'http://website.test' ) {
						externalRequests.push( route.request().url() );
						await route.abort();
					} else {
						await serveAsset( route );
					}
				} );
				for ( const route of PublicRoutes ) {
					await engineTest.step( `Read ${ route } without JavaScript`, async () => {
						await page.goto( `http://website.test${ route }` );
						await page.evaluate( async () => {
							await document.fonts.ready;
							document.documentElement.style.fontSize = '20px';
						} );
						await expect( page.locator( '.hero h1' ) ).toBeVisible();
						await expect( page.locator( '.hero [data-download-primary]' ) ).toBeVisible();
						await expect( page.locator( '#how-it-works ol.how-steps > li' ) ).toHaveCount( 4 );
						await expect( page.locator( '#features ul.feature-grid > li' ) ).toHaveCount( 6 );
						await expect( page.locator( '#features ul.feature-grid > li img' ) ).toHaveCount( 6 );
						for ( const heading of await page.locator( '#how-it-works h2, #features h2, #features h3, #downloads h2' ).all() ) {
							await expect( heading ).toBeVisible();
							await expect( heading ).not.toHaveText( /^\s*$/u );
						}
						if ( route !== '/' ) {
							await expect( page.locator( '#how-it-works h2' ) ).not.toHaveText( 'How it works' );
							await expect( page.locator( '#features h2' ) ).not.toHaveText( 'A calmer way to browse' );
						}
						await expect( page.locator( '#languages a[lang]' ) ).toHaveCount( 10 );
						await expect( page.locator( '#languages a[aria-current="page"]' ) ).toHaveCount( 1 );
						await expect( page.locator( '#downloads [data-download-primary]' ) ).toBeVisible();
						for ( const link of await page.locator( 'a[target="_blank"]' ).all() ) {
							await expect( link ).toHaveAttribute( 'rel', /noopener noreferrer/u );
						}
						expect( await page.evaluate(
							() => document.documentElement.scrollWidth <= window.innerWidth,
						), route ).toBe( true );
					} );
				}
				expect( externalRequests ).toEqual( [] );
			} );
		} );
	}
} );
