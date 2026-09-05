import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const TYPOGRAPHY_PROPERTIES = [
	'font-family',
	'font-size',
	'font-weight',
	'line-height',
	'letter-spacing',
] as const;

const TYPOGRAPHY_ROLES = [
	{ role: 'display-large', values: [ 'var(--tocus-font-family-brand)', '4.096875rem', '600', '4.6rem', '-0.01796875rem' ] },
	{ role: 'display-medium', values: [ 'var(--tocus-font-family-brand)', '3.234375rem', '600', '3.7375rem', '0' ] },
	{ role: 'display-small', values: [ 'var(--tocus-font-family-brand)', '2.5875rem', '600', '3.1625rem', '0' ] },
	{ role: 'headline-large', values: [ 'var(--tocus-font-family-brand)', '2.3rem', '600', '2.875rem', '0' ] },
	{ role: 'headline-medium', values: [ 'var(--tocus-font-family-brand)', '2.0125rem', '600', '2.5875rem', '0' ] },
	{ role: 'headline-small', values: [ 'var(--tocus-font-family-brand)', '1.725rem', '600', '2.3rem', '0' ] },
	{ role: 'brand-small', values: [ 'var(--tocus-font-family-brand)', '0.790625rem', '600', '1.15rem', '0' ] },
	{ role: 'title-large', values: [ 'var(--tocus-font-family-body)', '1.58125rem', '400', '2.0125rem', '0' ] },
	{ role: 'title-medium', values: [ 'var(--tocus-font-family-body)', '1.15rem', '500', '1.725rem', '0.01078125rem' ] },
	{ role: 'title-small', values: [ 'var(--tocus-font-family-body)', '1.00625rem', '500', '1.4375rem', '0.0071875rem' ] },
	{ role: 'body-large', values: [ 'var(--tocus-font-family-body)', '1.15rem', '400', '1.725rem', '0.0359375rem' ] },
	{ role: 'body-medium', values: [ 'var(--tocus-font-family-body)', '1.00625rem', '400', '1.4375rem', '0.01796875rem' ] },
	{ role: 'body-small', values: [ 'var(--tocus-font-family-body)', '0.8625rem', '400', '1.15rem', '0.02875rem' ] },
	{ role: 'label-large', values: [ 'var(--tocus-font-family-body)', '1.00625rem', '500', '1.4375rem', '0.0071875rem' ] },
	{ role: 'label-medium', values: [ 'var(--tocus-font-family-body)', '0.8625rem', '500', '1.15rem', '0.0359375rem' ] },
	{ role: 'label-small', values: [ 'var(--tocus-font-family-body)', '0.790625rem', '500', '1.15rem', '0.0359375rem' ] },
] as const;

/**
 * Creates the expected CSS declarations for one typography role.
 * @param role - Typography role name.
 * @return Expected CSS declarations in canonical property order.
 */
function mixinDeclarations( role: string ) {
	return TYPOGRAPHY_PROPERTIES.map(
		( property ) => `${ property }: var(--tocus-typography-${ role }-${ property });`,
	);
}

const TYPOGRAPHY_TOKENS = TYPOGRAPHY_ROLES.flatMap( ( { role, values } ) =>
	TYPOGRAPHY_PROPERTIES.map(
		( property, index ) => [ `--tocus-typography-${ role }-${ property }`, values[ index ] ] as const,
	),
);

const themeRoot = fileURLToPath( new URL( '..', import.meta.url ) );

/**
 * Compiles one Sass source string against the theme package.
 * @param source - Sass source to compile.
 * @return Sass compilation result.
 */
function compile( source: string ) {
	return sass.compileString( source, { loadPaths: [ themeRoot ] } );
}

describe( 'typography', () => {
	it.each( TYPOGRAPHY_ROLES )( 'compiles the $role role into its exact declarations without token side effects', ( { role } ) => {
		const result = compile(
			`@use 'typography' as typography;
.subject {
	@include typography.apply( '${ role }' );
}`,
		);

		expect( result.css.trim() ).toBe( `.subject {\n  ${ mixinDeclarations( role ).join( '\n  ' ) }\n}` );
		expect( result.css ).not.toContain( ':root' );
	} );

	it( 'keeps the role map private to the typography implementation', () => {
		expect( () =>
			compile(
				`@use 'sass:map';
@use 'typography/scale' as scale;
@if map.has-key( scale.$roles, 'body-small' ) {}`,
			),
		).toThrow( 'Undefined variable.' );
	} );

	it( 'does not expose the role map through an accessor', () => {
		expect( () =>
			compile(
				`@use 'typography/scale' as scale;
$definitions: scale.definitions();`,
			),
		).toThrow( 'Undefined function.' );
	} );

	it( 'rejects an unknown role during compilation', () => {
		expect( () =>
			compile(
				`@use 'typography' as typography;
.subject {
	@include typography.apply( 'unknown' );
}`,
			),
		).toThrow( 'Unknown TOCus typography role "unknown".' );
	} );

	it( 'emits the 80 exact typography tokens once from tokens.scss', () => {
		const result = compile( "@use 'typography/tokens';" );
		const emittedTokens = Array.from(
			result.css.matchAll( /^\s*(--tocus-typography-[\w-]+):\s*([^;]+);$/gm ),
			( match ) => {
				const [ , name, value ] = match;

				if ( name === undefined || value === undefined ) {
					throw new TypeError( 'A typography token could not be parsed.' );
				}

				return [ name, value.trim() ] as const;
			},
		);

		expect( TYPOGRAPHY_ROLES ).toHaveLength( 16 );
		expect( TYPOGRAPHY_TOKENS ).toHaveLength( 80 );
		expect( result.css.match( /:root/g ) ).toHaveLength( 1 );
		expect( emittedTokens ).toEqual( TYPOGRAPHY_TOKENS );
		expect( new Set( emittedTokens.map( ( [ name ] ) => name ) ) ).toHaveLength( 80 );
	} );

	it( 'emits baseline role dimensions within a compact surface', () => {
		const result = compile( `@use 'typography' as typography;
@include typography.emit-tokens( '.compact', 1 );` );

		expect( result.css ).toContain( '.compact {' );
		expect( result.css ).toContain( '--tocus-typography-headline-small-font-size: 1.5rem;' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-font-size: 0.875rem;' );
		expect( result.css ).toContain( '--tocus-typography-body-small-font-size: 0.75rem;' );
		expect( result.css ).toContain( '--tocus-typography-title-medium-font-size: 1rem;' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-line-height: 1.25rem;' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-letter-spacing: 0.015625rem;' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-font-weight: 400;' );
	} );
} );
