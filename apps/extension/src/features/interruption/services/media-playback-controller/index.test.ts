import { describe, expect, it, vi } from 'vitest';
import { createMediaPlaybackController } from '.';

/**
 * Creates a native media boundary with mutable playback state for unit scenarios.
 * @return Video boundary and observable browser operations.
 * @since 0.1.0 Initial implementation.
 */
function createMedia() {
	const media = {
		currentSrc: 'blob:video-one',
		ended: false,
		isConnected: true,
		paused: false,
		src: 'blob:video-one',
		srcObject: null,
		pause: vi.fn( () => {
			media.paused = true;
		} ),
		play: vi.fn( () => {
			media.paused = false;
			return Promise.resolve();
		} ),
	};
	return media;
}

/**
 * Creates the document event boundary for one controller.
 * @param hostname - Current document hostname.
 * @param pathname - Current document path.
 * @return Mutable document, media, and playback lifecycle.
 * @since 0.1.0 Initial implementation.
 */
function createHarness( hostname = 'www.youtube.com', pathname = '/watch?v=one' ) {
	const media = createMedia();
	const videos = [ media ];
	const events = new EventTarget();
	const location = { hostname, href: `https://${ hostname }${ pathname }` };
	const controller = createMediaPlaybackController( {
		document: {
			addEventListener: events.addEventListener.bind( events ),
			removeEventListener: events.removeEventListener.bind( events ),
			querySelectorAll: vi.fn( () => videos ),
		} as unknown as Document,
		location,
	} );
	return { controller, events, location, media, videos };
}

describe( 'Media playback controller', () => {
	it.each( [
		[ 'www.netflix.com', '/watch/one' ],
		[ 'www.twitch.tv', '/channel' ],
		[ 'play.hbomax.com', '/video/watch/one' ],
		[ 'play.max.com', '/video/watch/one' ],
		[ 'www.primevideo.com', '/detail/one' ],
		[ 'www.amazon.com', '/gp/video/detail/one' ],
		[ 'www.disneyplus.com', '/play/one' ],
	] )( 'holds and restores previously playing video on %s%s', async ( hostname, pathname ) => {
		const { controller, media } = createHarness( hostname, pathname );
		controller.pause();
		expect( media.paused ).toBe( true );
		await controller.resume();
		expect( media.paused ).toBe( false );
	} );

	it( 'pauses once and restores prior playback once despite repeated lifecycle messages', async () => {
		const { controller, media } = createHarness();
		controller.pause();
		controller.pause();
		expect( media.pause ).toHaveBeenCalledTimes( 1 );
		await controller.resume();
		await controller.resume();
		expect( media.play ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [ 'youtube.com', 'm.youtube.com', 'music.youtube.com' ] )( 'holds media on %s', ( hostname ) => {
		const { controller, media } = createHarness( hostname );
		controller.pause();
		expect( media.paused ).toBe( true );
		controller.stop();
	} );

	it.each( [ 'youtube.com.evil.test', 'notyoutube.com', 'example.com' ] )( 'ignores media on %s', async ( hostname ) => {
		const { controller, media } = createHarness( hostname );
		controller.pause();
		await controller.resume();
		expect( media.pause ).not.toHaveBeenCalled();
		expect( media.play ).not.toHaveBeenCalled();
	} );

	it.each( [ 'paused', 'ended' ] as const )( 'does not autoplay originally %s media after later playback attempts', async ( property ) => {
		const { controller, events, media } = createHarness();
		media[ property ] = true;
		controller.pause();
		media.paused = false;
		media.ended = false;
		events.dispatchEvent( new Event( 'play' ) );
		expect( media.paused ).toBe( true );
		await controller.resume();
		expect( media.play ).not.toHaveBeenCalled();
	} );

	it( 'holds new video attempts without granting them resume ownership', async () => {
		const { controller, events, media, videos } = createHarness();
		controller.pause();
		const replacement = createMedia();
		videos.push( replacement );
		media.paused = false;
		events.dispatchEvent( new Event( 'play' ) );
		expect( media.paused ).toBe( true );
		expect( replacement.paused ).toBe( true );
		await controller.resume();
		expect( media.play ).toHaveBeenCalledOnce();
		expect( replacement.play ).not.toHaveBeenCalled();
	} );

	it( 'does not hold retail videos after leaving an Amazon Prime Video route', async () => {
		const { controller, events, location, media } = createHarness( 'www.amazon.com', '/gp/video/detail/one' );
		controller.pause();
		location.href = 'https://www.amazon.com/dp/product-one';
		media.paused = false;
		events.dispatchEvent( new Event( 'play' ) );
		expect( media.paused ).toBe( false );
		await controller.resume();
		expect( media.play ).not.toHaveBeenCalled();
	} );

	it.each( [ 'currentSrc', 'src', 'srcObject', 'isConnected', 'ended', 'href' ] )( 'does not restore media after its %s changes', async ( property ) => {
		const { controller, location, media } = createHarness();
		controller.pause();
		if ( property === 'href' ) {
			location.href = 'https://www.youtube.com/watch?v=two';
		} else {
			Object.assign( media, { [ property ]: property === 'isConnected' ? false : true } );
		}
		await controller.resume();
		expect( media.play ).not.toHaveBeenCalled();
	} );

	it( 'releases ownership and listeners permanently on stop without autoplay', async () => {
		const { controller, events, media } = createHarness();
		controller.pause();
		controller.stop();
		controller.stop();
		media.paused = false;
		events.dispatchEvent( new Event( 'play' ) );
		controller.pause();
		await controller.resume();
		expect( media.paused ).toBe( false );
		expect( media.play ).not.toHaveBeenCalled();
	} );

	it( 'settles rejected playback without retrying', async () => {
		const { controller, media } = createHarness();
		media.play.mockRejectedValue( new Error( 'Playback denied' ) );
		controller.pause();
		await expect( controller.resume() ).resolves.toBeUndefined();
		await controller.resume();
		expect( media.play ).toHaveBeenCalledOnce();
	} );

	it( 'captures a fresh ownership snapshot on the next interruption', async () => {
		const { controller, media } = createHarness();
		controller.pause();
		await controller.resume();
		media.paused = true;
		controller.pause();
		await controller.resume();
		expect( media.play ).toHaveBeenCalledOnce();
	} );
} );
