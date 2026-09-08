import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const sourceRoots = [
	fileURLToPath( new URL( '../../../apps/extension/src/features/', import.meta.url ) ),
	fileURLToPath( new URL( '../../../apps/website/src/styles/', import.meta.url ) ),
];
const sharedFoundations = [
	'button-base', 'primary-action', 'secondary-action', 'destructive-action',
	'inline-alert', 'error-text', 'confirmation-panel', 'recovery-panel',
];
const duplicateMixinPattern = new RegExp( `@include\\s+controls\\.(?:${ sharedFoundations.join( '|' ) })\\b`, 'u' );
const themeNodeModules = fileURLToPath( new URL( '../../../apps/extension/node_modules/', import.meta.url ) );
const layoutPropertyPatterns = [
	'display', 'position', 'z-index', 'inset(?:-.+)?', 'top', 'right', 'bottom', 'left',
	'(?:min-|max-)?(?:width|height)', 'margin(?:-.+)?', 'padding(?:-.+)?', '(?:row-|column-)?gap',
	'align-.+', 'justify-.+', 'place-.+', 'grid(?:-.+)?', 'flex(?:-.+)?', 'order', 'overflow(?:-.+)?',
	'white-space', 'text-align', 'vertical-align', 'font(?:-.+)?', 'line-height', 'letter-spacing',
];
const layoutProperty = new RegExp( `^(?:${ layoutPropertyPatterns.join( '|' ) })$`, 'u' );

/**
 * Finds local declarations that override shared controls, including through their other class names.
 * @param source - Component-authored SCSS to inspect after resolving nested selectors.
 * @param markup - Adjacent component source containing shared Button and Alert class names.
 * @param stylesheetUrl - Optional source URL used to resolve relative Sass imports.
 * @return Non-layout declarations applied directly to shared controls, qualified by selector.
 */
function findControlOverrides( source: string, markup: string, stylesheetUrl?: URL ): string[] {
	const controlClasses = new Set<string>();
	for ( const attribute of markup.matchAll( /<(?:Button|Alert)\b[^>]*\bclassName="([^"]*)"/gu ) ) {
		for ( const name of ( attribute[ 1 ] ?? '' ).matchAll( /[a-z][a-z0-9_-]*/gu ) ) {
			controlClasses.add( name[ 0 ] );
		}
	}
	// The library stylesheet is verified by its own rendered suite, not counted as an app override.
	const localStyles = source.replaceAll( /@use\s+['"]@tocus\/ui\/styles(?:\.scss)?['"];?/gu, '' );
	const css = sass.compileString( localStyles, {
		loadPaths: [ themeNodeModules ],
		...( stylesheetUrl ? { url: stylesheetUrl } : {} ),
	} ).css.replaceAll( /\/\*[\s\S]*?\*\//gu, '' );
	const overrides: string[] = [];
	for ( const rule of css.matchAll( /([^{}]+)\{([^{}]*)\}/gu ) ) {
		const selectors = rule[ 1 ] ?? '';
		const declarations = rule[ 2 ] ?? '';
		// Sass expands nested rules first. Only inspect the subject, not icons or text inside a control.
		const targetsControl = selectors.split( ',' ).some( ( selector ) => {
			const subject = selector.replaceAll( /\([^)]*\)|\[[^\]]*\]/gu, '' )
				.trim().split( /[\s>+~]+/u ).at( -1 ) ?? '';
			return [ ...subject.matchAll( /\.([a-z][a-z0-9_-]*)/gu ) ]
				.some( ( name ) => controlClasses.has( name[ 1 ] ?? '' ) );
		} );
		if ( ! targetsControl ) {
			continue;
		}
		for ( const declaration of declarations.matchAll( /(?:^|;)\s*([a-z-]+)\s*:/gu ) ) {
			const property = declaration[ 1 ];
			if ( property !== undefined && ! layoutProperty.test( property ) ) {
				overrides.push( `${ selectors.trim() }: ${ property }` );
			}
		}
	}
	return overrides;
}

describe( 'shared UI style ownership', () => {
	it.each( [
		'.save-action { background: red; color: white; border-radius: 10px; }',
		'.save-action { &:hover { box-shadow: none; transform: translateY(-1px); } }',
		'.save-action:focus-visible { outline: 0; }',
		'.save-action:disabled { opacity: .7; cursor: wait; }',
		'@media (forced-colors: active) { .save-action { background: Canvas; } }',
		'.message { border: 1px solid blue; background: blue; }',
	] )( 'rejects handwritten common states through co-classes: %s', ( source ) => {
		expect( findControlOverrides( source, '<Button className="save-action" /><Alert className="message" />' ) ).not.toEqual( [] );
	} );

	it( 'allows unique layout and icon artwork without overriding control states', () => {
		expect( findControlOverrides( '.save-action { width: 100%; padding: 10px; } .save-action svg { fill: currentColor; }', '<Button className="save-action" />' ) ).toEqual( [] );
	} );

	it( 'keeps handwritten action and notice states out of local co-classes', () => {
		const overrides: string[] = [];
		for ( const sourceRoot of sourceRoots ) {
			for ( const file of readdirSync( sourceRoot, { recursive: true } ) ) {
				if ( typeof file !== 'string' || ! file.endsWith( '.scss' ) ) {
					continue;
				}
				const path = resolve( sourceRoot, file );
				const directory = dirname( path );
				const markup = readdirSync( directory )
					.filter( ( name ) => /\.tsx?$/u.test( name ) && ! name.includes( '.test.' ) )
					.map( ( name ) => readFileSync( resolve( directory, name ), 'utf8' ) ).join( '\n' );
				overrides.push( ...findControlOverrides( readFileSync( path, 'utf8' ), markup, pathToFileURL( path ) ).map( ( violation ) => `${ file }: ${ violation }` ) );
			}
		}
		expect( overrides, 'Shared controls may have local layout, not local colors, borders, shadows or interaction states.' ).toEqual( [] );
	} );

	it( 'keeps action and notice foundations out of component stylesheets', () => {
		const duplicatedFoundations: string[] = [];
		for ( const featureRoot of sourceRoots ) {
			for ( const file of readdirSync( featureRoot, { recursive: true } ) ) {
				if ( typeof file !== 'string' || ! file.endsWith( '.scss' ) ) {
					continue;
				}
				const source = readFileSync( resolve( featureRoot, file ), 'utf8' );
				const hasDuplicateMixin = duplicateMixinPattern.test( source );
				const sharedClassPattern = /\.(?:tocus-(?:button|alert)(?:\b|__|--)|mantine-(?:Button|Alert)-root)/u;
				const redefinesSharedClass = sharedClassPattern.test( source );
				if ( hasDuplicateMixin || redefinesSharedClass ) {
					duplicatedFoundations.push( file );
				}
			}
		}
		expect( duplicatedFoundations, 'Use the shared theme classes; component styles may only define their layout and unique artwork.' ).toEqual( [] );
	} );
} );
