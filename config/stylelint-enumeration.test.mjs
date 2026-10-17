import { readdir } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import stylelint from 'stylelint';

const repository = fileURLToPath( new URL( '../', import.meta.url ) );

it( 'lints authored styles without traversing generated directory cycles', async () => {
	const manifest = JSON.parse( await readFile( join( repository, 'package.json' ), 'utf8' ) );
	const options = manifest.scripts[ 'lint:styles' ].match( /--globby-options '([^']+)'/ )?.[ 1 ] ?? '{}';
	const results = join( repository, 'test-results' );
	await mkdir( results, { recursive: true } );
	const directory = await mkdtemp( join( results, 'stylelint-enumeration-' ) );
	try {
		const assets = join( directory, 'tools', 'store-assets' );
		await mkdir( join( assets, 'lib' ), { recursive: true } );
		await mkdir( join( assets, '.output', 'preview' ), { recursive: true } );
		await symlink( '..', join( assets, '.output', 'preview', 'loop' ) );
		await writeFile( join( assets, '.output', 'preview', 'invalid.css' ), 'this is not CSS {' );
		const authored = join( assets, 'lib', 'authored.css' );
		await writeFile( authored, '.tocus-check {\n\tcolor: red;\n}\n' );
		let generatedReads = 0;
		const lintOptions = { cwd: directory, files: 'tools/store-assets/**/*.css',
			configFile: join( repository, 'stylelint.config.js' ),
			globbyOptions: { ...JSON.parse( options ), fs: {
				/**
				 * Fails immediately if glob enumeration enters generated output.
				 * @param {string} path - Directory being enumerated.
				 * @param {object} readOptions - Native directory options.
				 * @param {function(Error|null, Array<object|string>): void} callback - Native directory completion callback.
				 * @since 1.1.0
				 */
				readdir( path, readOptions, callback ) {
					if ( String( path ).includes( '.output' ) ) {
						generatedReads += 1;
						callback( new Error( 'Generated directories must be pruned before enumeration.' ) );
						return;
					}
					readdir( path, readOptions, callback );
				},
			} } };
		const valid = await stylelint.lint( lintOptions );
		expect( valid.errored ).toBe( false );
		expect( valid.results.map( ( result ) => result.source ) ).toEqual( [ authored ] );
		expect( generatedReads ).toBe( 0 );
		await writeFile( authored, '.tocus-check {\n\tnot-a-real-property: 1;\n}\n' );
		const invalid = await stylelint.lint( lintOptions );
		expect( invalid.errored ).toBe( true );
		expect( invalid.results[ 0 ].warnings.some( ( warning ) => warning.rule === 'property-no-unknown' ) ).toBe( true );
	} finally {
		await rm( directory, { recursive: true, force: true } );
	}
}, 10_000 );
