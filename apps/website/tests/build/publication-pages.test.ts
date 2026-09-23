import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Route } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const SourceUrl = 'https://github.com/agustinbarrientos/TOCus';
const ChromeLimitedUseUrl = 'https://developer.chrome.com/docs/webstore/program-policies/user-data-faq';
const PublicationRoutes = [ '/privacy/', '/support/' ] as const;

/**
 * Serves one generated website asset without a live application server.
 * @param route - Request intercepted by the disposable browser context.
 * @return Promise resolved after the generated file is served.
 */
async function serveGeneratedAsset( route: Route ): Promise<void> {
	const request = new URL( route.request().url() );
	const pathname = request.pathname.endsWith( '/' ) ? `${ request.pathname }index.html` : request.pathname;

	await route.fulfill( { path: fileURLToPath( new URL( `.${ pathname }`, WebsiteOutput ) ) } );
}

/**
 * Verifies that every outbound link carries the shared icon and safe new-tab relationship.
 * @param page - Generated publication page under inspection.
 * @return Promise resolved after every external link is checked.
 */
async function expectSafeExternalLinks( page: Page ): Promise<void> {
	for ( const link of await page.locator( 'a[href^="https:"]' ).all() ) {
		expect( await link.getAttribute( 'target' ) ).toBe( '_blank' );
		expect( await link.getAttribute( 'rel' ) ).toContain( 'noopener noreferrer' );
		expect( await link.locator( '.tocus-icon' ).count() ).toBe( 1 );
	}
}

/**
 * Checks paragraph links against their actual surrounding typography at reading widths.
 * @param page - Generated publication page under inspection.
 * @return Completion after mobile and desktop inline styles match their paragraph.
 */
async function expectInlineLinkTypography( page: Page ): Promise<void> {
	const links = page.locator( '.information-page p a' );
	expect( await links.count() ).toBeGreaterThan( 0 );
	for ( const width of [ 360, 1280 ] ) {
		await page.setViewportSize( { width, height: 800 } );
		const measurements = await links.evaluateAll( ( elements ) => elements.map( ( element ) => {
			const paragraph = element.closest( 'p' );
			if ( ! paragraph ) {
				throw new Error( 'An inline information link must have a surrounding paragraph.' );
			}
			const linkStyle = getComputedStyle( element );
			const paragraphStyle = getComputedStyle( paragraph );
			return {
				label: element.textContent,
				link: [ linkStyle.fontFamily, linkStyle.fontSize, linkStyle.fontWeight,
					linkStyle.lineHeight, linkStyle.letterSpacing ],
				paragraph: [ paragraphStyle.fontFamily, paragraphStyle.fontSize, paragraphStyle.fontWeight,
					paragraphStyle.lineHeight, paragraphStyle.letterSpacing ],
			};
		} ) );
		for ( const measurement of measurements ) {
			expect( measurement.link, `${ String( width ) }px: ${ measurement.label }` ).toEqual( measurement.paragraph );
		}
	}
	await page.setViewportSize( { width: 360, height: 800 } );
}

