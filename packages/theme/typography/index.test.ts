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
	{ role: 'display-large', values: [ 'var(--tocus-font-family-brand)', '3.5625rem', '600', '4rem', '-0.015625rem' ] },
	{ role: 'display-medium', values: [ 'var(--tocus-font-family-brand)', '2.8125rem', '600', '3.25rem', '0' ] },
	{ role: 'display-small', values: [ 'var(--tocus-font-family-brand)', '2.25rem', '600', '2.75rem', '0' ] },
	{ role: 'headline-large', values: [ 'var(--tocus-font-family-brand)', '2rem', '600', '2.5rem', '0' ] },
	{ role: 'headline-medium', values: [ 'var(--tocus-font-family-brand)', '1.75rem', '600', '2.25rem', '0' ] },
	{ role: 'headline-small', values: [ 'var(--tocus-font-family-brand)', '1.5rem', '600', '2rem', '0' ] },
	{ role: 'brand-small', values: [ 'var(--tocus-font-family-brand)', '0.6875rem', '600', '1rem', '0' ] },
	{ role: 'title-large', values: [ 'var(--tocus-font-family-body)', '1.375rem', '400', '1.75rem', '0' ] },
	{ role: 'title-medium', values: [ 'var(--tocus-font-family-body)', '1rem', '500', '1.5rem', '0.009375rem' ] },
	{ role: 'title-small', values: [ 'var(--tocus-font-family-body)', '0.875rem', '500', '1.25rem', '0.00625rem' ] },
	{ role: 'body-large', values: [ 'var(--tocus-font-family-body)', '1rem', '400', '1.5rem', '0.03125rem' ] },
	{ role: 'body-medium', values: [ 'var(--tocus-font-family-body)', '0.875rem', '400', '1.25rem', '0.015625rem' ] },
	{ role: 'body-small', values: [ 'var(--tocus-font-family-body)', '0.75rem', '400', '1rem', '0.025rem' ] },
	{ role: 'label-large', values: [ 'var(--tocus-font-family-body)', '0.875rem', '500', '1.25rem', '0.00625rem' ] },
	{ role: 'label-medium', values: [ 'var(--tocus-font-family-body)', '0.75rem', '500', '1rem', '0.03125rem' ] },
	{ role: 'label-small', values: [ 'var(--tocus-font-family-body)', '0.6875rem', '500', '1rem', '0.03125rem' ] },
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
} );
