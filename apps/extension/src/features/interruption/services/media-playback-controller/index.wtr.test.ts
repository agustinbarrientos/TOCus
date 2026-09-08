import { assert } from '@esm-bundle/chai';
import { createMediaPlaybackController, type MediaPlaybackController } from '.';

/**
 * Waits for one native media event without a renderer or custom-element fixture library.
 * @param target - Native media element being exercised.
 * @param name - Browser event expected by the scenario.
 * @return The first matching event.
 */
function oneEvent( target: EventTarget, name: string ): Promise<Event> {
	return new Promise( ( resolve ) => {
		target.addEventListener( name, resolve, { once: true } );
	} );
}

/**
 * Native media elements released after each browser scenario.
 * @since 0.1.0 Initial implementation.
 */
const videos: HTMLVideoElement[] = [];
/**
 * In-memory media tracks released after each browser scenario.
 * @since 0.1.0 Initial implementation.
 */
const streams: MediaStream[] = [];
/**
 * Document playback lifecycles released after each browser scenario.
 * @since 0.1.0 Initial implementation.
 */
const controllers: MediaPlaybackController[] = [];
/**
 * Streaming page URLs exercised with native browser playback.
 * @since 0.1.0 Initial implementation.
 */
const SUPPORTED_PLAYBACK_URLS = [
	'https://netflix.com/watch/one',
	'https://twitch.tv/example',
	'https://hbomax.com/video/watch/one',
	'https://max.com/video/watch/one',
	'https://primevideo.com/detail/one',
	'https://amazon.com/gp/video/detail/one',
	'https://disneyplus.com/video/one',
] as const;

/**
 * Creates playable video without external media or network requests.
 * @return A connected, initially paused native video element.
 * @since 0.1.0 Initial implementation.
 */
function createVideo(): HTMLVideoElement {
	const canvas = document.createElement( 'canvas' );
	canvas.width = 2;
	canvas.height = 2;
	canvas.getContext( '2d' )?.fillRect( 0, 0, 2, 2 );
	const stream = canvas.captureStream();
	const video = document.createElement( 'video' );
	video.muted = true;
	video.srcObject = stream;
	document.body.append( video );
	streams.push( stream );
	videos.push( video );
	return video;
}

/**
 * Creates a playback lifecycle on the real browser document.
 * @param href - Page URL represented by this browser scenario.
 * @return Playback lifecycle and mutable navigation location.
 * @since 0.1.0 Initial implementation.
 */
function createController( href = 'https://www.youtube.com/watch?v=one' ) {
	const location = { hostname: new URL( href ).hostname, href };
	const controller = createMediaPlaybackController( { document, location } );
	controllers.push( controller );
	return { controller, location };
}

