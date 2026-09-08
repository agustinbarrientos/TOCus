import { comparePage, expect, test, WebsiteOrigin } from './helpers';
import { DemoChapter } from '../../apps/website/src/components/product-demo/types';

test.beforeEach( async ( { page } ) => {
	// Keep the real demo renderer at its initial still frame during full-page captures.
	const captureTime = new Date( '2026-09-07T12:00:00Z' );
	await page.clock.install( { time: new Date( captureTime.getTime() - 1000 ) } );
	await page.clock.pauseAt( captureTime );
} );

for ( const [ name, route ] of [ [ 'english', '/' ], [ 'spanish-vos', '/es-ar/' ],
	[ 'portuguese-brazil', '/pt-br/' ], [ 'portuguese-portugal', '/pt-pt/' ] ] as const ) {
	for ( const [ size, width ] of [ [ 'desktop', 1440 ], [ 'narrow', 390 ] ] as const ) {
		test( `Website ${ name } ${ size }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: 1000 } );
			await page.goto( `${ WebsiteOrigin }${ route }` );
			await expect( page.getByRole( 'heading', { level: 1 } ) ).toBeVisible();
			await comparePage( page, `website-${ name }-${ size }` );
		} );
	}
}

test( 'Website remains light in a dark browser', async ( { page } ) => {
	await page.emulateMedia( { colorScheme: 'dark' } );
	await page.goto( WebsiteOrigin );
	await expect( page.locator( '[data-tocus-ui]' ).first() ).toHaveAttribute( 'data-tocus-theme', 'light' );
	await comparePage( page, 'website-english-dark-desktop' );
} );

for ( const [ size, width ] of [ [ 'desktop', 1440 ], [ 'narrow', 390 ] ] as const ) {
	for ( const chapter of Object.values( DemoChapter ) ) {
		test( `Website story ${ chapter } ${ size }`, async ( { page } ) => {
			await page.setViewportSize( { width, height: size === 'desktop' ? 1000 : 844 } );
			await page.goto( WebsiteOrigin );
			await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
			await page.locator( `[data-story-chapter="${ chapter }"] button` ).click();
			await page.clock.runFor( 100 );
			await page.mouse.move( 0, 0 );
			await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', chapter );
			await expect( page.locator( '.hero-art' ) ).toBeHidden();
			await comparePage( page, `website-english-story-${ chapter }-${ size }`, false );
		} );
	}
}

test( 'Website language menu narrow', async ( { page } ) => {
	await page.setViewportSize( { width: 390, height: 844 } );
	await page.goto( WebsiteOrigin );
	await page.locator( '#languages button' ).click();
	await page.clock.runFor( 200 );
	await expect( page.getByRole( 'menu' ) ).toBeVisible();
	await page.mouse.move( 0, 0 );
	await comparePage( page, 'website-english-language-menu-narrow', false );
} );
