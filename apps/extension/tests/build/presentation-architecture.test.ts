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
} );
