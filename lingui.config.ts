import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

/**
 * Files that never hold translatable copy, skipped during extraction: tests, their fixtures and harnesses, and dependencies.
 */
const nonSourceFiles = [ '**/node_modules/**', '**/*.test.*', '**/__fixtures__/**', '**/browser-test-harness/**' ];

/**
 * Configures the canonical translation catalogs shared by the extension and website builds.
 * @since 1.0.0 Initial implementation.
 */
export default defineConfig( {
	catalogs: [
		{
			include: [ '<rootDir>/apps/extension/src' ],
			exclude: nonSourceFiles,
			path: '<rootDir>/apps/extension/locales/{locale}',
		},
		{
			include: [ '<rootDir>/apps/website/src' ],
			exclude: nonSourceFiles,
			path: '<rootDir>/apps/website/locales/{locale}',
		},
	],
	fallbackLocales: { default: 'en' },
	format: formatter( {
		foldLength: 0,
		lineNumbers: false,
	} ),
	locales: [
		'en',
		'es',
		'es-AR',
		'pt-BR',
		'pt-PT',
		'it',
		'fr',
		'de',
		'ja',
		'ru',
	],
	sourceLocale: 'en',
} );
