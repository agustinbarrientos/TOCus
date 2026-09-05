import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';

/**
 * Executes a file without invoking a shell.
 * @since 0.1.0 Initial implementation.
 */
const executeFile = promisify( execFile );

/**
 * Production output directories validated by the build contract.
 * @since 0.1.0 Initial implementation.
 */
const browserOutputs = [
	[ 'Chrome', new URL( '../../.output/chrome-mv3/', import.meta.url ) ],
	[ 'Firefox', new URL( '../../.output/firefox-mv2/', import.meta.url ) ],
	[ 'Safari', new URL( '../../.output/safari-mv2/', import.meta.url ) ],
] as const;

/**
 * Finds every generated JavaScript file below an extension output directory.
 * @param directoryUrl - Directory inspected recursively.
 * @return Sorted URLs for generated JavaScript files.
 * @since 0.1.0 Initial implementation.
 */
async function findGeneratedJavaScriptFiles( directoryUrl: URL ): Promise<URL[]> {
	const entries = await readdir( directoryUrl, { withFileTypes: true } );
	const nestedFiles = await Promise.all( entries.map( async ( entry ) => {
		const entryUrl = new URL( entry.isDirectory() ? `${ entry.name }/` : entry.name, directoryUrl );

		if ( entry.isDirectory() ) {
			return findGeneratedJavaScriptFiles( entryUrl );
		}

		return entry.isFile() && entry.name.endsWith( '.js' ) ? [ entryUrl ] : [];
	} ) );

	return nestedFiles.flat().sort( ( firstUrl, secondUrl ) => firstUrl.href.localeCompare( secondUrl.href ) );
}

describe( 'generated extension JavaScript', () => {
	test.each( browserOutputs )( 'emits syntactically valid %s scripts', async ( _browser, outputUrl ) => {
		const javascriptFiles = await findGeneratedJavaScriptFiles( outputUrl );

		expect( javascriptFiles ).not.toEqual( [] );

		for ( const fileUrl of javascriptFiles ) {
			await executeFile( process.execPath, [ '--check', fileURLToPath( fileUrl ) ] );
		}
	} );
} );
