import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { describe, expect, test } from 'vitest';
import { DemoChapter } from '../../src/components/product-demo/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

describe( 'generated website scroll story', () => {
	for ( const engine of [ chromium, firefox, webkit ] ) {
		test( `${ engine.name() }: reduced-motion chapter controls select once and keep keyboard focus on a small screen`, async () => {
			const browser = await engine.launch();
			const context = await browser.newContext( { viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' } );
			await context.route( '**/*', async ( route ) => {
				const url = new URL( route.request().url() );
				if ( url.origin !== 'http://website.test' ) {
					await route.abort();
					return;
				}
				const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
				await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
			} );
			try {
				const page = await context.newPage();
				await page.goto( 'http://website.test/' );
				await page.evaluate( () => document.fonts.ready );
				await expect.poll( () => page.locator( '[data-story-chapter][data-current]' ).count() ).toBe( 5 );
				expect( await page.locator( '.story-caption[aria-hidden="false"]' ).count() ).toBe( 1 );
				expect( await page.locator( '[data-story-active]' ).count() ).toBe( 0 );
				const demo = page.locator( '.product-demo' );
				for ( const chapter of [ 'pause', 'browse', 'continue', 'visit', 'choose' ] ) {
					const button = page.locator( `[data-story-chapter="${ chapter }"] button` );
					await button.evaluate( ( element ) => {
						element.focus( { preventScroll: true } );
					} );
					await demo.evaluate( ( element ) => {
						element.setAttribute( 'data-test-scene-changes', '0' );
						const observer = new MutationObserver( ( records ) => {
							const count = Number( element.getAttribute( 'data-test-scene-changes' ) );
							element.setAttribute( 'data-test-scene-changes', String( count + records.length ) );
						} );
						observer.observe( element, { attributes: true, attributeFilter: [ 'data-scene' ] } );
						element.addEventListener( 'tocus-test-stop-counting', () => {
							observer.disconnect();
						}, { once: true } );
					} );
					await button.press( chapter === 'browse' ? 'Space' : 'Enter' );
					await expect.poll( () => demo.getAttribute( 'data-scene' ) ).toBe( chapter );
					await page.waitForTimeout( 150 );
					await demo.dispatchEvent( 'tocus-test-stop-counting' );
					expect( await demo.getAttribute( 'data-test-scene-changes' ) ).toBe( '1' );
					expect( await button.evaluate( ( element ) => document.activeElement === element ) ).toBe( true );
					expect( await page.locator( '.story-caption[aria-hidden="false"]' ).getAttribute( 'data-caption-chapter' ) ).toBe( chapter );
					const caption = page.locator( '.story-caption[aria-hidden="false"]' );
					expect( await caption.evaluate( ( element ) => {
						const bounds = element.getBoundingClientRect();
						const parent = element.parentElement;
						return parent !== null && bounds.top >= 0 && bounds.bottom <= window.innerHeight &&
							getComputedStyle( element ).visibility === 'visible' &&
							getComputedStyle( parent ).opacity === '1';
					} ) ).toBe( true );
					expect( await page.locator( '[aria-current="step"]' ).count() ).toBe( 1 );
					const bounds = await button.boundingBox();
					expect( bounds?.y ).toBeGreaterThan( 0 );
					expect( ( bounds?.y ?? 640 ) + ( bounds?.height ?? 0 ) ).toBeLessThanOrEqual( 640 );
					expect( await page.locator( '[data-story-active]' ).count() ).toBe( 1 );
				}
				await page.locator( '[data-story-chapter="pause"] button' ).click();
				await expect.poll( () => demo.getAttribute( 'data-scene' ) ).toBe( 'pause' );
				await page.evaluate( () => {
					window.scrollTo( { top: 0, behavior: 'instant' } );
				} );
				await expect.poll( () => page.locator( '[data-story-active]' ).count() ).toBe( 0 );
				expect( await page.locator( '.hero-art .mascot' ).evaluate( ( element ) =>
					getComputedStyle( element ).transform,
				) ).toBe( 'none' );
			} finally {
				await browser.close();
			}
		}, 20_000 );
		for ( const viewport of [ { width: 1280, height: 720 }, { width: 360, height: 800 } ] ) {
			test( `${ engine.name() } ${ String( viewport.width ) }: wheels advance and reverse all five scenes in a stable frame`, async () => {
				const browser = await engine.launch();
				const context = await browser.newContext( { viewport, reducedMotion: 'no-preference' } );
				await context.route( '**/*', async ( route ) => {
					const url = new URL( route.request().url() );
					if ( url.origin !== 'http://website.test' ) {
						await route.abort();
						return;
					}
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				try {
					const page = await context.newPage();
					await page.goto( 'http://website.test/' );
					await page.evaluate( () => document.fonts.ready );
					const demo = page.locator( '.product-demo' );
					const preview = demo.locator( '.product-demo-browser' );
					expect( await page.locator( '[data-story-chapter]' ).count() ).toBe( 5 );
					await expect.poll( () => page.locator( '[data-story-chapter][data-current]' ).count() ).toBe( 5 );
					expect( await page.locator( '.story-layout' ).evaluate( ( element ) =>
						element.getBoundingClientRect().height / window.innerHeight,
					) ).toBeLessThanOrEqual( 3.6 );
					expect( await page.locator( '.story-caption[aria-hidden="false"]' ).count() ).toBe( 1 );
					const distance = await page.locator( '.story-layout' ).evaluate( ( element ) => {
						const end = window.scrollY + element.getBoundingClientRect().bottom + window.innerHeight * 0.25;
						return Math.ceil( end / 60 );
					} );
					const frames = preview.evaluate( async ( element ) => {
						const boxes = [];
						const sampling = new AbortController();
						element.addEventListener( 'tocus-test-scroll-complete', () => {
							sampling.abort();
						}, { once: true } );
						while ( ! sampling.signal.aborted ) {
							await new Promise( ( resolve ) => requestAnimationFrame( resolve ) );
							const { left, top, width } = element.getBoundingClientRect();
							const scene = element.closest<HTMLElement>( '.product-demo' )?.dataset.scene;
							const countdown = element.querySelector( '.product-demo-countdown' )?.textContent;
							const allowance = element.querySelector( '.product-demo-time-left time' )?.textContent;
							const captions = document.querySelectorAll( '.story-caption[aria-hidden="false"]' ).length;
							boxes.push( { left, top, width, scrollY: window.scrollY, scene, countdown,
								allowance, captions } );
						}
						return boxes;
					} );
					await page.mouse.move( viewport.width - 20, viewport.height / 2 );
					try {
						for ( const direction of [ 1, -1 ] ) {
							for ( let step = 0; step < 60; step += 1 ) {
								const before = await page.evaluate( () => window.scrollY );
								await page.mouse.wheel( 0, distance * direction );
								await expect.poll( () => page.evaluate( () => window.scrollY ) ).not.toBe( before );
								// Let native scrolling composite before delivering the next gesture in WebKit.
								await page.evaluate( () => new Promise( ( resolve ) => {
									requestAnimationFrame( () => requestAnimationFrame( resolve ) );
								} ) );
							}
							await page.waitForTimeout( 150 );
						}
					} finally {
						await preview.dispatchEvent( 'tocus-test-scroll-complete' );
						await frames;
					}
					const boxes = await frames;
					expect( new Set( boxes.map( ( box ) => box.scene ) ) ).toEqual(
						new Set( Object.values( DemoChapter ) ),
					);
					expect( boxes.every( ( box ) => box.captions === 1 ) ).toBe( true );
					const transitions = boxes.map( ( box ) => box.scene ).filter( ( scene, index, scenes ) =>
						index === 0 || scene !== scenes[ index - 1 ],
					);
					expect( transitions ).toEqual( [ 'choose', 'visit', 'pause', 'continue', 'browse',
						'continue', 'pause', 'visit', 'choose' ] );
					const pauses = boxes.filter( ( box ) => box.scene === DemoChapter.PAUSE );
					const browsing = boxes.filter( ( box ) => box.scene === DemoChapter.BROWSE );
					expect( new Set( pauses.map( ( box ) => box.countdown ) ).size )
						.toBeGreaterThan( 2 );
					expect( new Set( browsing.map( ( box ) => box.allowance ) ).size )
						.toBeGreaterThan( 2 );
					expect( boxes.filter( ( box ) => box.scene !== DemoChapter.BROWSE )
						.some( ( box ) => box.allowance ) ).toBe( false );
					expect( boxes.at( -1 )?.scrollY ).toBe( 0 );
					expect( await demo.getAttribute( 'data-scene' ) ).toBe( DemoChapter.CHOOSE );
					const widths = boxes.map( ( box ) => box.width );
					const positions = boxes.map( ( box ) => box.left );
					expect( Math.max( ...widths ) - Math.min( ...widths ) )
						.toBeLessThan( 1 );
					expect( Math.max( ...positions ) - Math.min( ...positions ) )
						.toBeLessThan( 1 );
					for ( const [ index, current ] of boxes.entries() ) {
						const previous = boxes[ index - 1 ];
						if ( previous === undefined ) {
							continue;
						}
						const scroll = current.scrollY - previous.scrollY;
						const movement = current.top - previous.top;
						expect( scroll === 0 ? Math.abs( movement ) : movement * Math.sign( scroll ),
							'the frame follows native scroll and remains still after scrolling stops',
						).toBeLessThan( 1 );
					}
					expect( await page.evaluate( () =>
						document.documentElement.scrollWidth <= window.innerWidth,
					) ).toBe( true );
					expect( await page.locator( '.pin-spacer' ).count() ).toBe( 0 );
				} finally {
					await browser.close();
				}
			}, 40_000 );
		}
	}
} );
