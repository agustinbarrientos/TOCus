import { DefaultTimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import { describe, expect, it } from 'vitest';
import {
	ProtectedSiteRuleSchema,
	type ProtectedSiteRule,
} from '../../../../domains/protection/types/protected-site-rule';
import { getProtectedSiteGroupHost } from '../../../../domains/protection/utils/protected-site-rule-key';
import siteDisplayNameCatalogSource from '../site-display-name-catalog/catalog.json';
import productHostsSource from './product-hosts.json';
import { getWebsitePresentationGroupHost, resolveSiteDisplayIdentity } from './index';

const DEFAULT_SCOPE_ID = 'scope_default';
const PRODUCT_IDENTITIES = [
	[ 'mail.google.com', 'Gmail' ],
	[ 'drive.google.com', 'Google Drive' ],
	[ 'docs.google.com', 'Google Docs' ],
	[ 'sheets.google.com', 'Google Sheets' ],
	[ 'slides.google.com', 'Google Slides' ],
	[ 'calendar.google.com', 'Google Calendar' ],
	[ 'meet.google.com', 'Google Meet' ],
	[ 'chat.google.com', 'Google Chat' ],
	[ 'forms.google.com', 'Google Forms' ],
	[ 'keep.google.com', 'Google Keep' ],
	[ 'photos.google.com', 'Google Photos' ],
	[ 'maps.google.com', 'Google Maps' ],
	[ 'accounts.google.com', 'Google Account' ],
	[ 'gemini.google.com', 'Gemini' ],
	[ 'aistudio.google.com', 'Google AI Studio' ],
	[ 'notebook.google.com', 'Gemini Notebook' ],
	[ 'notebooklm.google.com', 'Gemini Notebook' ],
	[ 'music.apple.com', 'Apple Music' ],
	[ 'tv.apple.com', 'Apple TV' ],
	[ 'maps.apple.com', 'Apple Maps' ],
	[ 'podcasts.apple.com', 'Apple Podcasts' ],
	[ 'books.apple.com', 'Apple Books' ],
	[ 'teams.microsoft.com', 'Microsoft Teams' ],
	[ 'designer.microsoft.com', 'Microsoft Designer' ],
	[ 'portal.azure.com', 'Azure Portal' ],
	[ 'outlook.live.com', 'Outlook' ],
	[ 'express.adobe.com', 'Adobe Express' ],
	[ 'firefly.adobe.com', 'Adobe Firefly' ],
	[ 'stock.adobe.com', 'Adobe Stock' ],
	[ 'fonts.adobe.com', 'Adobe Fonts' ],
	[ 'music.amazon.com', 'Amazon Music' ],
	[ 'pharmacy.amazon.com', 'Amazon Pharmacy' ],
	[ 'luna.amazon.com', 'Amazon Luna' ],
	[ 'artists.spotify.com', 'Spotify for Artists' ],
	[ 'creators.spotify.com', 'Spotify for Creators' ],
	[ 'business.facebook.com', 'Meta Business Suite' ],
	[ 'adsmanager.facebook.com', 'Meta Ads Manager' ],
	[ 'gist.github.com', 'GitHub Gist' ],
	[ 'pages.github.com', 'GitHub Pages' ],
	[ 'radar.cloudflare.com', 'Cloudflare Radar' ],
	[ 'music.youtube.com', 'YouTube Music' ],
	[ 'tv.youtube.com', 'YouTube TV' ],
	[ 'play.geforcenow.com', 'GeForce NOW' ],
	[ 'store.epicgames.com', 'Epic Games Store' ],
	[ 'watch.plex.tv', 'Plex' ],
	[ 'play.nintendo.com', 'Play Nintendo' ],
	[ 'my.nintendo.com', 'My Nintendo' ],
	[ 'games.disney.com', 'Disney Games' ],
	[ 'movies.disney.com', 'Disney Movies' ],
	[ 'unite.pokemon.com', 'Pokemon UNITE' ],
	[ 'books.google.com', 'Google Books' ],
	[ 'play.google.com', 'Google Play' ],
	[ 'video.disney.com', 'Disney Video' ],
	[ 'shows.disney.com', 'Disney Shows' ],
	[ 'disneymusic.disney.com', 'Disney Music' ],
	[ 'liveshows.disney.com', 'Disney Live Shows' ],
] as const;

/**
 * Creates one protected-site rule for display-name resolver tests.
 * @param host - Canonical protection boundary.
 * @param includeSubdomains - Whether the rule owns descendant hosts.
 * @return Complete protected-site rule.
 * @since 1.0.0 Initial implementation.
 */
function createRule( host: string, includeSubdomains = true ): ProtectedSiteRule {
	return ProtectedSiteRuleSchema.parse( {
		host,
		includeSubdomains,
		scopeId: DEFAULT_SCOPE_ID,
	} );
}

describe( 'resolveSiteDisplayIdentity', () => {
	it.each( PRODUCT_IDENTITIES )( 'uses an explicit product name for %s', ( host, name ) => {
		const exactCatalogEntry = siteDisplayNameCatalogSource.find( ( entry ) => entry.domains.includes( host ) );

		expect( exactCatalogEntry?.name ).toBe( name );
		expect( resolveSiteDisplayIdentity( {
			identityHost: host,
			rule: createRule( getProtectedSiteGroupHost( host ) ),
		} ).name ).toBe( name );
	} );

	it.each( PRODUCT_IDENTITIES )( 'inherits the product name for descendants of %s', ( host, name ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: `editor.${ host }`,
			rule: createRule( getProtectedSiteGroupHost( host ) ),
		} ).name ).toBe( name );
	} );

	it.each( [ 'mail.google.com', 'editor.docs.google.com', 'notebooklm.google.com' ] )(
		'prefers a custom name over the product boundary for %s',
		( identityHost ) => {
			expect( resolveSiteDisplayIdentity( {
				identityHost,
				rule: createRule( 'google.com' ),
				displayNameOverride: '  My research  ',
			} ).name ).toBe( 'My research' );
		},
	);

	it( 'names a shared editor host independently of its protected path', () => {
		const rule = { ...createRule( 'docs.google.com' ), pathPrefix: '/spreadsheets/d/example' };

		expect( resolveSiteDisplayIdentity( {
			identityHost: 'docs.google.com',
			rule,
		} ).name ).toBe( 'Google Docs' );
		expect( rule.pathPrefix ).toBe( '/spreadsheets/d/example' );
	} );

	it( 'accepts complete timed sites without treating policy fields as display metadata', () => {
		const site = { identityHost: 'youtube.com', rule: createRule( 'youtube.com' ),
			timingConfiguration: DefaultTimingConfiguration };
		expect( resolveSiteDisplayIdentity( site ).name ).toBe( 'YouTube' );
	} );

	it.each( [
		[ 'x.com', 'X' ],
		[ 'twitter.com', 'X' ],
		[ 'chatgpt.com', 'ChatGPT' ],
		[ 'youtube.com', 'YouTube' ],
		[ 'github.com', 'GitHub' ],
		[ 'chess.com', 'Chess.com' ],
		[ 'uncannyowl.com', 'Uncanny Owl' ],
		[ 'automatorplugin.com', 'Uncanny Automator' ],
		[ 'wordpress.org', 'WordPress.org' ],
		[ 'wordpress.com', 'WordPress.com' ],
		[ 'crafter.run', 'Crafter Station' ],
		[ 'agustinbarrientos.com', 'Agustin Barrientos' ],
		[ 'daily.dev', 'Daily.dev' ],
		[ 'primevideo.com', 'Prime Video' ],
		[ 'hbomax.com', 'HBO Max' ],
		[ 'max.com', 'HBO Max' ],
		[ 'disneyplus.com', 'Disney+' ],
		[ 'paramountplus.com', 'Paramount+' ],
		[ 'peacocktv.com', 'Peacock' ],
		[ 'tubitv.com', 'Tubi' ],
		[ 'pluto.tv', 'Pluto TV' ],
		[ 'soundcloud.com', 'SoundCloud' ],
		[ 'tidal.com', 'TIDAL' ],
	] )( 'uses the exact local alias for %s', ( host, name ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: host,
			rule: createRule( host ),
		} ).name ).toBe( name );
	} );

	it.each( [
		[ 'crazygames.com', 'crazygames.com', 'CrazyGames' ],
		[ 'mail.google.com', 'google.com', 'Gmail' ],
		[ 'docs.google.com', 'google.com', 'Google Docs' ],
		[ 'news.ycombinator.com', 'ycombinator.com', 'Hacker News' ],
		[ 'old.reddit.com', 'reddit.com', 'Reddit' ],
		[ 'www.uncannyowl.com', 'uncannyowl.com', 'Uncanny Owl' ],
		[ 'www.automatorplugin.com', 'automatorplugin.com', 'Uncanny Automator' ],
		[ 'www.wordpress.org', 'wordpress.org', 'WordPress.org' ],
		[ 'www.wordpress.com', 'wordpress.com', 'WordPress.com' ],
		[ 'www.crafter.run', 'crafter.run', 'Crafter Station' ],
		[ 'www.agustinbarrientos.com', 'agustinbarrientos.com', 'Agustin Barrientos' ],
		[ 'app.daily.dev', 'daily.dev', 'Daily.dev' ],
		[ 'play.hbomax.com', 'hbomax.com', 'HBO Max' ],
		[ 'play.max.com', 'max.com', 'HBO Max' ],
		[ 'player.twitch.tv', 'twitch.tv', 'Twitch' ],
		[ 'tv.apple.com', 'apple.com', 'Apple TV' ],
		[ 'music.apple.com', 'apple.com', 'Apple Music' ],
		[ 'www.apple.com', 'apple.com', 'Apple' ],
		[ 'apps.apple.com', 'apple.com', 'App Store' ],
		[ 'listen.tidal.com', 'tidal.com', 'TIDAL' ],
	] )( 'uses the catalog identity %s for %s', ( identityHost, protectionHost, name ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost,
			rule: createRule( protectionHost ),
		} ).name ).toBe( name );
	} );

	it( 'derives a readable name when no exact alias exists', () => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'instagram.com',
			rule: createRule( 'instagram.com' ),
		} ).name ).toBe( 'Instagram' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'app.my-focus-space.example',
			rule: createRule( 'my-focus-space.example' ),
		} ).name ).toBe( 'My focus space' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'localhost',
			rule: createRule( 'localhost', false ),
		} ).name ).toBe( 'Localhost' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: '127.0.0.1',
			rule: createRule( '127.0.0.1', false ),
		} ).name ).toBe( '127.0.0.1' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'notx.com',
			rule: createRule( 'notx.com' ),
		} ).name ).toBe( 'Notx' );
	} );

	it( 'keeps an unknown internationalized host in its canonical form', () => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'xn--bcher-kva.de',
			rule: createRule( 'xn--bcher-kva.de' ),
		} ) ).toMatchObject( {
			name: 'xn--bcher-kva.de',
			monogram: 'X',
		} );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'xn--test-9k5y.com',
			rule: createRule( 'xn--test-9k5y.com' ),
		} ) ).toMatchObject( {
			name: 'xn--test-9k5y.com',
			monogram: 'X',
		} );
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'xn--pple-43d.example.com',
			rule: createRule( 'example.com' ),
		} ) ).toMatchObject( {
			name: 'xn--pple-43d.example.com',
			monogram: 'X',
		} );
	} );

	it.each( [
		[ 'x.com', 'X' ],
		[ 'daily.dev', 'Daily.dev' ],
		[ 'primevideo.com', 'Prime Video' ],
		[ 'hbomax.com', 'HBO Max' ],
		[ 'tv.apple.com', 'Apple TV' ],
		[ 'soundcloud.com', 'SoundCloud' ],
	] )( 'uses a trimmed editable name for %s and falls back when it is cleared', ( host, name ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: host,
			rule: createRule( host ),
			displayNameOverride: '  My social space  ',
		} ).name ).toBe( 'My social space' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: host,
			rule: createRule( host ),
			displayNameOverride: '   ',
		} ).name ).toBe( name );
	} );

	it.each( [
		'amazon.com',
		'amazon.co.uk',
		'amazon.de',
		'amazon.co.jp',
		'amazon.ca',
		'amazon.in',
		'amazon.com.mx',
	] )( 'keeps the shared retail identity for Prime Video on %s', ( host ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: host,
			rule: createRule( host ),
		} ).name ).toBe( 'Amazon' );
		expect( resolveSiteDisplayIdentity( {
			identityHost: `www.${ host }`,
			rule: createRule( host ),
		} ).name ).toBe( 'Amazon' );
	} );

	it.each( [
		[ '\u00c1nimo', '\u00c1' ],
		[ '\u042f\u043d\u0434\u0435\u043a\u0441', '\u042f' ],
		[ '\u30c1\u30e3\u30c3\u30c8', '\u30c1' ],
		[ '\ufb03nd', 'F' ],
		[ '...', '?' ],
	] )( 'creates the Unicode monogram %s for %s', ( name, monogram ) => {
		expect( resolveSiteDisplayIdentity( {
			identityHost: 'example.com',
			rule: createRule( 'example.com' ),
			displayNameOverride: name,
		} ).monogram ).toBe( monogram );
	} );

	it( 'returns a stable local identity without mutating its input', () => {
		const input = Object.freeze( {
			identityHost: 'subdomain.quiet-corner.example',
			rule: createRule( 'quiet-corner.example' ),
		} );
		const firstIdentity = resolveSiteDisplayIdentity( input );
		const secondIdentity = resolveSiteDisplayIdentity( input );

		expect( firstIdentity.name ).toBe( 'Quiet corner' );
		expect( firstIdentity.monogram ).toBe( 'Q' );
		expect( firstIdentity.colorIndex ).toBeGreaterThanOrEqual( 0 );
		expect( firstIdentity.colorIndex ).toBeLessThan( 6 );
		expect( secondIdentity ).toEqual( firstIdentity );
	} );

	it( 'rejects an identity host outside its protection boundary', () => {
		expect( () => resolveSiteDisplayIdentity( {
			identityHost: 'mail.google.com',
			rule: createRule( 'x.com' ),
		} ) ).toThrow();
	} );

	it( 'rejects a descendant identity owned by an exact-only rule', () => {
		expect( () => resolveSiteDisplayIdentity( {
			identityHost: 'sub.localhost',
			rule: createRule( 'localhost', false ),
		} ) ).toThrow();
	} );
} );

