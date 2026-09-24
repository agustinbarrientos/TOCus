import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { expect, test } from 'vitest';
import { createInterpretedValidationPlugin } from './index.ts';

test( 'validates packaged data without attempting code generation or rewriting other modules', async () => {
	const result = await build( {
		configFile: false,
		logLevel: 'silent',
		plugins: [ createInterpretedValidationPlugin() ],
		build: {
			write: false,
			lib: {
				entry: fileURLToPath( new URL( './__fixtures__/validation.ts', import.meta.url ) ),
				formats: [ 'iife' ],
				name: 'ValidationFixture',
			},
		},
	} );
	const bundle = Array.isArray( result ) ? result[ 0 ] : result;
	if ( bundle === undefined || ! ( 'output' in bundle ) ) {
		throw new Error( 'Expected one bundled validation fixture.' );
	}
	const script = bundle.output.find( ( output ) => output.type === 'chunk' );
	if ( script === undefined ) {
		throw new Error( 'The validation fixture did not produce JavaScript.' );
	}
	let attempts = 0;
	/**
	 * Makes both called and constructed attempts observable, even if a dependency catches the error.
	 * @throws {Error} Whenever code attempts dynamic compilation.
	 */
	function rejectDynamicCode(): never {
		attempts++;
		throw new Error( 'Dynamic code evaluation is unavailable in extensions.' );
	}
	const context: Record<string, unknown> = { Function: rejectDynamicCode };
	runInNewContext( script.code, context );

	expect( context.ValidationFixture ).toMatchObject( {
		valid: { success: true, data: { duration: 10, sites: [ 'example.com' ] } },
		invalid: { success: false },
		unrelatedJitless: false,
	} );
	expect( attempts ).toBe( 0 );
} );