test.describe( 'generated website publication pages', () => {
	test( 'support exposes the contact email in every language and preserves the page when switching', async ( { page } ) => {
		await page.route( 'http://website.test/**', serveGeneratedAsset );
		for ( const locale of [ '', 'de/', 'es/', 'es-ar/', 'fr/', 'it/', 'ja/', 'pt-br/', 'pt-pt/', 'ru/' ] ) {
			await page.goto( `http://website.test/${ locale }support/` );
			await expect( page.locator( '.support-contact a' ) ).toHaveAttribute( 'href', 'mailto:hi@agustinbarrientos.com' );
			await expect( page.locator( '.support-contact a' ) ).toHaveText( 'hi@agustinbarrientos.com' );
			await expect( page.locator( 'link[rel="alternate"][hreflang="en"]' ) ).toHaveAttribute( 'href', '/support/' );
			await expect( page.locator( 'meta[property="og:url"]' ) ).toHaveAttribute( 'content', `https://tocus.uo.ar/${ locale }support/` );
		}
		await page.goto( 'http://website.test/support/' );
		await page.locator( '.language-shortcut' ).click();
		await page.getByRole( 'menuitem', { name: 'Deutsch', exact: true } ).click();
		await expect( page ).toHaveURL( 'http://website.test/de/support/' );
		await expect( page.locator( '.site-header .site-brand-link' ) ).toHaveAttribute( 'href', '/de/' );
	} );

	test( 'privacy shares homepage header and footer presentation', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await page.route( 'http://website.test/**', serveGeneratedAsset );
		for ( const viewport of [ { width: 360, height: 800 }, { width: 1280, height: 800 },
			{ width: 360, height: 640 }, { width: 1280, height: 600 } ] ) {
			await page.setViewportSize( viewport );
			const measurements = [];
			for ( const route of [ '/', '/privacy/' ] ) {
				await page.goto( `http://website.test${ route }` );
				await expect( page.getByRole( 'button', { name: 'Website language: English', exact: true } ) ).toBeVisible();
				await page.evaluate( () => document.fonts.ready );
				measurements.push( await page.evaluate( () => [
					'.site-header', '.site-header .tocus-brand', '.site-header .language-shortcut',
					'.site-footer', '.footer-main', '.site-footer .tocus-brand', '.footer-links > a',
				].map( ( selector ) => {
					const element = document.querySelector( selector );
					if ( ! element ) {
						throw new Error( `Missing shared navigation element: ${ selector }` );
					}
					const style = getComputedStyle( element );
					const bounds = element.getBoundingClientRect();
					return [ selector, bounds.x, bounds.width, style.fontFamily, style.fontSize, style.color,
						selector === '.site-footer' ? undefined : style.backgroundColor, style.paddingTop, style.paddingBottom ];
				} ) ) );
			}
			expect( measurements[ 1 ], `${ String( viewport.width ) }x${ String( viewport.height ) } shared navigation` ).toEqual( measurements[ 0 ] );
			await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Privacy Policy' );
			await expect( page.locator( '.information-page-eyebrow' ) ).toHaveCount( 0 );
			await expect( page.locator( '.site-header [data-download-primary]' ) ).toHaveCount( 0 );
			await expect( page.locator( '.site-header a[aria-label="TOCus home"]' ) ).toHaveAttribute( 'href', '/' );
			await page.getByRole( 'button', { name: 'Website language: English', exact: true } ).click();
			await expect( page.getByRole( 'menuitem' ) ).toHaveCount( 10 );
			await page.keyboard.press( 'Escape' );
		}
	} );

	for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
		const engineTest = test.extend( { browserName: engine } );

		engineTest.describe( () => {
			engineTest.use( { contextOptions: {
				javaScriptEnabled: false,
				viewport: { width: 360, height: 800 },
			} } );

			engineTest( `${ engine }: canonical pages are useful without JavaScript or outbound loading`, async ( { context, page } ) => {
				engineTest.setTimeout( 60_000 );
				const externalRequests: string[] = [];

				await context.route( '**/*', async ( route ) => {
					if ( new URL( route.request().url() ).origin !== 'http://website.test' ) {
						externalRequests.push( route.request().url() );
						await route.abort();
						return;
					}

					await serveGeneratedAsset( route );
				} );

				for ( const route of PublicationRoutes ) {
					await engineTest.step( `Inspect ${ route }`, async () => {
						await page.goto( `http://website.test${ route }` );
						expect( ( await page.locator( 'h1' ).innerText() ).trim().length, route ).toBeGreaterThan( 0 );
						expect( await page.locator( 'link[rel="icon"][href="/favicon.svg"]' ).count(), route ).toBe( 1 );
						expect( await page.locator( '[data-tocus-ui] .website > .information-shell' ).count(), route ).toBe( 1 );
						expect( await page.locator( 'header .tocus-brand' ).count(), route ).toBe( 1 );
						await expect( page.locator( '.site-header .site-brand-link' ) ).toHaveAttribute( 'href', '/' );
						for ( const href of [ '/privacy/', SourceUrl ] ) {
							expect( await page.locator( `.footer-links a[href="${ href }"]` ).count(), `${ route } ${ href }` ).toBe( 1 );
						}
						expect( await page.locator( 'a[href*="utm_source=tocus"][href*="utm_medium=website"][href*="utm_campaign=about"] img[src="/images/author-favicon.png"]' ).count(), route ).toBe( 1 );
						await expectSafeExternalLinks( page );
						await expectInlineLinkTypography( page );
						expect(
							await page.evaluate( () => document.documentElement.scrollWidth <= window.innerWidth ),
							route,
						).toBe( true );
					} );
				}

				expect( externalRequests ).toEqual( [] );
			} );
		} );
	}

	test.describe( () => {
		test.use( { contextOptions: { colorScheme: 'dark' } } );

		test( 'hydrated information pages remain light when system appearance changes', async ( { context, page } ) => {
			await context.route( 'http://website.test/**', serveGeneratedAsset );

			for ( const route of PublicationRoutes ) {
				await test.step( `Inspect ${ route }`, async () => {
					await page.emulateMedia( { colorScheme: 'dark' } );
					await page.goto( `http://website.test${ route }` );
					const provider = page.locator( '[data-tocus-ui]' );
					await expect.poll( () => provider.getAttribute( 'data-tocus-theme' ) ).toBe( 'light' );

					await page.emulateMedia( { colorScheme: 'light' } );
					await expect.poll( () => provider.getAttribute( 'data-tocus-theme' ) ).toBe( 'light' );
				} );
			}
		} );
	} );

	test.describe( () => {
		test.use( { contextOptions: { javaScriptEnabled: false } } );

		test( 'privacy distinguishes local extension data from deliberate network requests', async ( { page } ) => {
			await page.route( 'http://website.test/**', serveGeneratedAsset );
			await page.goto( 'http://website.test/privacy/' );

			await expect( page.locator( 'main h2' ) ).toHaveText( [ 'The extension', 'This site' ] );
			await expect( page.locator( '#the-extension > section' ) ).toHaveCount( 4 );
			await expect( page.locator( '#this-site #website-and-links' ) ).toBeVisible();
			await expect( page.locator( '#this-site #website-analytics' ) ).toBeVisible();
			const extensionPolicy = page.locator( '#extension-data' );
			const extensionPolicyText = await extensionPolicy.innerText();
			expect( extensionPolicyText ).toMatch( /choices|preferences/iu );
			expect( extensionPolicyText ).toMatch( /pause times/iu );
			expect( extensionPolicyText ).toMatch( /schedule/iu );
			expect( extensionPolicyText ).toMatch( /statistics/iu );
			expect( extensionPolicyText ).toMatch( /counts and durations/iu );
			expect( extensionPolicyText ).toMatch( /don't save any page content or web addresses/iu );
			expect( extensionPolicyText ).toMatch( /works entirely offline/iu );
			expect( extensionPolicyText ).toMatch( /address might be saved for a short time/iu );
			expect( extensionPolicyText ).toMatch( /device|browser/iu );
			await expect( extensionPolicy.getByRole( 'link' ) ).toHaveAttribute( 'href', SourceUrl );
			const permissionsText = await page.locator( '#permissions' ).innerText();
			expect( permissionsText ).toMatch( /websites you choose/iu );
			expect( permissionsText ).toMatch( /doesn't look at your saved browsing history/iu );
			expect( permissionsText ).toMatch( /avoid connecting to any icon service/iu );
			expect( await page.locator( '#deletion' ).innerText() ).toMatch( /reset/iu );
			const websiteText = await page.locator( '#website-and-links' ).innerText();
			expect( websiteText ).toMatch( /hosting|server/iu );
			expect( websiteText ).toMatch( /other sites that have their own privacy rules/iu );
			const analyticsText = await page.locator( '#website-analytics' ).innerText();
			expect( analyticsText ).toContain( 'Google Analytics' );
			expect( analyticsText ).toContain( 'The TOCus extension has no analytics or tracking.' );
			expect( analyticsText ).toContain( 'only loads Google Analytics after you accept' );
			expect( await page.locator( `a[href="${ ChromeLimitedUseUrl }"]` ).count() ).toBe( 1 );
			expect( await page.locator( '#limited-use' ).innerText() ).toMatch( /Limited Use/iu );
		} );
	} );

} );