describe( 'Native video playback lifecycle', () => {
	afterEach( () => {
		controllers.splice( 0 ).forEach( ( controller ) => {
			controller.stop();
		} );
		videos.splice( 0 ).forEach( ( video ) => {
			video.pause();
			video.srcObject = null;
			video.remove();
		} );
		streams.splice( 0 ).forEach( ( stream ) => {
			stream.getTracks().forEach( ( track ) => {
				track.stop();
			} );
		} );
	} );

	it( 'pauses live native playback and resumes the same video only once', async () => {
		const video = createVideo();
		await video.play();
		const { controller } = createController();
		controller.pause();
		controller.pause();
		assert.equal( video.paused, true );
		await controller.resume();
		assert.equal( video.paused, false );
		video.pause();
		await controller.resume();
		assert.equal( video.paused, true );
	} );

	it( 'captures non-bubbling play attempts and restores only previously playing video', async () => {
		const playing = createVideo();
		const paused = createVideo();
		await playing.play();
		const { controller } = createController();
		controller.pause();
		const pausedAgain = oneEvent( paused, 'pause' );
		const attempt = paused.play();
		await Promise.allSettled( [ attempt, pausedAgain ] );
		assert.equal( paused.paused, true );
		await controller.resume();
		assert.equal( playing.paused, false );
		assert.equal( paused.paused, true );
	} );

	it( 'holds videos inserted after entry without automatically starting them on Continue', async () => {
		const { controller } = createController();
		controller.pause();
		const video = createVideo();
		const pausedAgain = oneEvent( video, 'pause' );
		await Promise.allSettled( [ video.play(), pausedAgain ] );
		assert.equal( video.paused, true );
		await controller.resume();
		assert.equal( video.paused, true );
	} );

	it( 'releases capture listeners on stop and never restores stopped ownership', async () => {
		const video = createVideo();
		await video.play();
		const { controller } = createController();
		controller.pause();
		controller.stop();
		controller.stop();
		await controller.resume();
		assert.equal( video.paused, true );
		await video.play();
		controller.pause();
		assert.equal( video.paused, false );
	} );

	it( 'does not resume the previous video after SPA navigation', async () => {
		const video = createVideo();
		await video.play();
		const { controller, location } = createController();
		controller.pause();
		location.href = 'https://www.youtube.com/watch?v=two';
		await controller.resume();
		assert.equal( video.paused, true );
	} );

	it( 'does not resume a detached original video or its replacement', async () => {
		const video = createVideo();
		await video.play();
		const { controller } = createController();
		controller.pause();
		video.remove();
		const replacement = createVideo();
		await controller.resume();
		assert.equal( video.paused, true );
		assert.equal( replacement.paused, true );
	} );

	it( 'does not resume a video whose native media stream was replaced', async () => {
		const video = createVideo();
		await video.play();
		const { controller } = createController();
		controller.pause();
		video.srcObject = createVideo().srcObject;
		await controller.resume();
		assert.equal( video.paused, true );
	} );

	for ( const href of SUPPORTED_PLAYBACK_URLS ) {
		it( `pauses and restores only previously playing native video at ${ href }`, async () => {
			const playing = createVideo();
			const paused = createVideo();
			await playing.play();
			const { controller } = createController( href );
			controller.pause();
			assert.equal( playing.paused, true );
			assert.equal( paused.paused, true );
			await controller.resume();
			assert.equal( playing.paused, false );
			assert.equal( paused.paused, true );
		} );
	}

	it( 'captures native Twitch play attempts while held and leaves previously paused video paused', async () => {
		const playing = createVideo();
		const paused = createVideo();
		await playing.play();
		const { controller } = createController( 'https://www.twitch.tv/example' );
		controller.pause();
		assert.equal( playing.paused, true );
		const pausedAgain = oneEvent( paused, 'pause' );
		await Promise.allSettled( [ paused.play(), pausedAgain ] );
		assert.equal( paused.paused, true );
		await controller.resume();
		assert.equal( playing.paused, false );
		assert.equal( paused.paused, true );
	} );

	it( 'allows native playback after Amazon navigation leaves the video area during a hold', async () => {
		const video = createVideo();
		await video.play();
		const { controller, location } = createController( 'https://www.amazon.com/gp/video/detail/one' );
		controller.pause();
		assert.equal( video.paused, true );
		location.href = 'https://www.amazon.com/dp/one';
		await video.play();
		assert.equal( video.paused, false );
		video.pause();
		await controller.resume();
		assert.equal( video.paused, true );
	} );

	for ( const href of [
		'https://amazon.com/dp/one',
		'https://amazon.com/gp/videos/one',
		'https://amazon.com/gp/video-game/one',
		'https://netflix.com.evil.test/watch/one',
		'https://twitch.tv.evil.test/example',
		'https://hbomax.com.evil.test/video/watch/one',
		'https://max.com.evil.test/video/watch/one',
		'https://primevideo.com.evil.test/detail/one',
		'https://amazon.com.evil.test/gp/video/detail/one',
		'https://disneyplus.com.evil.test/video/one',
	] ) {
		it( `leaves native playback alone outside the streaming scope at ${ href }`, async () => {
			const video = createVideo();
			await video.play();
			const { controller } = createController( href );
			controller.pause();
			assert.equal( video.paused, false );
			await controller.resume();
			assert.equal( video.paused, false );
		} );
	}

	for ( const hostname of [ 'youtube.com', 'music.youtube.com', 'youtube.com.evil.test' ] ) {
		it( `restricts native media control at the ${ hostname } domain boundary`, async () => {
			const video = createVideo();
			await video.play();
			const { controller } = createController( `https://${ hostname }/watch?v=one` );
			controller.pause();
			assert.equal( video.paused, hostname !== 'youtube.com.evil.test' );
			await controller.resume();
			assert.equal( video.paused, false );
		} );
	}
} );
