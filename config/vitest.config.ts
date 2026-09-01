import { defineConfig } from 'vitest/config';

/**
 * Configures the repository's unit and build-contract test projects.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	test: {
		coverage: {
			exclude: [
				'**/*.test.{ts,tsx}',
				'**/__fixtures__/**',
				'apps/extension/src/domains/protection/index.ts',
				'apps/extension/src/domains/protection/utils/index.ts',
			],
			include: [ 'apps/extension/src/domains/protection/**/*.ts' ],
			provider: 'v8',
			reporter: [ [ 'text', { skipFull: false } ] ],
			thresholds: {
				branches: 100,
				functions: 100,
				lines: 100,
				statements: 100,
			},
		},
		passWithNoTests: false,
		projects: [
			{
				test: {
					exclude: [ '**/node_modules/**', 'apps/**/src/**/*.wtr.test.{ts,tsx}' ],
					name: 'unit',
					include: [
						'apps/**/src/**/*.test.{ts,tsx}',
						'packages/**/*.test.{ts,tsx}',
					],
				},
			},
			{
				test: {
					name: 'build-contract',
					include: [ 'apps/extension/tests/build/**/*.{test,spec}.{ts,tsx,mjs}' ],
				},
			},
		],
	},
} );
