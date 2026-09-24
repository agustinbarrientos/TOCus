import { readdir, readFile } from 'node:fs/promises';
import { parseSync, traverse, type NodePath, type types } from '@babel/core';
import { expect, test } from 'vitest';

test.each( [ 'chrome-mv3', 'edge-mv3', 'firefox-mv2', 'safari-mv2' ] )(
	'%s ships without dynamic code evaluation, including dependency fallbacks', async ( browser ) => {
		const directory = new URL( `../../.output/${ browser }/`, import.meta.url );
		const filenames = ( await readdir( directory, { recursive: true } ) ).filter( ( name ) => name.endsWith( '.js' ) );
		const references: string[] = [];

		expect( filenames.length ).toBeGreaterThan( 0 );
		for ( const filename of filenames ) {
			const source = await readFile( new URL( filename, directory ), 'utf8' );
			const ast = parseSync( source, { sourceType: 'unambiguous', configFile: false, babelrc: false } );
			if ( ast === null ) {
				throw new Error( `Couldn't parse packaged JavaScript: ${ filename }` );
			}
			traverse( ast, {
				/**
				 * Records direct calls and aliases of JavaScript's dynamic code constructors.
				 * @param path - Referenced identifier in emitted JavaScript.
				 */
				ReferencedIdentifier( path: NodePath<types.Identifier | types.JSXIdentifier> ) {
					// Introspection does not compile or execute strings.
					if ( ( path.parentPath.isMemberExpression( { computed: false } )
						&& path.parentPath.get( 'property' ).isIdentifier( { name: 'toString' } ) )
						|| path.parentPath.isBinaryExpression( { operator: 'instanceof' } ) ) {
						return;
					}
					if ( ( path.node.name === 'Function' || path.node.name === 'eval' )
						&& ! path.scope.hasBinding( path.node.name, { noGlobals: true } ) ) {
						references.push( `${ filename }:${ String( path.node.loc?.start.line ?? 1 ) } ${ path.node.name }` );
					}
				},
			} );
		}

		expect( references ).toEqual( [] );
	},
);
