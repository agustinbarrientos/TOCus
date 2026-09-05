import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	ProtectedSiteCanonicalizationStatus,
	canonicalizeProtectedSite,
} from '../../../../domains/protection/utils/protected-site-canonicalizer';
import { OnboardingSiteSuggestions } from './index';

const ExpectedSuggestions = [
	{ id: 'youtube', displayName: 'YouTube', siteInput: 'www.youtube.com', ruleHost: 'youtube.com' },
	{ id: 'reddit', displayName: 'Reddit', siteInput: 'www.reddit.com', ruleHost: 'reddit.com' },
	{ id: 'x', displayName: 'X', siteInput: 'x.com', ruleHost: 'x.com' },
	{ id: 'instagram', displayName: 'Instagram', siteInput: 'www.instagram.com', ruleHost: 'instagram.com' },
	{ id: 'facebook', displayName: 'Facebook', siteInput: 'www.facebook.com', ruleHost: 'facebook.com' },
	{ id: 'tiktok', displayName: 'TikTok', siteInput: 'www.tiktok.com', ruleHost: 'tiktok.com' },
	{ id: 'netflix', displayName: 'Netflix', siteInput: 'www.netflix.com', ruleHost: 'netflix.com' },
	{ id: 'twitch', displayName: 'Twitch', siteInput: 'www.twitch.tv', ruleHost: 'twitch.tv' },
	{ id: 'discord', displayName: 'Discord', siteInput: 'discord.com', ruleHost: 'discord.com' },
	{ id: 'whatsapp', displayName: 'WhatsApp', siteInput: 'web.whatsapp.com', ruleHost: 'whatsapp.com' },
	{ id: 'pinterest', displayName: 'Pinterest', siteInput: 'www.pinterest.com', ruleHost: 'pinterest.com' },
	{ id: 'linkedin', displayName: 'LinkedIn', siteInput: 'www.linkedin.com', ruleHost: 'linkedin.com' },
	{ id: 'spotify', displayName: 'Spotify', siteInput: 'open.spotify.com', ruleHost: 'spotify.com' },
	{ id: 'chess', displayName: 'Chess.com', siteInput: 'www.chess.com', ruleHost: 'chess.com' },
	{ id: 'threads', displayName: 'Threads', siteInput: 'www.threads.com', ruleHost: 'threads.com' },
] as const;

describe( 'OnboardingSiteSuggestions', () => {
	it( 'keeps the approved sites in their fixed product order', () => {
		expect( OnboardingSiteSuggestions.map( ( suggestion ) => ( {
			id: suggestion.id,
			displayName: suggestion.displayName,
			siteInput: suggestion.siteInput,
			ruleHost: suggestion.ruleHost,
		} ) ) ).toEqual( ExpectedSuggestions );
	} );

	it( 'uses unique stable identifiers, site inputs, and local icon assets', () => {
		const ids = OnboardingSiteSuggestions.map( ( suggestion ) => suggestion.id );
		const siteInputs = OnboardingSiteSuggestions.map( ( suggestion ) => suggestion.siteInput );
		const ruleHosts = OnboardingSiteSuggestions.map( ( suggestion ) => suggestion.ruleHost );
		const iconUrls = OnboardingSiteSuggestions.map( ( suggestion ) => suggestion.iconUrl );

		expect( new Set( ids ).size ).toBe( OnboardingSiteSuggestions.length );
		expect( new Set( siteInputs ).size ).toBe( OnboardingSiteSuggestions.length );
		expect( new Set( ruleHosts ).size ).toBe( OnboardingSiteSuggestions.length );
		expect( new Set( iconUrls ).size ).toBe( OnboardingSiteSuggestions.length );
		expect( iconUrls.every( ( iconUrl ) => ! /^https?:\/\//u.test( iconUrl ) ) ).toBe( true );
		expect( iconUrls.every( ( iconUrl ) => iconUrl.includes( '/assets/site-icons/site-' ) ) ).toBe( true );
		expect( Object.isFrozen( OnboardingSiteSuggestions ) ).toBe( true );
		expect( OnboardingSiteSuggestions.every( ( suggestion ) => Object.isFrozen( suggestion ) ) ).toBe( true );
	} );

	it.each( ExpectedSuggestions )( 'canonicalizes $displayName to the shared $ruleHost rule', ( suggestion ) => {
		const result = canonicalizeProtectedSite( suggestion.siteInput, DefaultProtectionScopeId );

		expect( result.status ).toBe( ProtectedSiteCanonicalizationStatus.ACCEPTED );

		if ( result.status !== ProtectedSiteCanonicalizationStatus.ACCEPTED ) {
			return;
		}

		expect( result.identityHost ).toBe( suggestion.siteInput );
		expect( result.rule ).toEqual( {
			host: suggestion.ruleHost,
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		} );
	} );

	it( 'contains only the approved self-contained SVG files', async () => {
		const iconDirectory = new URL( '../../assets/site-icons/', import.meta.url );
		const filenames = ( await readdir( iconDirectory ) ).sort();
		const expectedFilenames = ExpectedSuggestions.map( ( suggestion ) => `site-${ suggestion.id }.svg` ).sort();

		expect( filenames ).toEqual( expectedFilenames );

		for ( const filename of filenames ) {
			const source = await readFile( fileURLToPath( new URL( filename, iconDirectory ) ), 'utf8' );

			expect( source ).toContain( '<svg' );
			expect( source ).not.toMatch( /<(?:foreignObject|image|script)\b/iu );
			expect( source ).not.toMatch( /(?:href|src)=["'](?:https?:|\/\/)/iu );
			expect( source ).not.toMatch( /url\(["']?(?:https?:|\/\/)/iu );
		}
	} );
} );
