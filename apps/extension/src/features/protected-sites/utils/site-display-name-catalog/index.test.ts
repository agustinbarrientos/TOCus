import { describe, expect, it } from 'vitest';
import { compileSiteDisplayNameCatalog } from './index';

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
