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
				'apps/extension/src/domains/preferences/index.ts',
				'apps/extension/src/domains/preferences/services/index.ts',
				'apps/extension/src/domains/preferences/utils/index.ts',
				'apps/extension/src/domains/protection/index.ts',
				'apps/extension/src/domains/protection/services/index.ts',
				'apps/extension/src/domains/protection/types/index.ts',
				'apps/extension/src/domains/protection/utils/index.ts',
				'apps/extension/src/domains/statistics/index.ts',
				'apps/extension/src/domains/statistics/services/index.ts',
				'apps/extension/src/domains/statistics/types/index.ts',
				'apps/extension/src/domains/statistics/utils/index.ts',
				'apps/extension/src/localization/index.ts',
			],
			include: [
				'apps/website/src/localization/**/*.ts',
				'apps/extension/src/domains/preferences/**/*.ts',
				'apps/extension/src/domains/protection/**/*.ts',
				'apps/extension/src/domains/statistics/**/*.ts',
				'apps/extension/src/localization/**/*.ts',
				'apps/extension/src/entrypoints/background/index.ts',
				'apps/extension/src/entrypoints/interruption/index.ts',
				'apps/extension/src/entrypoints/options/index.ts',
				'apps/extension/src/entrypoints/popup/index.ts',
				'apps/extension/src/entrypoints/protected-page/index.ts',
				'apps/extension/src/features/preferences/services/preferences-controller/**/*.ts',
				'apps/extension/src/features/protected-sites/services/protected-site-enrollment/**/*.ts',
				'apps/extension/src/features/protected-sites/services/site-permission-manager/**/*.ts',
				'apps/extension/src/features/protected-sites/services/site-favicon-provider/**/*.ts',
				'apps/extension/src/features/protected-sites/utils/site-permission-origins/**/*.ts',
				'apps/extension/src/features/protected-sites/utils/site-display-name-catalog/**/*.ts',
				'apps/extension/src/features/protected-sites/utils/site-display-name-resolver/**/*.ts',
				'apps/extension/src/features/interruption/services/interruption-page-controller/**/*.ts',
				'apps/extension/src/features/interruption/services/protected-page-layer-controller/**/*.ts',
				'apps/extension/src/features/interruption/services/focused-progress-clock/**/*.ts',
				'apps/extension/src/features/interruption/utils/breathing-motion/**/*.ts',
				'apps/extension/src/features/interruption/utils/breathing-sphere-geometry/**/*.ts',
				'apps/extension/src/features/protection-runtime/**/*.ts',
				'apps/extension/src/features/statistics/services/**/*.ts',
				'apps/extension/src/features/statistics/types/**/*.ts',
				'apps/extension/src/features/statistics/utils/**/*.ts',
			],
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