describe( 'getWebsitePresentationGroupHost', () => {
	it( 'limits the product boundaries to the documented hosts and legacy alias', () => {
		expect( productHostsSource.toSorted() ).toEqual( PRODUCT_IDENTITIES.map( ( [ host ] ) => host ).toSorted() );
	} );

	it( 'keeps every curated product host as its own presentation group', () => {
		for ( const [ host ] of PRODUCT_IDENTITIES ) {
			expect( getWebsitePresentationGroupHost( host ) ).toBe( host );
		}
	} );

	it( 'groups descendants at the most specific curated product host', () => {
		for ( const [ host ] of PRODUCT_IDENTITIES ) {
			expect( getWebsitePresentationGroupHost( `editor.preview.${ host }` ) ).toBe( host );
		}
	} );

	it( 'keeps legacy aliases as distinct host groups despite their shared name', () => {
		expect( getWebsitePresentationGroupHost( 'notebook.google.com' ) ).toBe( 'notebook.google.com' );
		expect( getWebsitePresentationGroupHost( 'notebooklm.google.com' ) ).toBe( 'notebooklm.google.com' );
	} );

	it.each( [
		[ 'google.com', 'google.com' ],
		[ 'www.google.com', 'google.com' ],
		[ 'unknown.google.com', 'google.com' ],
		[ 'notmail.google.com', 'google.com' ],
		[ 'mail.google.com.evil.com', 'evil.com' ],
		[ 'mail.google.com.evil.co.uk', 'evil.co.uk' ],
		[ 'studio.youtube.com', 'youtube.com' ],
		[ 'drive.usercontent.google.com', 'google.com' ],
		[ 'remotedesktop.google.com', 'google.com' ],
		[ 'www.apple.com', 'apple.com' ],
		[ 'chat.openai.com', 'openai.com' ],
		[ 'blog.example.com', 'example.com' ],
		[ 'tenant.github.io', 'tenant.github.io' ],
		[ 'localhost', 'localhost' ],
		[ 'sub.localhost', 'sub.localhost' ],
		[ '127.0.0.1', '127.0.0.1' ],
	] )( 'uses ordinary domain grouping for %s', ( host, groupHost ) => {
		expect( getWebsitePresentationGroupHost( host ) ).toBe( groupHost );
	} );

	it( 'does not change protection grouping for product hosts', () => {
		expect( getProtectedSiteGroupHost( 'docs.google.com' ) ).toBe( 'google.com' );
		expect( getProtectedSiteGroupHost( 'music.youtube.com' ) ).toBe( 'youtube.com' );
	} );
} );
