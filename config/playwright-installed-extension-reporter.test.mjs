import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const require = createRequire( import.meta.url );
const reporterPath = fileURLToPath( new URL( './playwright-installed-extension-reporter.mjs', import.meta.url ) );

it.each( [
	[ 'passing journey', "test('journey', () => expect(true).toBe(true));", 0 ],
	[ 'skipped journey', "test.skip('journey', () => expect(true).toBe(true));", 1 ],
	[ 'expected failure', "test('journey', () => { test.fail(); expect(true).toBe(false); });", 1 ],
	[ 'failed journey', "test('journey', () => expect(true).toBe(false));", 1 ],
	[ 'read-only discovery', "test('journey', () => expect(true).toBe(false));", 0, [ '--list' ] ],
] )( 'requires an executed passing journey: %s', async ( _label, body, exitCode, arguments_ = [] ) => {
	const outputDirectory = fileURLToPath( new URL( '../test-results/', import.meta.url ) );
	await mkdir( outputDirectory, { recursive: true } );
	const directory = await mkdtemp( join( outputDirectory, 'installed-reporter-' ) );
	try {
		await writeFile( join( directory, 'journey.spec.cjs' ),
			`const {test, expect} = require(${ JSON.stringify( require.resolve( '@playwright/test' ) ) });\n${ body }\n` );
		const configPath = join( directory, 'playwright.config.mjs' );
		await writeFile( configPath, `export default ${ JSON.stringify( {
			testDir: directory,
			testMatch: '*.spec.cjs',
			outputDir: join( directory, 'output' ),
			reporter: [ [ reporterPath ] ],
			workers: 1,
			timeout: 2_000,
		} ) };\n` );
		const result = spawnSync( process.execPath, [
			require.resolve( '@playwright/test/cli' ), 'test', '--config', configPath, ...arguments_,
		], { encoding: 'utf8', timeout: 15_000 } );
		expect( result.error ).toBeUndefined();
		expect( result.status, result.stdout + result.stderr ).toBe( exitCode );
		if ( exitCode !== 0 ) {
			expect( result.stderr ).toContain( 'Installed-extension gate requires every journey to pass' );
		}
	} finally {
		await rm( directory, { recursive: true, force: true } );
	}
}, 20_000 );
