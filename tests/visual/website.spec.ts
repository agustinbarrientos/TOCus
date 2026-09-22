import { comparePage, expect, test, WebsiteOrigin } from './helpers';
import { DemoChapter } from '../../apps/website/src/components/product-demo/types';
import type { Page } from '@playwright/test';

test.beforeEach( async ( { page } ) => {
	// The native poster gives screenshot comparisons a deterministic hero frame.
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	// Keep the real demo renderer at its initial still frame during full-page captures.
	const captureTime = new Date( '2026-09-07T12:00:00Z' );
	await page.clock.install( { time: new Date( captureTime.getTime() - 1000 ) } );
	await page.clock.pauseAt( captureTime );
} );

/**
 * Loads the complete website artwork before choosing a screenshot frame.
 * @param page - Website page with the frozen screenshot clock.
 * @param route - Localized homepage route.
 * @return Completion after hydration, fonts, and image decoding.
 */
async function openWebsite( page: Page, route = '/' ): Promise<void> {
	await page.goto( `${ WebsiteOrigin }${ route }` );
	await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
	await page.evaluate( () => document.fonts.ready );
	await page.locator( '.footer-mascot img' ).scrollIntoViewIfNeeded();
	await decodeVisibleImages( page );
	await page.evaluate( () => {
		window.scrollTo( { top: 0, behavior: 'instant' } );
	} );
}

/**
 * Waits for the images in the selected scene without loading inactive lazy artwork.
 * @param page - Hydrated website in its intended capture state.
 * @return Completion after the rendered images have decoded.
 */
async function decodeVisibleImages( page: Page ): Promise<void> {
	await page.locator( 'img:visible' ).evaluateAll( async ( images: HTMLImageElement[] ) => {
		await Promise.all( images.map( ( image ) => image.decode() ) );
	} );
}

for ( const [ name, route ] of [ [ 'english', '/' ], [ 'spanish-vos', '/es-ar/' ],
	[ 'portuguese-brazil', '/pt-br/' ], [ 'portuguese-portugal', '/pt-pt/' ] ] as const ) {
	for ( const [ size, width ] of [ [ 'desktop', 1440 ], [ 'narrow', 390 ] ] as const ) {
		test( `Website ${ name } ${ size }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: 1000 } );
			await openWebsite( page, route );
			await expect( page.getByRole( 'heading', { level: 1 } ) ).toBeVisible();
			await comparePage( page, `website-${ name }-${ size }` );
		} );
	}
}

test( 'Website remains light in a dark browser', async ( { page } ) => {
	await page.emulateMedia( { colorScheme: 'dark' } );
	await openWebsite( page );
	await expect( page.locator( '[data-tocus-ui]' ).first() ).toHaveAttribute( 'data-tocus-theme', 'light' );
	await comparePage( page, 'website-english-dark-desktop' );
} );

for ( const [ size, width ] of [ [ 'desktop', 1440 ], [ 'narrow', 390 ] ] as const ) {
	for ( const chapter of Object.values( DemoChapter ) ) {
		test( `Website story ${ chapter } ${ size }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: size === 'desktop' ? 1000 : 844 } );
			await openWebsite( page );
			await page.locator( `[data-story-chapter="${ chapter }"] button` ).click();
			await page.clock.runFor( 100 );
			await page.mouse.move( 0, 0 );
			await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', chapter );
			await expect( page.locator( '.riverside-hero' ) ).toBeVisible();
			await expect( page.locator( '.experience-stage' ) ).toHaveCSS( 'position', 'static' );
			const frame = page.locator( size === 'desktop' ? '.experience-stage' : '.story-player' );
			await frame.evaluate( ( element ) => {
				element.scrollIntoView( { block: 'start', behavior: 'instant' } );
			} );
			await expect( page.locator( '.product-demo' ) ).toBeInViewport( { ratio: 1 } );
			await decodeVisibleImages( page );
			await comparePage( page, `website-english-story-${ chapter }-${ size }`, false );
		} );
	}
}

test( 'Website language menu narrow', async ( { page } ) => {
	await page.setViewportSize( { width: 390, height: 844 } );
	await openWebsite( page );
	await page.locator( '.site-header .language-shortcut' ).click();
	await page.clock.runFor( 200 );
	await expect( page.getByRole( 'menu' ) ).toBeVisible();
	await page.mouse.move( 0, 0 );
	await comparePage( page, 'website-english-language-menu-narrow', false );
} );
