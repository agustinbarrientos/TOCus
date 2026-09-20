import { describe, expect, it } from 'vitest';
import siteDisplayNameCatalogSource from './catalog.json';
import { compileSiteDisplayNameCatalog } from './index';

describe( 'bundled site display-name catalog', () => {
	const catalog = compileSiteDisplayNameCatalog( siteDisplayNameCatalogSource );

	it.each( [
		[ 'daily.dev', 'Daily.dev' ],
		[ 'www.daily.dev', 'Daily.dev' ],
		[ 'app.daily.dev', 'Daily.dev' ],
		[ 'youtube.com', 'YouTube' ],
		[ 'www.youtube.com', 'YouTube' ],
		[ 'm.youtube.com', 'YouTube' ],
		[ 'music.youtube.com', 'YouTube' ],
		[ 'youtu.be', 'YouTube' ],
		[ 'studio.youtube.com', 'YouTube Studio' ],
		[ 'netflix.com', 'Netflix' ],
		[ 'www.netflix.com', 'Netflix' ],
		[ 'twitch.tv', 'Twitch' ],
		[ 'www.twitch.tv', 'Twitch' ],
		[ 'player.twitch.tv', 'Twitch' ],
		[ 'clips.twitch.tv', 'Twitch' ],
		[ 'hbomax.com', 'HBO Max' ],
		[ 'www.hbomax.com', 'HBO Max' ],
		[ 'play.hbomax.com', 'HBO Max' ],
		[ 'max.com', 'HBO Max' ],
		[ 'www.max.com', 'HBO Max' ],
		[ 'play.max.com', 'HBO Max' ],
		[ 'primevideo.com', 'Prime Video' ],
		[ 'www.primevideo.com', 'Prime Video' ],
		[ 'disneyplus.com', 'Disney+' ],
		[ 'www.disneyplus.com', 'Disney+' ],
		[ 'dailymotion.com', 'Dailymotion' ],
		[ 'www.dailymotion.com', 'Dailymotion' ],
		[ 'paramountplus.com', 'Paramount+' ],
		[ 'www.paramountplus.com', 'Paramount+' ],
		[ 'spotify.com', 'Spotify' ],
		[ 'www.spotify.com', 'Spotify' ],
		[ 'open.spotify.com', 'Spotify' ],
		[ 'accounts.spotify.com', 'Spotify' ],
		[ 'hulu.com', 'Hulu' ],
		[ 'www.hulu.com', 'Hulu' ],
		[ 'crunchyroll.com', 'Crunchyroll' ],
		[ 'www.crunchyroll.com', 'Crunchyroll' ],
		[ 'peacocktv.com', 'Peacock' ],
		[ 'www.peacocktv.com', 'Peacock' ],
		[ 'vimeo.com', 'Vimeo' ],
		[ 'www.vimeo.com', 'Vimeo' ],
		[ 'player.vimeo.com', 'Vimeo' ],
		[ 'tv.apple.com', 'Apple TV' ],
		[ 'music.apple.com', 'Apple Music' ],
		[ 'plex.tv', 'Plex' ],
		[ 'www.plex.tv', 'Plex' ],
		[ 'watch.plex.tv', 'Plex' ],
		[ 'app.plex.tv', 'Plex' ],
		[ 'tubitv.com', 'Tubi' ],
		[ 'www.tubitv.com', 'Tubi' ],
		[ 'tubi.tv', 'Tubi' ],
		[ 'www.tubi.tv', 'Tubi' ],
		[ 'pluto.tv', 'Pluto TV' ],
		[ 'www.pluto.tv', 'Pluto TV' ],
		[ 'soundcloud.com', 'SoundCloud' ],
		[ 'www.soundcloud.com', 'SoundCloud' ],
		[ 'w.soundcloud.com', 'SoundCloud' ],
		[ 'deezer.com', 'Deezer' ],
		[ 'www.deezer.com', 'Deezer' ],
		[ 'tidal.com', 'TIDAL' ],
		[ 'www.tidal.com', 'TIDAL' ],
		[ 'listen.tidal.com', 'TIDAL' ],
	] )( 'resolves the published site identity for %s', ( host, name ) => {
		expect( catalog.resolve( host ) ).toBe( name );
	} );

	it.each( [
		'notdaily.dev',
		'daily.dev.evil.test',
		'nothbomax.com',
		'hbomax.com.evil.test',
		'max.com.evil.test',
		'notprimevideo.com',
		'primevideo.com.evil.test',
		'twitch.tv.evil.test',
		'notpeacocktv.com',
		'pluto.tv.evil.test',
		'player.vimeo.com.evil.test',
		'tv.apple.com.evil.test',
		'music.apple.com.evil.test',
		'notsoundcloud.com',
	] )( 'leaves unrelated lookalike host %s unnamed', ( host ) => {
		expect( catalog.resolve( host ) ).toBeUndefined();
	} );
} );

