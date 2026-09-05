import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

/**
 * Configures the canonical translation catalogs shared by the extension and website builds.
 * @since 0.1.0 Initial implementation.
 */
export default defineConfig( {
	catalogs: [
		{
			include: [ '<rootDir>/apps/extension/src' ],
			path: '<rootDir>/apps/extension/locales/{locale}',
		},
		{
			include: [ '<rootDir>/apps/website/src' ],
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
