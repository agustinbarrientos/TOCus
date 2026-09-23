import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Route } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );
const SourceUrl = 'https://github.com/agustinbarrientos/TOCus';
const IssueUrl = `${ SourceUrl }/issues/new/choose`;
const SecurityAdvisoryUrl = `${ SourceUrl }/security/advisories/new`;
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
				link: [ linkStyle.fontFamily, linkStyle.fontSize, linkStyle.fontWeight, linkStyle.lineHeight, linkStyle.letterSpacing ],
				paragraph: [ paragraphStyle.fontFamily, paragraphStyle.fontSize, paragraphStyle.fontWeight, paragraphStyle.lineHeight, paragraphStyle.letterSpacing ],
			};
		} ) );
		for ( const measurement of measurements ) {
			expect( measurement.link, `${ width }px: ${ measurement.label }` ).toEqual( measurement.paragraph );
		}
	}
	await page.setViewportSize( { width: 360, height: 800 } );
}

test.describe( 'generated website publication pages', () => {
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
						expect( ( await page.locator( 'h1' ).innerText() ).trim().length, route ).toBeGreaterThan( 8 );
						expect( await page.locator( 'link[rel="icon"][href="/favicon.svg"]' ).count(), route ).toBe( 1 );
						expect( await page.locator( '[data-tocus-ui] .website > .page-shell' ).count(), route ).toBe( 1 );
						expect( await page.locator( 'header .tocus-brand' ).count(), route ).toBe( 1 );
						for ( const href of [ '/', '/privacy/', '/support/', SourceUrl ] ) {
							expect( await page.locator( `footer a[href="${ href }"]` ).count(), `${ route } ${ href }` ).toBe( 1 );
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

			const extensionPolicy = page.locator( '#extension-data' );
			const extensionPolicyText = await extensionPolicy.innerText();
			expect( extensionPolicyText ).toMatch( /choices|preferences/iu );
			expect( extensionPolicyText ).toMatch( /timing/iu );
			expect( extensionPolicyText ).toMatch( /schedule/iu );
			expect( extensionPolicyText ).toMatch( /statistics/iu );
			expect( extensionPolicyText ).toMatch( /shared pause timing/iu );
			expect( extensionPolicyText ).toMatch(
				/lifetime and daily totals stay in your browser until you reset them/iu,
			);
			expect( extensionPolicyText ).toMatch( /follows your operating system's motion preference/iu );
			expect( extensionPolicyText ).not.toMatch( /separate timing|appearance, motion/iu );
			expect( extensionPolicyText ).toMatch( /destination (?:address|URL)/iu );
			expect( extensionPolicyText ).toMatch( /device|browser/iu );
			expect( await page.locator( '#permissions' ).innerText() ).toMatch( /selected (?:sites|websites)/iu );
			expect( await page.locator( '#deletion' ).innerText() ).toMatch( /reset/iu );
			const websiteText = await page.locator( '#website-and-links' ).innerText();
			expect( websiteText ).toMatch( /hosting|server/iu );
			expect( websiteText ).toMatch( /external|outbound|third-party/iu );
			expect( await page.locator( `a[href="${ ChromeLimitedUseUrl }"]` ).count() ).toBe( 1 );
			expect( await page.locator( '#limited-use' ).innerText() ).toMatch( /Limited Use/iu );
		} );
	} );

	test.describe( () => {
		test.use( { contextOptions: { javaScriptEnabled: false } } );

		test( 'support separates public troubleshooting from private vulnerability reports', async ( { page } ) => {
			await page.route( 'http://website.test/**', serveGeneratedAsset );
			await page.goto( 'http://website.test/support/' );

			expect( await page.locator( `a[href="${ IssueUrl }"]` ).count() ).toBe( 1 );
			expect( await page.locator( `a[href="${ SecurityAdvisoryUrl }"]` ).count() ).toBe( 0 );
			const preparationText = await page.locator( '#before-reporting' ).innerText();
			expect( preparationText ).toMatch( /settings/iu );
			const resetText = await page.locator( '#resetting' ).innerText();
			expect( resetText ).toMatch(
				/Reset statistics clears recorded counts and time totals while keeping your sites and settings/iu,
			);
			expect( resetText ).toMatch(
				/Reset all TOCus data removes your local configuration,[^.]*and website access/iu,
			);
			expect( preparationText ).toMatch( /browser allows TOCus to run on the website/iu );
			expect( preparationText ).toMatch( /review site access in your browser's extension settings/iu );
			expect( preparationText ).toMatch( /Pause timing applies to all your selected websites/iu );
			expect( preparationText ).toMatch( /custom schedule changes only its active days and hours/iu );
			expect( preparationText ).not.toMatch( /own timing/iu );
			const publicIssueText = await page.locator( '#public-issues' ).innerText();
			expect( publicIssueText ).toMatch( /remove credentials/iu );
			expect( publicIssueText ).toMatch( /URL|browsing/iu );
			const securityText = await page.locator( '#security-reporting' ).innerText();
			expect( securityText ).toMatch( /private vulnerability reporting is not currently available/iu );
			expect( securityText ).toMatch(
				/Do not share vulnerability details,[^.]*security issue in a public issue/isu,
			);
			expect( await page.locator( 'a[href^="mailto:"]' ).count() ).toBe( 0 );
		} );
	} );
} );
