import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { DemoChapter } from '../../src/components/product-demo/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Finds meaningful scene content hidden beyond the browser frame.
 * @param element - The illustrated browser whose overflow is clipped.
 * @return Numeric bounds for any content extending outside its frame.
 */
function findClippedContent( element: HTMLElement ) {
	const bounds = element.getBoundingClientRect();
	return Array.from( element.querySelectorAll<HTMLElement>( [
		'.product-demo-site-option', '.product-demo-continue', '.product-demo-phase',
		'.product-demo-countdown', '.product-demo-time-left', '.product-demo-manual-control',
		'.product-demo-setup-actions', '.product-demo-shortcut-hint', '.product-demo-video h4',
	].join( ', ' ) ) )
		.flatMap( ( child ) => {
			const box = child.getBoundingClientRect();
			if ( getComputedStyle( child ).visibility === 'hidden' || box.width <= 0 || box.height <= 0 ||
				( box.bottom <= bounds.bottom + 1 && box.top >= bounds.top - 1 &&
					box.left >= bounds.left - 1 && box.right <= bounds.right + 1 ) ) {
				return [];
			}
			return [ {
				className: child.className,
				child: { top: box.top, right: box.right, bottom: box.bottom, left: box.left },
				browser: { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left },
			} ];
		} );
}

