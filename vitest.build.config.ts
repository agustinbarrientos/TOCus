import { defineConfig } from 'vitest/config';

/**
 * Configures build-contract and co-located workspace unit tests.
 * @since <version> Initial implementation.
 */
export default defineConfig( {
	test: {
		include: [
			'apps/extension/tests/build/**/*.{test,spec}.{ts,tsx,mjs}',
			'apps/**/src/**/index.test.{ts,tsx}',
			'packages/**/index.test.{ts,tsx}',
		],
		passWithNoTests: false,
	},
} );