describe( 'compileSiteDisplayNameCatalog', () => {
	it( 'prefers exact names and then the most-specific wildcard parent', () => {
		const catalog = compileSiteDisplayNameCatalog( [
			{
				name: 'Example',
				domains: [ 'example.com', '*.example.com' ],
			},
			{
				name: 'Example Mail',
				domains: [ 'mail.example.com', '*.mail.example.com' ],
			},
			{
				name: 'Example Inbox',
				domains: [ 'inbox.mail.example.com' ],
			},
		] );

		expect( catalog.resolve( 'inbox.mail.example.com' ) ).toBe( 'Example Inbox' );
		expect( catalog.resolve( 'archive.mail.example.com' ) ).toBe( 'Example Mail' );
		expect( catalog.resolve( 'news.example.com' ) ).toBe( 'Example' );
	} );

	it( 'matches wildcard patterns only across descendant label boundaries', () => {
		const catalog = compileSiteDisplayNameCatalog( [
			{
				name: 'Example',
				domains: [ '*.example.com' ],
			},
		] );

		expect( catalog.resolve( 'example.com' ) ).toBeUndefined();
		expect( catalog.resolve( 'notexample.com' ) ).toBeUndefined();
		expect( catalog.resolve( 'www.example.com' ) ).toBe( 'Example' );
	} );

	it.each( [
		'https://example.com',
		'example.com/path',
		'example.com:443',
		'Example.com',
		'example.com.',
		'*example.com',
		'foo.*.example.com',
		'*.com',
		'*.github.io',
		'*.127.0.0.1',
		'*.localhost',
	] )( 'rejects the unsafe or noncanonical domain pattern %s', ( domain ) => {
		expect( () => compileSiteDisplayNameCatalog( [
			{
				name: 'Example',
				domains: [ domain ],
			},
		] ) ).toThrow();
	} );

	it.each( [
		{
			source: [
				{ name: 'Example', domains: [ 'example.com' ] },
				{ name: 'Other', domains: [ 'example.com' ] },
			],
		},
		{
			source: [
				{ name: 'Example', domains: [ 'example.com', 'example.com' ] },
			],
		},
		{
			source: [
				{ name: 'Example', domains: [ 'example.com' ] },
				{ name: 'Example', domains: [ 'example.net' ] },
			],
		},
	] )( 'rejects duplicate patterns and split name groups', ( { source } ) => {
		expect( () => compileSiteDisplayNameCatalog( source ) ).toThrow();
	} );

	it.each( [
		{ source: [] },
		{ source: [ { name: '', domains: [ 'example.com' ] } ] },
		{ source: [ { name: ' Example', domains: [ 'example.com' ] } ] },
		{ source: [ { name: 'Example', domains: [] } ] },
		{ source: [ { name: 'Example', domains: [ 'example.com' ], extra: true } ] },
	] )( 'rejects the malformed catalog source $source', ( { source } ) => {
		expect( () => compileSiteDisplayNameCatalog( source ) ).toThrow();
	} );
} );
