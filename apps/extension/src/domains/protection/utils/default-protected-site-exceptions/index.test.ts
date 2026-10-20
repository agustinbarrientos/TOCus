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
const SHORTS: ProtectedSiteConfiguration = { ...ROOT, rule: { ...ROOT.rule, pathPrefix: '/shorts' } };
const ALLOWED_ROOT: ProtectedSiteConfiguration = { ...ROOT, rule: { ...ROOT.rule, behavior: 'allow' } };

describe( 'expandProtectedSiteAdditions', () => {
	it( 'adds a real no-pause main website and its usual defaults when a broad path is enrolled first', () => {
		expect( expandProtectedSiteAdditions( [], [ SHORTS ] ) ).toEqual( [ SHORTS, ALLOWED_ROOT, STUDIO ] );
		const rules = expandProtectedSiteAdditions( [], [ SHORTS ] ).map( ( site ) => site.rule );
		expect( matchProtectedUrl( 'https://youtube.com/', rules ).status ).toBe( ProtectedUrlMatchStatus.UNPROTECTED );
		expect( matchProtectedUrl( 'https://youtube.com/feed', rules ).status ).toBe( ProtectedUrlMatchStatus.UNPROTECTED );
		expect( matchProtectedUrl( 'https://youtube.com/shorts/item', rules ) )
			.toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: SHORTS.rule } );
	} );

	it( 'creates an exact product parent without copying path identity overrides or adding a company rule', () => {
		const path: ProtectedSiteConfiguration = { identityHost: 'mail.google.com', displayNameOverride: 'Work inbox',
			rule: { host: 'mail.google.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId,
				pathPrefix: '/inbox' } };
		expect( expandProtectedSiteAdditions( [], [ path ] ) ).toEqual( [ path, {
			identityHost: 'mail.google.com', rule: { host: 'mail.google.com', includeSubdomains: false,
				scopeId: DefaultProtectionScopeId, behavior: 'allow' },
		} ] );
	} );

	it( 'uses the canonical rule host for a parent instead of a legacy descendant identity', () => {
		const legacy = { ...SHORTS, identityHost: 'www.youtube.com' };
		expect( expandProtectedSiteAdditions( [], [ legacy ] ) ).toEqual( [ legacy, ALLOWED_ROOT, STUDIO ] );
	} );

	it.each( [ 'existing', 'batch', 'reversed batch' ] )( 'keeps broad path coverage when an exact path is added with %s siblings', ( source ) => {
		const exact = { ...SHORTS, rule: { ...SHORTS.rule, includeSubdomains: false, pathPrefix: '/feed' } };
		const existing = source === 'existing' ? [ SHORTS ] : [];
		const additions = source === 'existing' ? [ exact ] : source === 'batch' ? [ exact, SHORTS ] : [ SHORTS, exact ];
		const expanded = expandProtectedSiteAdditions( existing, additions );
		expect( expanded ).toEqual( [ ...additions, ALLOWED_ROOT, STUDIO ] );
		expect( matchProtectedUrl( 'https://youtube.com/shorts/item', [ ...existing, ...expanded ].map( ( site ) => site.rule ) ) )
			.toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: SHORTS.rule } );
	} );

	it.each( [ false, true ] )( 'preserves an explicit root from the complete batch with reversed order %s', ( reverse ) => {
		const additions = reverse ? [ SHORTS, ROOT ] : [ ROOT, SHORTS ];
		expect( expandProtectedSiteAdditions( [], additions ) ).toEqual( [ ...additions, STUDIO ] );
	} );

	it.each( [ false, true ] )( 'preserves an existing main policy with descendant coverage %s', ( includeSubdomains ) => {
		const existing = { ...ROOT, rule: { ...ROOT.rule, includeSubdomains } };
		expect( expandProtectedSiteAdditions( [ existing ], [ SHORTS ] ) ).toEqual( [ SHORTS ] );
	} );

	it.each( [ 'existing', 'batch', 'reversed batch' ] )( 'does not override a protecting ancestor supplied by %s', ( source ) => {
		const ancestor: ProtectedSiteConfiguration = { identityHost: 'google.com',
			rule: { host: 'google.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
		const path: ProtectedSiteConfiguration = { identityHost: 'mail.google.com',
			rule: { host: 'mail.google.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId, pathPrefix: '/inbox' } };
		const existing = source === 'existing' ? [ ancestor ] : [];
		const additions = source === 'existing' ? [ path ] : source === 'batch' ? [ path, ancestor ] : [ ancestor, path ];
		const expanded = expandProtectedSiteAdditions( existing, additions );
		expect( expanded ).toEqual( additions );
		expect( matchProtectedUrl( 'https://mail.google.com/', [ ...existing, ...expanded ].map( ( site ) => site.rule ) ) )
			.toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: ancestor.rule } );
	} );

	it.each( [ 'existing', 'batch', 'reversed batch' ] )( 'preserves a protecting ancestor path supplied by %s even when the product root is unprotected', ( source ) => {
		const ancestor: ProtectedSiteConfiguration = { identityHost: 'google.com',
			rule: { host: 'google.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId, pathPrefix: '/inbox' } };
		const path: ProtectedSiteConfiguration = { identityHost: 'mail.google.com',
			rule: { host: 'mail.google.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId, pathPrefix: '/foo' } };
		const existing = source === 'existing' ? [ ancestor ] : [];
		const additions = source === 'existing' ? [ path ] : source === 'batch' ? [ path, ancestor ] : [ ancestor, path ];
		expect( matchProtectedUrl( 'https://mail.google.com/', [ ...existing, ...additions ].map( ( site ) => site.rule ) ).status )
			.toBe( ProtectedUrlMatchStatus.UNPROTECTED );
		const expanded = expandProtectedSiteAdditions( existing, additions );
		expect( expanded ).toEqual( source === 'existing' ? [ path ] : [ ...additions, {
			identityHost: 'google.com', rule: { host: 'google.com', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId, behavior: 'allow' },
		} ] );
		expect( matchProtectedUrl( 'https://mail.google.com/inbox', [ ...existing, ...expanded ].map( ( site ) => site.rule ) ) )
			.toEqual( { status: ProtectedUrlMatchStatus.PROTECTED, rule: ancestor.rule } );
	} );

	it( 'creates an editable product parent when its existing company ancestor already allows it', () => {
		const ancestor: ProtectedSiteConfiguration = { identityHost: 'google.com',
			rule: { host: 'google.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId, behavior: 'allow' } };
		const path: ProtectedSiteConfiguration = { identityHost: 'mail.google.com',
			rule: { host: 'mail.google.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId, pathPrefix: '/inbox' } };
		expect( expandProtectedSiteAdditions( [ ancestor ], [ path ] ) ).toEqual( [ path, {
			identityHost: 'mail.google.com', rule: { host: 'mail.google.com', includeSubdomains: false,
				scopeId: DefaultProtectionScopeId, behavior: 'allow' },
		} ] );
	} );

	it( 'adds each missing parent once without mutating frozen inputs or reseeding a later path', () => {
		const feed = { ...SHORTS, rule: { ...SHORTS.rule, pathPrefix: '/feed' } };
		const existing = Object.freeze( [] as ProtectedSiteConfiguration[] );
		const additions = Object.freeze( [ SHORTS, feed ] );
		const expanded = expandProtectedSiteAdditions( existing, additions );
		expect( expanded ).toEqual( [ SHORTS, feed, ALLOWED_ROOT, STUDIO ] );
		expect( additions ).toEqual( [ SHORTS, feed ] );
		expect( existing ).toEqual( [] );
		const later = { ...SHORTS, rule: { ...SHORTS.rule, pathPrefix: '/watch' } };
		expect( expandProtectedSiteAdditions( expanded, [ later ] ) ).toEqual( [ later ] );
	} );

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
