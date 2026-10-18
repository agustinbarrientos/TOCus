import { expect, it } from 'vitest';
import { classifyFirefoxDiagnostics } from '../apps/extension/tests/build/packaged-native/__fixtures__/firefox-diagnostics.mjs';

const origin = 'moz-extension://6c3621b8-fc84-4e87-8647-0ffebc23ad6c/';
const resolvedInactive = 'Promise resolved while context is inactive\n';
const resolvedUnloaded = 'Promise resolved after context unloaded\n';
const rejectedUnloaded = "Promise rejected after context unloaded: Actor 'Conduits' destroyed before query 'RuntimeMessage' was resolved\n";

it.each( [ 'chunks/options-BRK5NPGy.js', 'chunks/statistics-client-example.js', 'protected-page.js' ] )(
	'retains the exact resolved-inactive lifecycle entry from %s', ( source ) => {
		const entry = Object.freeze( { url: `${ origin }${ source }`, message: resolvedInactive } );

		const result = classifyFirefoxDiagnostics( [ entry ], origin );

		expect( result ).toEqual( { errors: [], unloadedContexts: [], inactiveContexts: [ entry ] } );
		expect( result.inactiveContexts[ 0 ] ).toBe( entry );
	},
);

it.each( [
	[ 'chunks/options-example.js', resolvedUnloaded ],
	[ 'chunks/statistics-client-example.js', resolvedUnloaded ],
	[ 'protected-page.js', resolvedUnloaded ],
	[ 'chunks/options-example.js', rejectedUnloaded ],
	[ 'chunks/statistics-client-example.js', rejectedUnloaded ],
	[ 'protected-page.js', rejectedUnloaded ],
] )( 'preserves the existing unloaded-context entry from %s: %s', ( source, message ) => {
	const entry = Object.freeze( { url: `${ origin }${ source }`, message } );

	const result = classifyFirefoxDiagnostics( [ entry ], origin );

	expect( result ).toEqual( { errors: [], unloadedContexts: [ entry ], inactiveContexts: [] } );
	expect( result.unloadedContexts[ 0 ] ).toBe( entry );
} );

it.each( [
	[ 'genuine application error', `${ origin }chunks/options-example.js`, 'TypeError: Cannot read properties of null' ],
	[ 'rejected inactive promise', `${ origin }chunks/options-example.js`, 'Promise rejected while context is inactive\n' ],
	[ 'rejected inactive promise with reason', `${ origin }protected-page.js`, 'Promise rejected while context is inactive: Storage failed\n' ],
	[ 'different unloaded rejection', `${ origin }chunks/options-example.js`, 'Promise rejected after context unloaded: Storage failed\n' ],
	[ 'resolved inactive background', `${ origin }background.js`, resolvedInactive ],
	[ 'resolved unloaded background', `${ origin }background.js`, resolvedUnloaded ],
	[ 'rejected unloaded background', `${ origin }background.js`, rejectedUnloaded ],
	[ 'another source path', `${ origin }content-scripts/main.js`, resolvedInactive ],
	[ 'nested chunk path', `${ origin }chunks/nested/options.js`, resolvedInactive ],
	[ 'chunk path with query', `${ origin }chunks/options.js?other-source`, resolvedInactive ],
	[ 'query resembling a chunk suffix', `${ origin }chunks/options.js?other.js`, resolvedInactive ],
	[ 'fragment resembling a chunk suffix', `${ origin }chunks/options.js#other.js`, resolvedInactive ],
	[ 'source map path', `${ origin }chunks/options.js.map`, resolvedInactive ],
	[ 'different extension origin', 'moz-extension://11111111-1111-1111-1111-111111111111/chunks/options-example.js', resolvedInactive ],
	[ 'different extension unloaded context', 'moz-extension://11111111-1111-1111-1111-111111111111/chunks/options-example.js', resolvedUnloaded ],
	[ 'different inactive message', `${ origin }chunks/options-example.js`, 'Promise resolved while context is inactive: Storage failed\n' ],
	[ 'inexact inactive message', `${ origin }chunks/options-example.js`, 'Promise resolved while context is inactive' ],
] )( 'keeps %s in the error gate', ( _label, url, message ) => {
	const entry = Object.freeze( { url, message } );

	const result = classifyFirefoxDiagnostics( [ entry ], origin );

	expect( result ).toEqual( { errors: [ entry ], unloadedContexts: [], inactiveContexts: [] } );
	expect( result.errors[ 0 ] ).toBe( entry );
} );

it( 'retains raw entries in their original order within every diagnostic category', () => {
	const firstError = Object.freeze( { url: `${ origin }background.js`, message: resolvedInactive } );
	const inactive = Object.freeze( { url: `${ origin }chunks/options-example.js`, message: resolvedInactive } );
	const unloaded = Object.freeze( { url: `${ origin }protected-page.js`, message: resolvedUnloaded } );
	const secondError = Object.freeze( { url: `${ origin }chunks/options-example.js`, message: 'Unhandled application error' } );
	const entries = Object.freeze( [ firstError, inactive, unloaded, secondError ] );

	const result = classifyFirefoxDiagnostics( entries, origin );

	expect( result ).toEqual( {
		errors: [ firstError, secondError ], unloadedContexts: [ unloaded ], inactiveContexts: [ inactive ],
	} );
	expect( [ ...result.errors, ...result.unloadedContexts, ...result.inactiveContexts ] )
		.toEqual( expect.arrayContaining( entries ) );
} );