for ( const browserName of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const browserTest = test.extend( { browserName } );
	browserTest.describe( `${ browserName } story geometry`, () => {
		browserTest( 'the complete story remains readable in normal flow on short screens', async ( { context, page } ) => {
			test.setTimeout( 30_000 );
			await context.route( '**/*', async ( route ) => {
				const url = new URL( route.request().url() );
				if ( url.origin !== 'http://website.test' ) {
					await route.abort();
					return;
				}
				const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
				await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
			} );
			for ( const viewport of [
				{ width: 1280, height: 500 }, { width: 900, height: 400 },
				{ width: 360, height: 640 }, { width: 1280, height: 720 },
			] ) {
				await test.step( `Read every chapter at ${ String( viewport.width ) } by ${ String( viewport.height ) }`, async () => {
					await page.setViewportSize( viewport );
					await page.goto( 'http://website.test/' );
					await page.evaluate( () => document.fonts.ready );
					await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
					await expect( page.locator( '.experience-stage' ) ).toHaveCSS( 'position', 'static' );
					for ( const chapter of Object.values( DemoChapter ) ) {
						const button = page.locator( `[data-story-chapter="${ chapter }"] button` );
						await button.evaluate( ( element ) => {
							element.scrollIntoView( { block: 'center', behavior: 'instant' } );
							( element as HTMLButtonElement ).focus( { preventScroll: true } );
						} );
						await page.evaluate( () => new Promise( ( resolve ) => {
							requestAnimationFrame( () => requestAnimationFrame( resolve ) );
						} ) );
						const before = await page.evaluate( () => window.scrollY );
						await page.keyboard.press( 'Enter' );
						await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', chapter );
						const stage = page.locator( '.experience-stage' );
						const geometry = await stage.evaluate( ( element ) => {
							const bounds = element.getBoundingClientRect();
							return {
								pinned: getComputedStyle( element ).position === 'sticky',
								top: bounds.top, bottom: bounds.bottom, height: bounds.height,
								trackHeight: element.parentElement?.getBoundingClientRect().height ?? 0,
							};
						} );
						if ( geometry.pinned ) {
							expect( geometry.top, 'caption, browser and controls must share one visible stage' ).toBeGreaterThanOrEqual( 0 );
							expect( geometry.bottom, 'chapter controls must not extend below the viewport' ).toBeLessThanOrEqual( viewport.height );
						} else {
							expect( geometry.trackHeight, 'normal flow must not retain an empty pinned scroll track' ).toBeLessThanOrEqual( geometry.height + 1 );
							expect( await page.evaluate( () => window.scrollY ), 'chapter changes must not jump the page in flow mode' ).toBe( before );
						}
						const clipped = await page.locator( '.product-demo-browser' ).evaluate( findClippedContent );
						expect( clipped, 'meaningful scene content must stay inside its browser frame' ).toEqual( [] );
						await expect( button ).toBeFocused();
					}
				} );
			}
			await test.step( 'Resize while reading without oscillating between scenes or trapping the page', async () => {
				await page.locator( '[data-story-chapter="pause"] button' ).click();
				await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.PAUSE );
				for ( const viewport of [ { width: 900, height: 400 }, { width: 1280, height: 720 } ] ) {
					await page.setViewportSize( viewport );
					await expect.poll( () => page.locator( '.experience-stage' ).evaluate( ( element ) =>
						getComputedStyle( element ).position,
					) ).toBe( 'static' );
					const scenes = await page.locator( '.product-demo' ).evaluate( async ( element ) => {
						const seen = [];
						for ( let frame = 0; frame < 12; frame += 1 ) {
							await new Promise( requestAnimationFrame );
							seen.push( element.getAttribute( 'data-scene' ) );
						}
						return seen;
					} );
					expect( new Set( scenes ).size, 'resizing must settle without repeated scene selection' ).toBe( 1 );
					await page.locator( '[data-story-chapter="continue"] button' ).click();
					const continueButton = page.locator( '.product-demo-continue:visible' );
					await expect( continueButton ).toBeEnabled();
					await continueButton.scrollIntoViewIfNeeded();
					if ( viewport.height === 720 ) {
						const buttonBounds = await continueButton.boundingBox();
						expect( buttonBounds ).not.toBeNull();
						if ( ! buttonBounds ) {
							throw new Error( 'The active Continue button must have visible bounds.' );
						}
						expect( buttonBounds.y ).toBeGreaterThanOrEqual( 0 );
						expect( buttonBounds.y + buttonBounds.height ).toBeLessThanOrEqual( viewport.height );
						const point = { x: buttonBounds.x + buttonBounds.width / 2,
							y: buttonBounds.y + buttonBounds.height / 2 };
						expect( await continueButton.evaluate( ( element, center ) =>
							element.contains( document.elementFromPoint( center.x, center.y ) ), point,
						), 'the visible Continue button must receive the pointer' ).toBe( true );
						// Avoid automatic locator scrolling that moves WebKit's already-visible sticky stage.
						await page.mouse.click( point.x, point.y );
					} else {
						await continueButton.click();
					}
					await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', DemoChapter.BROWSE );
					await expect( page.locator( '[data-story-chapter="browse"] button' ) ).toBeFocused();
				}
			} );
		} );

		for ( const { path, fontSize, height } of [
			{ path: '/', fontSize: 24, height: 640 }, { path: '/', fontSize: 32, height: 640 },
			{ path: '/ru/', fontSize: 24, height: 640 },
			// These sizes previously changed pinning or selected chapters when scene height changed.
			{ path: '/', fontSize: 16, height: 718 }, { path: '/', fontSize: 32, height: 1608 },
		] ) {
			browserTest( `${ path } at 360 by ${ String( height ) }, ${ String( fontSize ) }px: story content remains readable without flow jumps`, async ( { context, page } ) => {
				await page.setViewportSize( { width: 360, height } );
				await page.emulateMedia( { reducedMotion: 'reduce' } );
				await context.route( '**/*', async ( route ) => {
					const url = new URL( route.request().url() );
					if ( url.origin !== 'http://website.test' ) {
						await route.abort();
						return;
					}
					const assetPath = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ assetPath }`, WebsiteOutput ) ) } );
				} );
				await page.goto( `http://website.test${ path }` );
				await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
				await page.evaluate( async ( size ) => {
					await document.fonts.ready;
					document.documentElement.style.fontSize = `${ String( size ) }px`;
				}, fontSize );
				const stage = page.locator( '.experience-stage' );
				await expect.poll( () => stage.evaluate( ( element ) => {
					const style = getComputedStyle( element );
					return style.position === 'static';
				} ) ).toBe( true );
				const position = await stage.evaluate( ( element ) => getComputedStyle( element ).position );
				if ( height === 640 ) {
					expect( position ).toBe( 'static' );
				}
				const stageHeight = await page.locator( '.product-demo-browser' ).evaluate( ( element ) => element.getBoundingClientRect().height );
				for ( const chapter of Object.values( DemoChapter ) ) {
					await test.step( `Read the ${ chapter } chapter`, async () => {
						const button = page.locator( `[data-story-chapter="${ chapter }"] button` );
						await button.evaluate( ( element ) => {
							element.scrollIntoView( { block: 'center', behavior: 'instant' } );
							( element as HTMLButtonElement ).focus( { preventScroll: true } );
						} );
						await page.evaluate( () => new Promise( ( resolve ) => {
							requestAnimationFrame( () => requestAnimationFrame( resolve ) );
						} ) );
						const before = await page.evaluate( () => window.scrollY );
						await page.keyboard.press( 'Enter' );
						await expect( page.locator( '.product-demo' ) ).toHaveAttribute( 'data-scene', chapter );
						await expect( page.locator( '[data-demo-chapter][aria-hidden="false"]' ) ).toHaveCount( 1 );
						await expect( page.locator( '[data-demo-chapter][aria-hidden="true"]:not([inert])' ) ).toHaveCount( 0 );
						await expect( stage ).toHaveCSS( 'position', position );
						const currentHeight = await page.locator( '.product-demo-browser' ).evaluate( ( element ) =>
							element.getBoundingClientRect().height,
						);
						expect( Math.abs( currentHeight - stageHeight ),
							'every scene must reserve the same complete browser height' ).toBeLessThan( 1 );
						if ( position === 'static' ) {
							expect( await page.evaluate( () => window.scrollY ),
								'chapter changes must not jump the page in flow mode' ).toBe( before );
						} else {
							const bounds = await stage.boundingBox();
							expect( bounds?.y ).toBeGreaterThanOrEqual( 0 );
							expect( ( bounds?.y ?? height ) + ( bounds?.height ?? height ) )
								.toBeLessThanOrEqual( height );
						}
						expect( await page.locator( '.product-demo-browser' ).evaluate( findClippedContent ),
							'enlarged text and controls must remain inside the browser frame' ).toEqual( [] );
						await expect( button ).toBeFocused();
					} );
				}
			} );
		}
	} );
}
