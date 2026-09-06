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
	{ role: 'display-large', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 4.096875)', '600', 'calc(var(--tocus-size-unit) * 4.6)', 'calc(var(--tocus-size-unit) * -0.01796875)' ] },
	{ role: 'display-medium', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 3.234375)', '600', 'calc(var(--tocus-size-unit) * 3.7375)', '0' ] },
	{ role: 'display-small', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 2.5875)', '600', 'calc(var(--tocus-size-unit) * 3.1625)', '0' ] },
	{ role: 'headline-large', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 2.3)', '600', 'calc(var(--tocus-size-unit) * 2.875)', '0' ] },
	{ role: 'headline-medium', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 2.0125)', '600', 'calc(var(--tocus-size-unit) * 2.5875)', '0' ] },
	{ role: 'headline-small', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 1.725)', '600', 'calc(var(--tocus-size-unit) * 2.3)', '0' ] },
	{ role: 'brand-small', values: [ 'var(--tocus-font-family-brand)', 'calc(var(--tocus-size-unit) * 0.790625)', '600', 'calc(var(--tocus-size-unit) * 1.15)', '0' ] },
	{ role: 'title-large', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 1.58125)', '400', 'calc(var(--tocus-size-unit) * 2.0125)', '0' ] },
	{ role: 'title-medium', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 1.15)', '500', 'calc(var(--tocus-size-unit) * 1.725)', 'calc(var(--tocus-size-unit) * 0.01078125)' ] },
	{ role: 'title-small', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 1.00625)', '500', 'calc(var(--tocus-size-unit) * 1.4375)', 'calc(var(--tocus-size-unit) * 0.0071875)' ] },
	{ role: 'body-large', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 1.15)', '400', 'calc(var(--tocus-size-unit) * 1.725)', 'calc(var(--tocus-size-unit) * 0.0359375)' ] },
	{ role: 'body-medium', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 1.00625)', '400', 'calc(var(--tocus-size-unit) * 1.4375)', 'calc(var(--tocus-size-unit) * 0.01796875)' ] },
	{ role: 'body-small', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 0.8625)', '400', 'calc(var(--tocus-size-unit) * 1.15)', 'calc(var(--tocus-size-unit) * 0.02875)' ] },
	{ role: 'label-large', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 1.00625)', '500', 'calc(var(--tocus-size-unit) * 1.4375)', 'calc(var(--tocus-size-unit) * 0.0071875)' ] },
	{ role: 'label-medium', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 0.8625)', '500', 'calc(var(--tocus-size-unit) * 1.15)', 'calc(var(--tocus-size-unit) * 0.0359375)' ] },
	{ role: 'label-small', values: [ 'var(--tocus-font-family-body)', 'calc(var(--tocus-size-unit) * 0.790625)', '500', 'calc(var(--tocus-size-unit) * 1.15)', 'calc(var(--tocus-size-unit) * 0.0359375)' ] },
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
		expect( result.css ).toContain( '--tocus-typography-headline-small-font-size: calc(var(--tocus-size-unit) * 1.5);' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-font-size: calc(var(--tocus-size-unit) * 0.875);' );
		expect( result.css ).toContain( '--tocus-typography-body-small-font-size: calc(var(--tocus-size-unit) * 0.75);' );
		expect( result.css ).toContain( '--tocus-typography-title-medium-font-size: calc(var(--tocus-size-unit) * 1);' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-line-height: calc(var(--tocus-size-unit) * 1.25);' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-letter-spacing: calc(var(--tocus-size-unit) * 0.015625);' );
		expect( result.css ).toContain( '--tocus-typography-body-medium-font-weight: 400;' );
	} );
} );
