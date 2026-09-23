import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Route } from '@playwright/test';
import { MotionPreference } from './types';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

/**
 * Serves the built website without allowing external resources.
 * @param route - Browser request for a packaged website file.
 */
async function serveAsset( route: Route ): Promise<void> {
	const url = new URL( route.request().url() );
	if ( url.protocol === 'blob:' ) {
		await route.continue();
		return;
	}
	const pathname = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
	const file = fileURLToPath( new URL( `.${ pathname }`, WebsiteOutput ) );
	if ( url.origin !== 'http://website.test' || ! existsSync( file ) ) {
		await route.abort();
		return;
	}
	await route.fulfill( { path: file } );
}

/**
 * Loads the real renderer and model independently for each animated behavior.
 * @param page - Isolated browser page for the current behavior.
 * @return Shader errors observed throughout the scene's lifetime.
 */
async function openAnimatedHero( page: Page ): Promise<string[]> {
	const shaderErrors: string[] = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' && /webglprogram|shader error/iu.test( message.text() ) ) {
			shaderErrors.push( message.text() );
		}
	} );
	await page.setViewportSize( { width: 960, height: 640 } );
	await page.route( '**/*', serveAsset );
	await page.goto( 'http://website.test/' );
	const scene = page.locator( '.riverside-hero' );
	const canvas = scene.locator( 'canvas' );
	const restYaw = 42 * Math.PI / 180;
	await expect( scene ).toHaveAttribute( 'data-status', 'ready' );
	await expect( canvas ).toHaveAttribute( 'data-playing', 'true' );
	expect( Number( await canvas.getAttribute( 'data-yaw' ) ) ).toBeCloseTo( restYaw );
	expect( Number( await canvas.getAttribute( 'data-head-yaw' ) ) ).toBeCloseTo( restYaw * 35 / 50 );
	await expect.poll( async () => Number( await canvas.getAttribute( 'data-triangles' ) ) ).toBeGreaterThan( 0 );
	return shaderErrors;
}

/**
 * Makes animation timestamps independent of software GPU throughput.
 * @param page - Isolated browser page before the scene is loaded.
 */
async function pauseAnimationClock( page: Page ): Promise<void> {
	const start = new Date( '2026-09-07T12:00:00Z' );
	await page.clock.install( { time: new Date( start.getTime() - 1000 ) } );
	await page.clock.pauseAt( start );
}

/**
 * Advances real render callbacks without exceeding the mixer's animation-delta cap.
 * @param page - Browser page with its animation clock paused.
 * @param frames - Number of 250 ms frames to render.
 */
async function advanceAnimationFrames( page: Page, frames: number ): Promise<void> {
	for ( let frame = 0; frame < frames; frame++ ) {
		await page.clock.fastForward( 250 );
	}
}

