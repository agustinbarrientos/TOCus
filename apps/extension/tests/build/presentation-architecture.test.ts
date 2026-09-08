import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const repository = new URL( '../../../../', import.meta.url );

describe( 'shared React presentation architecture', () => {
	it( 'keeps Lit and its framework-specific testing tools out of the resolved dependency tree', async () => {
		const lockfile = await readFile( new URL( 'pnpm-lock.yaml', repository ), 'utf8' );
		expect( lockfile ).not.toMatch(
			/^\s{2}(?:'?(?:@lit\/|@open-wc\/)|lit(?:-html|-element|-analyzer)?@|eslint-plugin-lit@)/mu,
		);
	} );
	it( 'uses the packaged Mantine dependency through the shared UI package on both surfaces', async () => {
		const ui = await readFile( new URL( 'packages/ui/package.json', repository ), 'utf8' );
		const extension = await readFile( new URL( 'apps/extension/package.json', repository ), 'utf8' );
		const website = await readFile( new URL( 'apps/website/package.json', repository ), 'utf8' );
		expect( JSON.parse( ui ) ).toHaveProperty( 'dependencies.@mantine/core' );
		for ( const source of [ extension, website ] ) {
			expect( JSON.parse( source ) ).toHaveProperty( 'dependencies.@tocus/ui', 'workspace:*' );
		}
	} );
} );
