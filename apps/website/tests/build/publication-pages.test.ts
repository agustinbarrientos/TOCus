import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, type Page, type Route } from 'playwright';
import { describe, expect, test } from 'vitest';

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

describe( 'generated website publication pages', () => {
	for ( const engine of [ chromium, firefox, webkit ] ) {
		test( `${ engine.name() }: canonical pages are useful without JavaScript or outbound loading`, async () => {
			const browser = await engine.launch();
			const context = await browser.newContext( {
				javaScriptEnabled: false,
				viewport: { width: 360, height: 800 },
			} );
			const externalRequests: string[] = [];

			await context.route( '**/*', async ( route ) => {
				if ( new URL( route.request().url() ).origin !== 'http://website.test' ) {
					externalRequests.push( route.request().url() );
					await route.abort();
					return;
				}

				await serveGeneratedAsset( route );
			} );

			try {
				const page = await context.newPage();

				for ( const route of PublicationRoutes ) {
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
					expect(
						await page.evaluate( () => document.documentElement.scrollWidth <= window.innerWidth ),
						route,
					).toBe( true );
				}

				expect( externalRequests ).toEqual( [] );
			} finally {
				await browser.close();
			}
		}, 60_000 );
	}

	test( 'hydrated information pages remain light when system appearance changes', async () => {
		const browser = await chromium.launch();
		const context = await browser.newContext( { colorScheme: 'dark' } );
		await context.route( 'http://website.test/**', serveGeneratedAsset );
		try {
			const page = await context.newPage();

			for ( const route of PublicationRoutes ) {
				await page.emulateMedia( { colorScheme: 'dark' } );
				await page.goto( `http://website.test${ route }` );
				const provider = page.locator( '[data-tocus-ui]' );
				await expect.poll( () => provider.getAttribute( 'data-tocus-theme' ) ).toBe( 'light' );

				await page.emulateMedia( { colorScheme: 'light' } );
				await expect.poll( () => provider.getAttribute( 'data-tocus-theme' ) ).toBe( 'light' );
			}
		} finally {
			await browser.close();
		}
	} );

	test( 'privacy distinguishes local extension data from deliberate network requests', async () => {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage( { javaScriptEnabled: false } );
			await page.route( 'http://website.test/**', serveGeneratedAsset );
			await page.goto( 'http://website.test/privacy/' );

			const extensionPolicy = page.locator( '#extension-data' );
			const extensionPolicyText = await extensionPolicy.innerText();
			expect( extensionPolicyText ).toMatch( /choices|preferences/iu );
			expect( extensionPolicyText ).toMatch( /timing/iu );
			expect( extensionPolicyText ).toMatch( /schedule/iu );
			expect( extensionPolicyText ).toMatch( /statistics/iu );
			expect( extensionPolicyText ).toMatch( /destination (?:address|URL)/iu );
			expect( extensionPolicyText ).toMatch( /device|browser/iu );
			expect( await page.locator( '#permissions' ).innerText() ).toMatch( /selected (?:sites|websites)/iu );
			expect( await page.locator( '#deletion' ).innerText() ).toMatch( /reset/iu );
			const websiteText = await page.locator( '#website-and-links' ).innerText();
			expect( websiteText ).toMatch( /hosting|server/iu );
			expect( websiteText ).toMatch( /external|outbound|third-party/iu );
			expect( await page.locator( `a[href="${ ChromeLimitedUseUrl }"]` ).count() ).toBe( 1 );
			expect( await page.locator( '#limited-use' ).innerText() ).toMatch( /Limited Use/iu );
		} finally {
			await browser.close();
		}
	} );

	test( 'support separates public troubleshooting from private vulnerability reports', async () => {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage( { javaScriptEnabled: false } );
			await page.route( 'http://website.test/**', serveGeneratedAsset );
			await page.goto( 'http://website.test/support/' );

			expect( await page.locator( `a[href="${ IssueUrl }"]` ).count() ).toBe( 1 );
			expect( await page.locator( `a[href="${ SecurityAdvisoryUrl }"]` ).count() ).toBe( 0 );
			const preparationText = await page.locator( '#before-reporting' ).innerText();
			expect( preparationText ).toMatch( /setup/iu );
			expect( preparationText ).toMatch( /reset/iu );
			expect( preparationText ).toMatch( /permission/iu );
			const publicIssueText = await page.locator( '#public-issues' ).innerText();
			expect( publicIssueText ).toMatch( /do not include|never include/iu );
			expect( publicIssueText ).toMatch( /URL|browsing/iu );
			const securityText = await page.locator( '#security-reporting' ).innerText();
			expect( securityText ).toMatch( /private vulnerability reporting is not currently available/iu );
			expect( securityText ).toMatch( /do not put security.*public issue/isu );
			expect( await page.locator( 'a[href^="mailto:"]' ).count() ).toBe( 0 );
		} finally {
			await browser.close();
		}
	} );
} );