test.describe( 'homepage riverside hero', () => {
	test( 'orbits with attentive head turns and drifts back to the resting view', async ( { page } ) => {
		await pauseAnimationClock( page );
		const shaderErrors = await openAnimatedHero( page );
		const canvas = page.locator( '.riverside-hero canvas' );
		const restYaw = 42 * Math.PI / 180;
		const height = await canvas.getAttribute( 'data-camera-height' );
		if ( height === null ) {
			throw new Error( 'The loaded scene must expose its camera height.' );
		}
		expect( Number( height ) ).toBeGreaterThan( 0 );
		// The first callback initializes the scene's previous-frame timestamp.
		await advanceAnimationFrames( page, 1 );

		await test.step( 'horizontal orbit turns the head visibly toward the viewer in each direction', async () => {
			const headLimit = 35 * Math.PI / 180;
			await page.mouse.move( 0, 320 );
			await advanceAnimationFrames( page, 5 );
			const left = await canvas.evaluate( ( element: HTMLCanvasElement ) => ( {
				yaw: Number( element.dataset.yaw ), head: Number( element.dataset.headYaw ),
				height: element.dataset.cameraHeight,
			} ) );
			expect( left.yaw ).toBeLessThan( -0.84 );
			expect( left.yaw ).toBeGreaterThanOrEqual( -50 * Math.PI / 180 );
			expect( left.head, 'The head follows left independently of the drinking pose.' ).toBeLessThan( -0.3 );
			expect( left.head ).toBeGreaterThanOrEqual( -headLimit );
			expect( Math.abs( left.head ) ).toBeLessThan( Math.abs( left.yaw ) );
			expect( left.height ).toBe( height );
			await page.mouse.move( 959, 320 );
			await advanceAnimationFrames( page, 5 );
			const right = await canvas.evaluate( ( element: HTMLCanvasElement ) => ( {
				yaw: Number( element.dataset.yaw ), head: Number( element.dataset.headYaw ),
			} ) );
			expect( right.yaw ).toBeGreaterThan( 0.84 );
			expect( right.yaw ).toBeLessThanOrEqual( 50 * Math.PI / 180 );
			expect( right.head, 'The head follows right independently of the drinking pose.' ).toBeGreaterThan( 0.3 );
			expect( right.head ).toBeLessThanOrEqual( headLimit );
			expect( right.head ).toBeLessThan( right.yaw );
			await page.mouse.move( 959, 100 );
			await advanceAnimationFrames( page, 1 );
			const raised = await canvas.evaluate( ( element: HTMLCanvasElement ) => ( {
				head: Number( element.dataset.headYaw ), height: element.dataset.cameraHeight,
			} ) );
			expect( raised.height ).toBe( height );
			expect( Math.abs( raised.head ) ).toBeLessThanOrEqual( headLimit );
		} );

		await test.step( 'leaving the hero returns more slowly than following the pointer', async () => {
			const departure = await canvas.evaluate( ( element: HTMLCanvasElement ) => {
				element.closest( '.hero' )?.dispatchEvent( new PointerEvent( 'pointerleave' ) );
				return { yaw: Number( element.dataset.yaw ), time: performance.now() };
			} );
			await advanceAnimationFrames( page, 3 );
			const returning = await canvas.evaluate( ( element: HTMLCanvasElement ) => ( {
				yaw: Number( element.dataset.yaw ), time: performance.now(),
			} ) );
			const remaining = ( returning.yaw - restYaw ) / ( departure.yaw - restYaw );
			const seconds = ( returning.time - departure.time ) / 1000;
			const returnRate = -Math.log( remaining ) / seconds;
			expect( returnRate, 'Leaving the hero drifts home instead of using the fast pointer-follow speed.' ).toBeLessThan( 1.8 );
			expect( returnRate ).toBeGreaterThan( 0.9 );
			await advanceAnimationFrames( page, 8 );
			expect( Math.abs( Number( await canvas.getAttribute( 'data-yaw' ) ) - restYaw ) ).toBeLessThan( 0.01 );
			await page.mouse.move( 480, 280 );
			await advanceAnimationFrames( page, 4 );
			const centered = await canvas.evaluate( ( element: HTMLCanvasElement ) => ( {
				yaw: Number( element.dataset.yaw ), head: Number( element.dataset.headYaw ),
			} ) );
			expect( Math.abs( centered.yaw - restYaw ) ).toBeLessThan( 0.01 );
			expect( Math.abs( centered.head - restYaw * 35 / 50 ) ).toBeLessThan( 0.005 );
			expect( shaderErrors ).toEqual( [] );
		} );
	} );

	test( 'head following stays active throughout a complete twelve-second sip and blink cycle', async ( { page } ) => {
		test.setTimeout( 45_000 );
		await pauseAnimationClock( page );
		const shaderErrors = await openAnimatedHero( page );
		const canvas = page.locator( '.riverside-hero canvas' );
		const animationStart = Number( await canvas.getAttribute( 'data-animation-time' ) );
		let maximumHeadDrift = 0;
		await page.mouse.move( 959, 320 );
		await test.step( 'render and inspect every controlled frame of the full animation cycle', async () => {
			// Deliver bounded frame gaps through the real renderer and mixer, including on slow software GPUs.
			// Each step stays within the scene's 250 ms animation-delta cap; the first frame initializes its clock.
			for ( let frame = 0; frame < 52; frame++ ) {
				await page.clock.fastForward( 250 );
				const pose = await canvas.evaluate( ( element: HTMLCanvasElement ) => ( {
					head: Number( element.dataset.headYaw ),
					yaw: Number( element.dataset.yaw ),
				} ) );
				maximumHeadDrift = Math.max( maximumHeadDrift, Math.abs( pose.head - pose.yaw * 35 / 50 ) );
			}
		} );
		expect( Number( await canvas.getAttribute( 'data-animation-time' ) ) - animationStart ).toBeGreaterThan( 12 );
		expect( Number( await canvas.getAttribute( 'data-yaw' ) ) ).toBeGreaterThan( 0.84 );
		expect( Number( await canvas.getAttribute( 'data-head-yaw' ) ) ).toBeGreaterThan( 0.3 );
		expect( maximumHeadDrift ).toBeLessThan( 0.00001 );
		expect( shaderErrors ).toEqual( [] );
	} );

	test( 'pauses frame rendering offscreen and resumes on return', async ( { page } ) => {
		const shaderErrors = await openAnimatedHero( page );
		const canvas = page.locator( '.riverside-hero canvas' );
		await test.step( 'scrolling away stops frame rendering and returning resumes it', async () => {
			await page.locator( '.site-footer' ).scrollIntoViewIfNeeded();
			await expect( canvas ).toHaveAttribute( 'data-playing', 'false' );
			const stoppedFrame = await canvas.getAttribute( 'data-frame' );
			if ( stoppedFrame === null ) {
				throw new Error( 'The loaded scene must expose its rendered frame.' );
			}
			await page.evaluate( () => new Promise( ( resolve ) => {
				requestAnimationFrame( () => {
					requestAnimationFrame( resolve );
				} );
			} ) );
			await expect( canvas ).toHaveAttribute( 'data-frame', stoppedFrame );
			await page.evaluate( () => {
				window.scrollTo( { top: 0, behavior: 'instant' } );
			} );
			await expect( canvas ).toHaveAttribute( 'data-playing', 'true' );
			await expect.poll( async () => Number( await canvas.getAttribute( 'data-frame' ) ) ).toBeGreaterThan( Number( stoppedFrame ) );
		} );
		expect( shaderErrors ).toEqual( [] );
	} );

	test( 'releases and reloads the scene when the motion preference changes', async ( { page } ) => {
		const shaderErrors = await openAnimatedHero( page );
		const scene = page.locator( '.riverside-hero' );
		const canvas = scene.locator( 'canvas' );
		await test.step( 'a changed motion preference releases the animated scene', async () => {
			await page.emulateMedia( { reducedMotion: MotionPreference.REDUCE } );
			await expect( scene ).toHaveAttribute( 'data-status', 'poster' );
			await expect( canvas ).toHaveAttribute( 'data-playing', 'false' );
			await expect( canvas ).toHaveCSS( 'opacity', '0' );
			await expect( scene.locator( 'img' ) ).toBeVisible();
			await page.emulateMedia( { reducedMotion: MotionPreference.NO_PREFERENCE } );
			await expect( scene ).toHaveAttribute( 'data-status', 'ready' );
		} );
		expect( shaderErrors ).toEqual( [] );
	} );

	test( 'restores the poster and keeps downloads usable after native GPU context loss', async ( { page } ) => {
		const shaderErrors = await openAnimatedHero( page );
		const scene = page.locator( '.riverside-hero' );
		const canvas = scene.locator( 'canvas' );
		await test.step( 'native GPU context loss leaves artwork and downloads usable', async () => {
			const lost = await canvas.evaluate( ( element: HTMLCanvasElement ) => {
				const extension = element.getContext( 'webgl2' )?.getExtension( 'WEBGL_lose_context' );
				extension?.loseContext();
				return Boolean( extension );
			} );
			expect( lost ).toBe( true );
			await expect( scene ).toHaveAttribute( 'data-status', 'unavailable' );
			await expect( canvas ).toHaveAttribute( 'data-playing', 'false' );
			await expect( canvas ).toHaveCSS( 'opacity', '0' );
			await expect( scene.locator( 'img' ) ).toBeVisible();
			await expect( page.locator( '.hero [data-download-primary]' ) ).toBeVisible();
		} );
		expect( shaderErrors ).toEqual( [] );
	} );

	for ( const viewport of [
		{ width: 1440, height: 900 }, { width: 1280, height: 720 },
		{ width: 390, height: 844 }, { width: 320, height: 568 },
	] ) {
		for ( const javaScriptEnabled of [ true, false ] ) {
			test.describe( () => {
				test.use( { contextOptions: { viewport, javaScriptEnabled, reducedMotion: MotionPreference.REDUCE } } );

				test( `${ String( viewport.width ) } (${ javaScriptEnabled ? 'reduced motion' : 'no JavaScript' }): poster fills the viewport and following wave transition without loading a model`, async ( { page } ) => {
					const requests: string[] = [];
					page.on( 'request', ( request ) => requests.push( request.url() ) );
					await page.route( '**/*', serveAsset );
					await page.goto( 'http://website.test/' );
					if ( javaScriptEnabled ) {
						await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
					}
					await page.evaluate( () => document.fonts.ready );
					const poster = page.locator( '.riverside-hero img' );
					await poster.evaluate( ( element: HTMLImageElement ) => element.decode() );
					await expect( poster ).toBeVisible();
					await expect( poster ).toHaveAttribute( 'src', '/images/riverside-hero.webp' );
					await expect( page.locator( '.riverside-hero canvas' ) ).toHaveCSS( 'opacity', '0' );
					const hero = await page.locator( '.hero' ).boundingBox();
					const posterBounds = await poster.boundingBox();
					const canvasBounds = await page.locator( '.riverside-hero canvas' ).boundingBox();
					const transition = await page.locator( '.hero-shore-transition' ).boundingBox();
					const title = await page.getByRole( 'heading', { level: 1 } ).boundingBox();
					const action = page.locator( '.hero [data-download-primary]' );
					const actionBounds = await action.boundingBox();
					const explanation = await page.locator( '#how-it-works' ).boundingBox();
					if ( ! hero || ! posterBounds || ! canvasBounds || ! transition ||
						! title || ! actionBounds || ! explanation ) {
						throw new Error( 'The hero layers, transition, heading, download and explanation must all have layout.' );
					}
					expect( hero.width ).toBeCloseTo( viewport.width, 0 );
					expect( transition.height ).toBeGreaterThan( 0 );
					expect( transition.y ).toBeCloseTo( viewport.height, 0 );
					expect( transition.y + transition.height - ( hero.y + hero.height ) ).toBeCloseTo( 2, 0 );
					for ( const layer of [ posterBounds, canvasBounds ] ) {
						expect( layer.x ).toBeCloseTo( hero.x, 0 );
						expect( layer.y ).toBeCloseTo( hero.y, 0 );
						expect( layer.width ).toBeCloseTo( hero.width, 0 );
						expect( layer.height ).toBeCloseTo( hero.height, 0 );
					}
					expect( hero.y ).toBe( 0 );
					expect( title.y ).toBeGreaterThan( 0 );
					expect( title.y + title.height ).toBeLessThan( actionBounds.y );
					expect( actionBounds.y + actionBounds.height ).toBeLessThan( viewport.height * 0.65 );
					expect( Math.abs( title.x + title.width / 2 - viewport.width / 2 ) ).toBeLessThan( 1 );
					expect( explanation.y ).toBeGreaterThanOrEqual( hero.y + hero.height );
					await expect( action ).toHaveAttribute( 'href', /^https:\/\//u );
					await expect( page.locator( '#how-it-works, #features, #downloads' ) ).toHaveCount( 3 );
					expect( requests.some( ( url ) => /\.(?:glb|gltf)(?:\?|$)/u.test( url ) ) ).toBe( false );
					expect( await page.evaluate(
						() => document.documentElement.scrollWidth <= window.innerWidth,
					) ).toBe( true );
				} );
			} );
		}
	}

	test( 'a failed model request keeps the poster and a keyboard-accessible download', async ( { page } ) => {
		await page.route( '**/*', async ( route ) => {
			if ( /\.(?:glb|gltf)(?:\?|$)/u.test( route.request().url() ) ) {
				await route.abort();
			} else {
				await serveAsset( route );
			}
		} );
		await page.goto( 'http://website.test/' );
		await expect( page.locator( '.riverside-hero' ) ).toHaveAttribute( 'data-status', 'unavailable' );
		await expect( page.locator( '.riverside-hero img' ) ).toBeVisible();
		const download = page.locator( '.hero [data-download-primary]' );
		await download.focus();
		await expect( download ).toBeFocused();
		await expect( download ).toHaveAttribute( 'href', /^https:\/\//u );
	} );
} );
