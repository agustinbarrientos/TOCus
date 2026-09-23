import { fileURLToPath } from 'node:url';
import { expect, test, type Route } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const PublicRoutes = [ '/', '/de/', '/es/', '/es-ar/', '/fr/', '/it/', '/ja/', '/pt-br/', '/pt-pt/', '/ru/' ];
const FeatureTitles = [
	'Use it only when you want to', 'Set a schedule for each site', 'Your videos will pause automatically',
	'Check how much time you\u2019ve saved', 'It\'s 100% private', 'It\u2019s free and open source',
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
		await page.context().route( 'http://website.test/**', serveAsset );
		await page.goto( 'http://website.test/' );
		await expect( page.locator( '#how-it-works h2, #how-it-works h3' ) ).toHaveCount( 0 );
		const steps = page.locator( '#how-it-works ol.how-steps > li' );
		await expect( steps ).toHaveCount( 4 );
		await expect( steps.locator( '.how-step-label' ) )
			.toHaveText( [ 'Open a site', '10s pause', 'Continue', '5m browsing' ] );
		await expect( page.locator( '#features h2' ) ).toHaveText( 'A calmer way to browse' );
		const features = page.locator( '#features ul.feature-grid > li' );
		await expect( features ).toHaveCount( 6 );
		await expect( features.locator( 'h3' ) ).toHaveText( FeatureTitles );
		for ( const feature of await features.all() ) {
			const art = feature.locator( '.feature-art' );
			await expect( art ).toHaveCount( 1 );
			await expect( art ).toHaveAttribute( 'src', /^\/(?!\/)/u );
			await art.scrollIntoViewIfNeeded();
			await art.evaluate( ( image: HTMLImageElement ) => image.decode() );
			await expect( art ).toBeVisible();
		}
		const media = features.filter( {
			has: page.getByRole( 'heading', { name: 'Your videos will pause automatically', exact: true } ),
		} );
		await expect( media ).toContainText( 'Works with' );
		await expect( media.getByText( '+', { exact: true } ) ).toBeVisible();
		const serviceIcons = media.locator( 'img[alt]:not([alt=""])' );
		await expect( serviceIcons ).toHaveCount( 3 );
		expect( await serviceIcons.evaluateAll( ( icons ) => icons.map( ( icon ) => icon.getAttribute( 'alt' ) ) ) )
			.toEqual( [ 'youtube', 'netflix', 'twitch' ] );
		for ( const icon of await serviceIcons.all() ) {
			await expect( icon ).toHaveAttribute( 'src', /^\/(?!\/)/u );
			await icon.scrollIntoViewIfNeeded();
			await icon.evaluate( ( image: HTMLImageElement ) => image.decode() );
			await expect( icon ).toBeVisible();
		}
		expect( await media.locator( '.feature-services' ).evaluate( ( row ) => {
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents( row );
			selection?.removeAllRanges();
			selection?.addRange( range );
			const text = selection?.toString().replace( /\s+/gu, ' ' ).trim();
			selection?.removeAllRanges();
			return text;
		} ) ).toBe( 'Works with youtube netflix twitch +' );
		for ( const width of [ 1440, 768 ] ) {
			await page.setViewportSize( { width, height: 900 } );
			const typography = await page.locator( '.how-step-label, .feature-grid h3' ).evaluateAll( ( labels ) =>
				labels.map( ( label ) => {
					const style = getComputedStyle( label );
					return [ style.fontFamily, style.fontSize, style.fontWeight,
						style.lineHeight, style.letterSpacing ];
				} ),
			);
			expect( typography ).toHaveLength( 10 );
			expect( new Set( typography.map( ( values ) => JSON.stringify( values ) ) ).size ).toBe( 1 );
			for ( const text of await features.locator( 'h3, p' ).all() ) {
				await expect( text ).toHaveCSS( 'text-align', /^(?:start|left)$/u );
			}
		}
		await expect( page.locator( '#how-it-works button, #features button, #features select, #features canvas' ) )
			.toHaveCount( 0 );
		await expect( page.locator( '.product-demo, .story-player, .statistics-preview, .timing-diagram' ) ).toHaveCount( 0 );
		await expect( page.locator( '#downloads h2' ) ).toHaveText( 'Take a moment to pause.' );
		const primaryDownload = page.locator( '#downloads .store-primary[data-download-primary]' );
		await expect( primaryDownload ).toHaveCount( 1 );
		await expect( primaryDownload ).toHaveAttribute( 'href', /^https:/u );
		await expect( primaryDownload.locator( 'img' ) ).toHaveCount( 1 );
		await expect( page.locator( '#downloads a[href]' ) ).toHaveCount( 4 );
		await expect( page.locator( '.hero-actions a[data-store]' ) ).toHaveCount( 4 );
		await expect( page.locator( '.riverside-hero img' ) ).toHaveAttribute( 'src', '/images/riverside-hero.webp' );
		await expect( page.locator( '.site-footer a[href="/privacy/"]' ) ).toHaveCount( 1 );
		await expect( page.locator( '.site-footer a[href="https://github.com/agustinbarrientos/TOCus"]' ) ).toHaveCount( 1 );
		await expect( page.locator( '.site-footer' ).getByRole( 'link', { name: 'Source code', exact: true } ) ).toBeVisible();
		for ( const link of await page.locator( '.footer-links > a, .feature-link[href="/privacy/"]' ).all() ) {
			await expect( link ).toHaveAttribute( 'target', '_blank' );
			await expect( link ).toHaveAttribute( 'rel', 'noopener noreferrer' );
			await expect( link.locator( '.tocus-icon' ) ).toBeVisible();
		}
		const [ privacyPage ] = await Promise.all( [
			page.waitForEvent( 'popup' ),
			page.locator( '.site-footer a[href="/privacy/"]' ).click(),
		] );
		await expect( privacyPage ).toHaveURL( 'http://website.test/privacy/' );
		await expect( privacyPage.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Privacy Policy' );
		await privacyPage.close();
		await expect( page.locator( '.site-footer a[href*="utm_medium=website"]' ) ).toContainText( 'Agustin Barrientos' );
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
						// Poll from the runner so no-JavaScript pages need only synchronous evaluation.
						await expect.poll( () => page.evaluate( () => document.fonts.status ) ).toBe( 'loaded' );
						await page.evaluate( () => {
							document.documentElement.style.fontSize = '20px';
						} );
						await expect( page.locator( '.hero h1' ) ).toBeVisible();
						await expect( page.locator( '.hero [data-download-primary]' ) ).toBeVisible();
						await expect( page.locator( '#how-it-works ol.how-steps > li' ) ).toHaveCount( 4 );
						await expect( page.locator( '#how-it-works h2, #how-it-works h3' ) ).toHaveCount( 0 );
						await expect( page.locator( '#features ul.feature-grid > li' ) ).toHaveCount( 6 );
						await expect( page.locator( '#features ul.feature-grid > li .feature-art' ) ).toHaveCount( 6 );
						const copy = page.locator( '.how-step-label, #features h2, #features h3, #downloads h2' );
						await expect( copy ).toHaveCount( 12 );
						for ( const heading of await copy.all() ) {
							await expect( heading ).toBeVisible();
							await expect( heading ).not.toHaveText( /^\s*$/u );
						}
						if ( route !== '/' ) {
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
