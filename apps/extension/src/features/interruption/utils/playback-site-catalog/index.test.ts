import { describe, expect, it } from 'vitest';
import { isPlaybackSite } from '.';

describe( 'Playback site catalog', () => {
	it.each( [
		'https://youtube.com/watch?v=one',
		'https://music.youtube.com/watch?v=one',
		'https://netflix.com/watch/one',
		'https://www.netflix.com/watch/one',
		'https://twitch.tv/channel',
		'https://player.twitch.tv/?channel=one',
		'https://clips.twitch.tv/one',
		'https://hbomax.com/',
		'https://play.hbomax.com/video/watch/one',
		'https://play.max.com/video/watch/one',
		'https://primevideo.com/detail/one',
		'https://www.primevideo.com/region/eu/detail/one',
		'https://disneyplus.com/play/one',
		'https://www.disneyplus.com/en-gb/play/one',
		'https://WWW.NETFLIX.COM/watch/one',
		'http://www.youtube.com/watch?v=one',
	] )( 'allows local video control on %s', ( href ) => {
		expect( isPlaybackSite( new URL( href ) ) ).toBe( true );
	} );

	it.each( [
		'amazon.com',
		'amazon.co.uk',
		'amazon.de',
		'amazon.co.jp',
		'amazon.ca',
		'amazon.in',
		'amazon.com.mx',
	] )( 'limits %s to its Prime Video routes', ( hostname ) => {
		expect( isPlaybackSite( new URL( `https://${ hostname }/gp/video` ) ) ).toBe( true );
		expect( isPlaybackSite( new URL( `https://www.${ hostname }/gp/video/detail/one` ) ) ).toBe( true );
		expect( isPlaybackSite( new URL( `https://www.${ hostname }/dp/one` ) ) ).toBe( false );
		expect( isPlaybackSite( new URL( `https://www.${ hostname }/gp/videos` ) ) ).toBe( false );
	} );

	it.each( [
		'https://youtube.com.evil.test/watch',
		'https://notnetflix.com/watch',
		'https://netflix.com.evil.test/watch',
		'https://twitch.tv.evil.test/channel',
		'https://hbomax.com.evil.test/video',
		'https://max.com.evil.test/video',
		'https://primevideo.com.evil.test/detail',
		'https://disneyplus.com.evil.test/play',
		'https://notyoutube.com/watch',
		'https://twitch.com/channel',
		'https://disney.com/video',
		'https://amazon.com.evil.test/gp/video/one',
		'https://amazon.evil.test/gp/video/one',
		'https://www.amazon.com/',
		'https://www.amazon.com/gp/video-player/one',
		'https://www.amazon.com/gp/product/one?next=/gp/video/one',
		'https://www.amazon.com/dp/one#gp/video',
		'https://www.amazon.com/GP/VIDEO/one',
		'https://example.com/?next=https://netflix.com',
		'https://netflix.com@example.com/watch',
		'ftp://netflix.com/watch/one',
		'file://netflix.com/watch/one',
	] )( 'does not control unrelated media on %s', ( href ) => {
		expect( isPlaybackSite( new URL( href ) ) ).toBe( false );
	} );
} );
