import { describe, expect, it } from 'vitest';
import { ProtectedUrlMatchStatus } from '../../types/protected-url-match';
import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../types/protection-value';
import { matchProtectedUrl } from '../protected-url-matcher';
import { expandProtectedSiteAdditions } from './index';

const ROOT: ProtectedSiteConfiguration = { identityHost: 'youtube.com',
	rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
const STUDIO: ProtectedSiteConfiguration = { identityHost: 'studio.youtube.com',
	rule: { host: 'studio.youtube.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId, behavior: 'allow' } };

describe( 'expandProtectedSiteAdditions', () => {
	it.each( [ 'existing', 'batch' ] )( 'preserves the effective policy of a broad Studio path from %s rules', ( source ) => {
		const path = { ...STUDIO, rule: { ...STUDIO.rule, includeSubdomains: true,
			pathPrefix: '/channel', behavior: 'pause' as const } };
		const existing = source === 'existing' ? [ path ] : [];
		const additions = source === 'batch' ? [ ROOT, path ] : [ ROOT ];
		const expanded = expandProtectedSiteAdditions( existing, additions );
		expect( matchProtectedUrl( 'https://studio.youtube.com/channel/work',
			[ ...existing, ...expanded ].map( ( site ) => site.rule ) ) )
			.toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: path.rule } );
		expect( expanded ).toEqual( additions );
	} );

	it( 'retains the effective policy of an exact Studio path alongside the default', () => {
		const path = { ...STUDIO, rule: { ...STUDIO.rule, pathPrefix: '/channel', behavior: 'pause' as const } };
		const rules = [ path, ...expandProtectedSiteAdditions( [ path ], [ ROOT ] ) ].map( ( site ) => site.rule );
		expect( matchProtectedUrl( 'https://studio.youtube.com/channel/work', rules ) )
			.toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: path.rule } );
		expect( matchProtectedUrl( 'https://studio.youtube.com/dashboard', rules ) )
			.toEqual( { status: ProtectedUrlMatchStatus.UNPROTECTED, rule: STUDIO.rule } );
	} );

	it.each( [
		{ input: 'https://studio.youtube.com/', status: ProtectedUrlMatchStatus.UNPROTECTED },
		{ input: 'http://studio.youtube.com/channel', status: ProtectedUrlMatchStatus.UNPROTECTED },
		{ input: 'https://youtube.com/', status: ProtectedUrlMatchStatus.PROTECTED },
		{ input: 'https://www.youtube.com/watch?v=123', status: ProtectedUrlMatchStatus.PROTECTED },
		{ input: 'https://music.youtube.com/', status: ProtectedUrlMatchStatus.PROTECTED },
		{ input: 'https://sub.studio.youtube.com/', status: ProtectedUrlMatchStatus.PROTECTED },
		{ input: 'https://example.com/', status: ProtectedUrlMatchStatus.UNPROTECTED },
	] )( 'matches only the intended default exception for $input', ( { input, status } ) => {
		const rules = expandProtectedSiteAdditions( [], [ ROOT ] ).map( ( site ) => site.rule );
		expect( matchProtectedUrl( input, rules ).status ).toBe( status );
	} );

	it( 'appends the catalog exception without changing root coverage or input collections', () => {
		const existing: ProtectedSiteConfiguration[] = [];
		const additions = [ ROOT ];
		expect( expandProtectedSiteAdditions( existing, additions ) ).toEqual( [ ROOT, STUDIO ] );
		expect( existing ).toEqual( [] );
		expect( additions ).toEqual( [ ROOT ] );
	} );

	it( 'keeps the parent scope on the seeded exact target', () => {
		const root = { ...ROOT, rule: { ...ROOT.rule, scopeId: ProtectionScopeIdSchema.parse( 'scope_work' ) } };
		expect( expandProtectedSiteAdditions( [], [ root ] ) ).toEqual( [ root,
			{ ...STUDIO, rule: { ...STUDIO.rule, scopeId: 'scope_work' } } ] );
	} );

	it.each( [
		{ ...ROOT, rule: { ...ROOT.rule, includeSubdomains: false } },
		{ ...ROOT, rule: { ...ROOT.rule, pathPrefix: '/shorts' } },
		{ ...ROOT, rule: { ...ROOT.rule, host: 'm.youtube.com' } },
		{ ...ROOT, rule: { ...ROOT.rule, host: 'notyoutube.com' } },
		{ ...ROOT, rule: { ...ROOT.rule, host: 'youtube.com.example.com' } },
		STUDIO,
	] )( 'does not expand a target that is not the covering root: %j', ( site ) => {
		expect( expandProtectedSiteAdditions( [], [ site ] ) ).toEqual( [ site ] );
	} );

	it.each( [ false, true ] )( 'preserves an existing explicit Studio rule with descendant coverage %s', ( includeSubdomains ) => {
		const explicit: ProtectedSiteConfiguration = { ...STUDIO, displayNameOverride: 'Custom studio',
			rule: { ...STUDIO.rule, includeSubdomains, behavior: 'pause' } };
		expect( expandProtectedSiteAdditions( [ explicit ], [ ROOT ] ) ).toEqual( [ ROOT ] );
		expect( explicit.rule.behavior ).toBe( 'pause' );
	} );

	it( 'respects explicit batch targets regardless of their order', () => {
		const explicit = { ...STUDIO, rule: { ...STUDIO.rule, behavior: 'pause' as const } };
		expect( expandProtectedSiteAdditions( [], [ ROOT, explicit ] ) ).toEqual( [ ROOT, explicit ] );
		expect( expandProtectedSiteAdditions( [], [ explicit, ROOT ] ) ).toEqual( [ explicit, ROOT ] );
	} );

	it( 'preserves narrower user paths while seeding the whole Studio exception', () => {
		const path = { ...STUDIO, rule: { ...STUDIO.rule, pathPrefix: '/channel', behavior: 'pause' as const } };
		expect( expandProtectedSiteAdditions( [ path ], [ ROOT ] ) ).toEqual( [ ROOT, STUDIO ] );
		expect( expandProtectedSiteAdditions( [], [ ROOT, path ] ) ).toEqual( [ ROOT, path, STUDIO ] );
	} );

	it( 'never reseeds a saved root or duplicates a previous expansion', () => {
		expect( expandProtectedSiteAdditions( [ ROOT ], [ ROOT ] ) ).toEqual( [ ROOT ] );
		expect( expandProtectedSiteAdditions( [], [ ROOT, STUDIO ] ) ).toEqual( [ ROOT, STUDIO ] );
		expect( expandProtectedSiteAdditions( [], [] ) ).toEqual( [] );
	} );

	it( 'seeds for a new covering root even when an exact root was already saved', () => {
		const exact = { ...ROOT, rule: { ...ROOT.rule, includeSubdomains: false } };
		expect( expandProtectedSiteAdditions( [ exact ], [ ROOT ] ) ).toEqual( [ ROOT, STUDIO ] );
	} );
} );
