import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { DemoChapter } from '../../src/components/product-demo/types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Reaches a story position with bounded real wheel gestures and rendered native frames.
 * @param page - Browser page whose story receives wheel input.
 * @param target - Document scroll position measured from the rendered story geometry.
 * @return Completion after every gesture reaches its position and two frames render.
 */
async function wheelTo( page: Page, target: number ): Promise<void> {
	const { before, maximumGesture } = await page.evaluate( () => ( {
		before: window.scrollY, maximumGesture: window.innerHeight / 2,
	} ) );
	// Firefox caps large wheel deltas; divide long entry/exit travel without bypassing native input.
	const gestures = Math.ceil( Math.abs( target - before ) / maximumGesture );
	let previous = before;
	for ( let gesture = 1; gesture <= gestures; gesture += 1 ) {
		const next = Math.round( before + ( target - before ) * gesture / gestures );
		await page.mouse.wheel( 0, next - previous );
		await page.waitForFunction( ( position ) => Math.abs( window.scrollY - position ) <= 1, next );
		// Let native scrolling and its React scene update composite before the next gesture.
		await page.evaluate( () => new Promise( ( resolve ) => {
			requestAnimationFrame( () => requestAnimationFrame( resolve ) );
		} ) );
		previous = next;
	}
}

test.describe( 'generated website scroll story', () => {
	for ( const engine of [ 'chromium', 'firefox', 'webkit' ] as const ) {
		const engineTest = test.extend( { browserName: engine } );

		engineTest.describe( () => {
			engineTest.use( { contextOptions: { viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' } } );

			engineTest( `${ engine }: reduced-motion chapter controls select once and keep keyboard focus on a small screen`, async ( { context, page } ) => {
				engineTest.setTimeout( 20_000 );
				await context.route( '**/*', async ( route ) => {
					const url = new URL( route.request().url() );
					if ( url.origin !== 'http://website.test' ) {
						await route.abort();
						return;
					}
					const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
					await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
				} );
				await page.goto( 'http://website.test/' );
				await page.evaluate( () => document.fonts.ready );
				await expect.poll( () => page.locator( '[data-story-chapter][data-current]' ).count() ).toBe( 5 );
				expect( await page.locator( '.story-caption[aria-hidden="false"]' ).count() ).toBe( 1 );
				expect( await page.locator( '[data-story-active]' ).count() ).toBe( 0 );
				const demo = page.locator( '.product-demo' );
				for ( const chapter of [ 'pause', 'browse', 'continue', 'visit', 'choose' ] ) {
					await engineTest.step( `Select ${ chapter } and observe stable focus`, async () => {
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
						expect( await button.evaluate( ( element ) =>
							document.activeElement === element,
						) ).toBe( true );
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
					} );
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
			} );
		} );
		for ( const viewport of [ { width: 1280, height: 720 }, { width: 360, height: 800 } ] ) {
			engineTest.describe( () => {
				engineTest.use( { contextOptions: { viewport, reducedMotion: 'no-preference' } } );

				engineTest( `${ engine } ${ String( viewport.width ) }: wheels advance and reverse all five scenes in a stable frame`, async ( { context, page } ) => {
					engineTest.setTimeout( 40_000 );
					await context.route( '**/*', async ( route ) => {
						const url = new URL( route.request().url() );
						if ( url.origin !== 'http://website.test' ) {
							await route.abort();
							return;
						}
						const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
						await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
					} );
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
					const travel = await page.locator( '.story-layout' ).evaluate( ( element ) => {
						const stage = element.querySelector<HTMLElement>( '.experience-stage' );
						if ( stage === null ) {
							throw new Error( 'The sticky story stage is unavailable.' );
						}
						const bounds = element.getBoundingClientRect();
						return {
							start: window.scrollY + bounds.top - Number.parseFloat( getComputedStyle( stage ).top ),
							distance: bounds.height - stage.offsetHeight,
							end: Math.ceil( window.scrollY + bounds.bottom + window.innerHeight * 0.25 ),
						};
					} );
					// Visit both sides of every chapter boundary and multiple positions within the two timers.
					const stops = [
						[ 0.04, DemoChapter.CHOOSE ], [ 0.22, DemoChapter.VISIT ],
						[ 0.42, DemoChapter.PAUSE ], [ 0.50, DemoChapter.PAUSE ], [ 0.58, DemoChapter.PAUSE ],
						[ 0.62, DemoChapter.CONTINUE ],
						[ 0.82, DemoChapter.BROWSE ], [ 0.90, DemoChapter.BROWSE ], [ 0.98, DemoChapter.BROWSE ],
					] as const;
					/**
					 * Records every rendered frame until the scroll observation ends.
					 * @param element - Preview whose position and scene remain under observation.
					 * @return All rendered frame measurements, including the terminal position.
					 */
					const frames = preview.evaluate( async ( element ) => {
						const boxes = [];
						const sampling = new AbortController();
						element.addEventListener( 'tocus-test-scroll-complete', () => {
							sampling.abort();
						}, { once: true } );
						while ( ! sampling.signal.aborted ) {
							await new Promise<void>( ( resolve ) => {
								/** Completes a frame wait immediately when sampling is cancelled. */
								const complete = (): void => {
									cancelAnimationFrame( frame );
									sampling.signal.removeEventListener( 'abort', complete );
									resolve();
								};
								const frame = requestAnimationFrame( complete );
								sampling.signal.addEventListener( 'abort', complete, { once: true } );
							} );
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
					try {
						await page.mouse.move( viewport.width - 20, viewport.height / 2 );
						for ( const direction of [ 1, -1 ] ) {
							await engineTest.step( direction === 1 ? 'Scroll forward through all scenes' : 'Scroll backward through all scenes', async () => {
								const orderedStops = direction === 1 ? stops : [ ...stops ].reverse();
								for ( const [ fraction, chapter ] of orderedStops ) {
									await wheelTo( page, Math.round( travel.start + travel.distance * fraction ) );
									await expect( demo ).toHaveAttribute( 'data-scene', chapter );
								}
								await wheelTo( page, direction === 1 ? travel.end : 0 );
								// Sample a stationary interval at each end to keep delayed shaking observable.
								await page.waitForTimeout( 150 );
							} );
						}
					} finally {
						await preview.dispatchEvent( 'tocus-test-scroll-complete', undefined, { timeout: 1_000 } );
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
				} );
			} );
		}
	}
} );
