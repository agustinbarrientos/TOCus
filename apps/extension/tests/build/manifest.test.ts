import { readFileSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { type CatalogType } from '@lingui/cli/api';
import { formatter } from '@lingui/format-po';
import { describe, expect, test } from 'vitest';

const chromeManifestUrl = new URL( '../../.output/chrome-mv3/manifest.json', import.meta.url );
const firefoxManifestUrl = new URL( '../../.output/firefox-mv2/manifest.json', import.meta.url );
const safariManifestUrl = new URL( '../../.output/safari-mv2/manifest.json', import.meta.url );
const chromeOutputUrl = new URL( '../../.output/chrome-mv3/', import.meta.url );
const firefoxOutputUrl = new URL( '../../.output/firefox-mv2/', import.meta.url );
const safariOutputUrl = new URL( '../../.output/safari-mv2/', import.meta.url );
const themeIconUrl = new URL( '../../../../packages/theme/assets/icon.svg', import.meta.url );
const expectedExtensionIcons = {
	16: 'icons/16.png',
	19: 'icons/19.png',
	24: 'icons/24.png',
	32: 'icons/32.png',
	38: 'icons/38.png',
	48: 'icons/48.png',
	64: 'icons/64.png',
	96: 'icons/96.png',
	128: 'icons/128.png',
	256: 'icons/256.png',
	512: 'icons/512.png',
} as const;
const expectedToolbarIcons = {
	16: 'icons/16.png',
	19: 'icons/19.png',
	24: 'icons/24.png',
	32: 'icons/32.png',
	38: 'icons/38.png',
	64: 'icons/64.png',
} as const;
const expectedProtectedPageFontResources = [
	'assets/protected-page-font.woff2',
	'assets/protected-page-font2.woff2',
	'assets/protected-page-font3.woff2',
] as const;
const expectedProtectedPageResources = [
	...expectedProtectedPageFontResources,
	'interruption.html',
] as const;
const expectedProtectedPageMatches = [
	'http://*/*',
	'https://*/*',
] as const;
const expectedManifestLocales = [
	'de',
	'en',
	'es',
	'es_419',
	'fr',
	'it',
	'ja',
	'pt_BR',
	'pt_PT',
	'ru',
] as const;
const expectedManifestCatalogLocales = Object.freeze( {
	de: 'de',
	en: 'en',
	es: 'es',
	es_419: 'es',
	fr: 'fr',
	it: 'it',
	ja: 'ja',
	pt_BR: 'pt-BR',
	pt_PT: 'pt-PT',
	ru: 'ru',
} );
const expectedOnboardingSiteNames = [
	'Chess.com',
	'Discord',
	'Facebook',
	'Instagram',
	'LinkedIn',
	'Netflix',
	'Pinterest',
	'Reddit',
	'Spotify',
	'Threads',
	'TikTok',
	'Twitch',
	'WhatsApp',
	'X',
	'YouTube',
] as const;

/**
 * PO formatter used to inspect translator-authored extension metadata.
 * @since 0.1.0 Initial implementation.
 */
const poFormatter = formatter( {
	foldLength: 0,
	lineNumbers: false,
} );

/**
 * Settings-only copy that classic runtimes must not bundle.
 * @since 0.1.0 Initial implementation.
 */
const settingsOnlyMessage = 'Choose the language TOCus uses across the extension.';

/**
 * Maximum generated size for each classic-script runtime that cannot load locale chunks.
 * @since 0.1.0 Initial implementation.
 */
const maximumClassicRuntimeBytes = 450_000;
const pngSignature = Buffer.from( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] );

/**
 * Reads and parses one generated extension manifest.
 * @param url - Generated manifest URL.
 * @return Parsed manifest value.
 */
async function readManifest( url: URL ): Promise<unknown> {
	const manifestPath = fileURLToPath( url );
	const manifestText = await readFile( manifestPath, 'utf8' );

	return JSON.parse( manifestText );
}

/**
 * Reads one generated extension output file.
 * @param outputUrl - Browser output-directory URL.
 * @param filePath - File path relative to the output directory.
 * @return Generated file contents.
 */
async function readOutputFile( outputUrl: URL, filePath: string ): Promise<string> {
	return readFile( fileURLToPath( new URL( filePath, outputUrl ) ), 'utf8' );
}

/**
 * Reads one generated binary extension output file.
 * @param outputUrl - Browser output-directory URL.
 * @param filePath - File path relative to the output directory.
 * @return Generated file contents.
 */
async function readOutputBuffer( outputUrl: URL, filePath: string ): Promise<Buffer> {
	return readFile( fileURLToPath( new URL( filePath, outputUrl ) ) );
}

/**
 * Parses one extension PO catalog from its canonical app-root location.
 * @param locale - Lingui locale filename to parse.
 * @return Parsed translator catalog.
 * @since 0.1.0 Initial implementation.
 */
async function readExtensionCatalog( locale: string ): Promise<CatalogType> {
	const filename = fileURLToPath( new URL( `../../locales/${ locale }.po`, import.meta.url ) );

	return poFormatter.parse( readFileSync( filename, 'utf8' ), {
		filename,
		locale,
		sourceLocale: 'en',
	} );
}

/**
 * Reads one required translated message from a parsed catalog.
 * @param catalog - Parsed translator catalog.
 * @param locale - Locale used to identify an invalid catalog.
 * @param message - English source message.
 * @param context - Translator context that distinguishes the message.
 * @return Nonempty translated message.
 * @since 0.1.0 Initial implementation.
 */
function getCatalogTranslation( catalog: CatalogType, locale: string, message: string, context: string ): string {
	const translation = Object.values( catalog ).find( ( entry ) => (
		entry.message === message && entry.context === context
	) )?.translation;

	if ( translation === undefined || translation.trim() === '' ) {
		throw new Error( `Catalog ${ locale } is missing ${ context }.` );
	}

	return translation;
}

/**
 * Projects canonical extension metadata into Chrome-compatible messages.
 * @param catalog - Parsed translator catalog for one locale.
 * @param locale - Locale used to identify invalid metadata.
 * @return Browser-managed message file contents.
 * @since 0.1.0 Initial implementation.
 */
function createExpectedManifestMessages( catalog: CatalogType, locale: string ): object {
	return {
		extensionName: {
			message: getCatalogTranslation( catalog, locale, 'TOCus', 'Extension name' ),
			description: 'Extension name.',
		},
		extensionDescription: {
			message: getCatalogTranslation(
				catalog,
				locale,
				'A gentle pause before distracting websites, designed to help you return to your intentions.',
				'Extension description',
			),
			description: 'Short extension description shown by the browser and extension store.',
		},
	};
}

/**
 * Verifies that browser-managed extension metadata has complete local translations.
 * @param outputUrl - Browser output-directory URL.
 * @return Promise resolved after every bundled manifest locale is validated.
 * @since 0.1.0 Initial implementation.
 */
async function expectLocalizedManifestMessages( outputUrl: URL ): Promise<void> {
	for ( const locale of expectedManifestLocales ) {
		const catalogLocale = expectedManifestCatalogLocales[ locale ];
		const catalog = await readExtensionCatalog( catalogLocale );
		const messages: unknown = JSON.parse(
			await readOutputFile( outputUrl, `_locales/${ locale }/messages.json` ),
		);

		expect( messages, locale ).toEqual(
			createExpectedManifestMessages( catalog, catalogLocale ),
		);
	}
}

/**
 * Verifies that one generated icon is a square PNG with the expected dimensions.
 * @param icon - Generated icon contents.
 * @param expectedSize - Expected width and height in pixels.
 */
function expectSquarePng( icon: Buffer, expectedSize: number ): void {
	if ( icon.byteLength < 24 ) {
		throw new Error( 'The generated icon is too small to contain a PNG header.' );
	}

	expect( icon.subarray( 0, 8 ) ).toEqual( pngSignature );
	expect( icon.subarray( 12, 16 ).toString( 'ascii' ) ).toBe( 'IHDR' );
	expect( icon.readUInt32BE( 16 ) ).toBe( expectedSize );
	expect( icon.readUInt32BE( 20 ) ).toBe( expectedSize );
}

/**
 * Verifies that an extension document starts on a hidden, non-bright canvas until preferences load.
 * @param html - Generated extension document markup.
 * @since 0.1.0 Initial implementation.
 */
function expectPreferencesBootstrap( html: string ): void {
	expect( html ).toContain( 'color-scheme: dark' );
	expect( html ).toContain( 'background: Canvas' );
	expect( html ).toContain( 'visibility: hidden' );
}

/**
 * Verifies that the generated popup loads the expected shell component.
 * @param outputUrl - Browser output-directory URL.
 * @return Promise resolved after all popup-composition assertions pass.
 */
async function expectPopupComposition( outputUrl: URL ): Promise<void> {
	const popupHtml = await readOutputFile( outputUrl, 'popup.html' );
	const moduleScript = popupHtml.match( /<script\s[^>]*type="module"[^>]*src="([^"]+)"/u );
	const moduleSource = moduleScript?.[ 1 ];

	expectPreferencesBootstrap( popupHtml );
	expect( popupHtml ).toContain( '<tocus-f-popup-shell>' );
	expect( moduleSource ).toBeDefined();

	if ( moduleSource === undefined ) {
		throw new Error( 'The generated popup is missing its module script.' );
	}

	const moduleCode = await readOutputFile( outputUrl, moduleSource.replace( /^\//u, '' ) );

	expect( moduleCode ).toContain( 'tocus-f-popup-shell' );
}

/**
 * Verifies that the generated options page loads the settings shell component.
 * @param outputUrl - Browser output-directory URL.
 * @return Promise resolved after all options-page composition assertions pass.
 * @since 0.1.0 Initial implementation.
 */
async function expectOptionsComposition( outputUrl: URL ): Promise<void> {
	const optionsHtml = await readOutputFile( outputUrl, 'options.html' );
	const moduleScript = optionsHtml.match( /<script\s[^>]*type="module"[^>]*src="([^"]+)"/u );
	const moduleSource = moduleScript?.[ 1 ];

	expectPreferencesBootstrap( optionsHtml );
	expect( optionsHtml ).toContain( '<tocus-f-settings-shell>' );
	expect( moduleSource ).toBeDefined();

	if ( moduleSource === undefined ) {
		throw new Error( 'The generated options page is missing its module script.' );
	}

	const moduleCode = await readOutputFile( outputUrl, moduleSource.replace( /^\//u, '' ) );

	expect( moduleCode ).toContain( 'tocus-f-settings-shell' );
}

/**
 * Verifies that generated onboarding loads its shell and all local suggestion icons.
 * @param outputUrl - Browser output-directory URL.
 * @return Promise resolved after onboarding composition assertions pass.
 * @since 0.1.0 Initial implementation.
 */
async function expectOnboardingComposition( outputUrl: URL ): Promise<void> {
	const onboardingHtml = await readOutputFile( outputUrl, 'onboarding.html' );
	const moduleScript = onboardingHtml.match( /<script\s[^>]*type="module"[^>]*src="([^"]+)"/u );
	const moduleSource = moduleScript?.[ 1 ];

	expectPreferencesBootstrap( onboardingHtml );
	expect( onboardingHtml ).toContain( '<tocus-f-onboarding-shell>' );
	expect( moduleSource ).toBeDefined();

	if ( moduleSource === undefined ) {
		throw new Error( 'The generated onboarding page is missing its module script.' );
	}

	const moduleCode = await readOutputFile( outputUrl, moduleSource.replace( /^\//u, '' ) );
	const iconDataUrls = moduleCode.match( /data:image\/svg\+xml,[^`]+/gu ) ?? [];

	expect( moduleCode ).toContain( 'tocus-f-onboarding-shell' );
	expect( iconDataUrls ).toHaveLength( expectedOnboardingSiteNames.length );
	expect( new Set( iconDataUrls ).size ).toBe( expectedOnboardingSiteNames.length );

	for ( const siteName of expectedOnboardingSiteNames ) {
		expect( moduleCode ).toContain( `displayName:\`${ siteName }\`` );
	}
}

/**
 * Verifies that the generated interruption page loads its approved screen component.
 * @param outputUrl - Browser output-directory URL.
 * @return Promise resolved after all interruption-page composition assertions pass.
 */
async function expectInterruptionComposition( outputUrl: URL ): Promise<void> {
	const interruptionHtml = await readOutputFile( outputUrl, 'interruption.html' );
	const moduleScript = interruptionHtml.match( /<script\s[^>]*type="module"[^>]*src="([^"]+)"/u );
	const moduleSource = moduleScript?.[ 1 ];

	expectPreferencesBootstrap( interruptionHtml );
	expect( interruptionHtml ).toContain( '<tocus-f-interruption-screen>' );
	expect( moduleSource ).toBeDefined();

	if ( moduleSource === undefined ) {
		throw new Error( 'The generated interruption page is missing its module script.' );
	}

	const moduleCode = await readOutputFile( outputUrl, moduleSource.replace( /^\//u, '' ) );

	expect( moduleCode ).toContain( 'tocus-f-interruption-screen' );
}

/**
 * Verifies that on-demand protected-page resources contain the isolated layer and bundled brand font.
 * @param outputUrl - Browser output-directory URL.
 * @return Promise resolved after protected-page resource assertions pass.
 * @since 0.1.0 Initial implementation.
 */
async function expectProtectedPageComposition( outputUrl: URL ): Promise<void> {
	const moduleCode = await readOutputFile( outputUrl, 'protected-page.js' );
	const fontStyles = await readOutputFile( outputUrl, 'assets/protected-page-font.css' );
	const fontResourceUrls = fontStyles.match( /\/assets\/protected-page-font\d*\.woff2/gu ) ?? [];

	expect( moduleCode ).toContain( 'tocus-f-protected-page-layer' );
	expect( moduleCode ).toContain( 'get-protected-page-presentation-status' );
	expect( fontStyles ).toContain( '@font-face' );
	expect( fontStyles ).toContain( 'Fredoka Variable' );
	expect( fontStyles ).not.toMatch( /url\((?:["'])?https?:/u );
	expect( [ ...fontResourceUrls ].sort() ).toEqual(
		expectedProtectedPageFontResources.map( ( resource ) => `/${ resource }` ).sort(),
	);

	for ( const resource of expectedProtectedPageFontResources ) {
		const font = await readOutputBuffer( outputUrl, resource );

		expect( font.byteLength ).toBeGreaterThan( 0 );
	}
}

/**
 * Verifies one classic runtime stays self-contained and excludes unrelated settings copy.
 * @param outputUrl - Browser output-directory URL.
 * @param filePath - Classic background or injected-script path.
 * @return Promise resolved after compatibility and size assertions pass.
 * @since 0.1.0 Initial implementation.
 */
async function expectClassicRuntimeLocalization(
	outputUrl: URL,
	filePath: string,
): Promise<void> {
	const source = await readOutputFile( outputUrl, filePath );
	const contents = await readOutputBuffer( outputUrl, filePath );

	expect( source ).not.toContain( 'import(' );
	expect( source ).not.toContain( settingsOnlyMessage );
	expect( contents.byteLength ).toBeLessThanOrEqual( maximumClassicRuntimeBytes );
}

/**
 * Verifies that a generated manifest avoids unnecessary browsing permissions.
 * @param manifest - Parsed generated manifest.
 * @since 0.1.0 Initial implementation.
 */
function expectNoUnnecessaryBrowsingPermissions( manifest: unknown ): void {
	expect( manifest ).not.toHaveProperty( 'host_permissions' );
	expect( manifest ).not.toHaveProperty( 'content_scripts' );
	expect( manifest ).not.toHaveProperty( 'permissions', expect.arrayContaining( [ 'history' ] ) );
	expect( manifest ).not.toHaveProperty( 'permissions', expect.arrayContaining( [ 'tabs' ] ) );
	expect( manifest ).not.toHaveProperty( 'permissions', expect.arrayContaining( [ 'webRequest' ] ) );
}

/**
 * Verifies that a generated manifest contains a valid nonzero extension version.
 * @param manifest - Parsed generated manifest.
 */
function expectValidExtensionVersion( manifest: unknown ): void {
	if (
		typeof manifest !== 'object' ||
		manifest === null ||
		! ( 'version' in manifest ) ||
		typeof manifest.version !== 'string'
	) {
		throw new TypeError( 'The generated manifest is missing a string version.' );
	}

	const versionParts = manifest.version.split( '.' );

	expect( versionParts ).toHaveLength( 3 );
	expect( versionParts ).toEqual( versionParts.map( ( part ) => String( Number.parseInt( part, 10 ) ) ) );
	expect(
		versionParts.every( ( part ) => {
			const value = Number( part );

			return Number.isInteger( value ) && value >= 0 && value <= 65_535;
		} ),
	).toBe( true );
	expect( versionParts.some( ( part ) => Number( part ) !== 0 ) ).toBe( true );
}

describe( 'extension build manifest', () => {
	test( 'generates browser locale messages without authored public translations', async () => {
		for ( const locale of expectedManifestLocales ) {
			await expect(
				access( new URL( `../../public/_locales/${ locale }/messages.json`, import.meta.url ) ),
			).rejects.toThrow();
		}
	} );

	test( 'produces a minimal Chrome extension manifest', async () => {
		const manifest = await readManifest( chromeManifestUrl );

		expect( manifest ).toMatchObject( {
			default_locale: 'en',
			incognito: 'not_allowed',
			manifest_version: 3,
			name: '__MSG_extensionName__',
			description: '__MSG_extensionDescription__',
			minimum_chrome_version: '120',
			action: { default_popup: 'popup.html' },
			background: { service_worker: 'background.js' },
			options_ui: { page: 'options.html', open_in_tab: true },
		} );
		expect( manifest ).not.toHaveProperty( 'browser_specific_settings' );
		expect( manifest ).toHaveProperty( 'icons', expectedExtensionIcons );
		expect( manifest ).toHaveProperty( 'action.default_icon', expectedToolbarIcons );
		expect( manifest ).toHaveProperty( 'permissions', [
			'storage',
			'activeTab',
			'favicon',
			'alarms',
			'declarativeNetRequestWithHostAccess',
			'scripting',
		] );
		expect( manifest ).toHaveProperty( 'optional_permissions', [ 'webNavigation' ] );
		expect( manifest ).toHaveProperty( 'optional_host_permissions', [ '*://*/*' ] );
		expect( manifest ).toHaveProperty( 'web_accessible_resources', [ {
			matches: expectedProtectedPageMatches,
			resources: expectedProtectedPageResources,
			use_dynamic_url: false,
		} ] );
		expectNoUnnecessaryBrowsingPermissions( manifest );
		expectValidExtensionVersion( manifest );
	} );

	test( 'produces a minimal Firefox extension manifest with an explicit no-data declaration', async () => {
		const manifest = await readManifest( firefoxManifestUrl );

		expect( manifest ).toMatchObject( {
			default_locale: 'en',
			incognito: 'not_allowed',
			manifest_version: 2,
			name: '__MSG_extensionName__',
			description: '__MSG_extensionDescription__',
			browser_action: { default_popup: 'popup.html' },
			background: { scripts: [ 'background.js' ], persistent: false },
			options_ui: { page: 'options.html', open_in_tab: true },
			browser_specific_settings: {
				gecko: {
					id: 'tocus@agustinbarrientos.github.io',
					strict_min_version: '140.0',
					data_collection_permissions: { required: [ 'none' ] },
				},
			},
		} );
		expect( manifest ).not.toHaveProperty( 'browser_specific_settings.gecko.data_collection_permissions.optional' );
		expect( manifest ).toHaveProperty( 'icons', expectedExtensionIcons );
		expect( manifest ).toHaveProperty( 'browser_action.default_icon', expectedToolbarIcons );
		expect( manifest ).toHaveProperty( 'permissions', [
			'storage',
			'activeTab',
			'alarms',
			'declarativeNetRequestWithHostAccess',
			'scripting',
		] );
		expect( manifest ).toHaveProperty( 'optional_permissions', [
			'webNavigation',
			'*://*/*',
		] );
		expect( manifest ).toHaveProperty( 'web_accessible_resources', expectedProtectedPageResources );
		expectNoUnnecessaryBrowsingPermissions( manifest );
		expectValidExtensionVersion( manifest );
	} );

	test( 'produces a minimal Safari extension manifest with local storage only', async () => {
		const manifest = await readManifest( safariManifestUrl );

		expect( manifest ).toMatchObject( {
			default_locale: 'en',
			manifest_version: 2,
			name: '__MSG_extensionName__',
			description: '__MSG_extensionDescription__',
			browser_action: { default_popup: 'popup.html' },
			background: { scripts: [ 'background.js' ], persistent: false },
			options_ui: { page: 'options.html' },
			browser_specific_settings: {
				safari: { strict_min_version: '16.4' },
			},
		} );
		expect( manifest ).not.toHaveProperty( 'incognito' );
		expect( manifest ).not.toHaveProperty( 'options_ui.open_in_tab' );
		expect( manifest ).toHaveProperty( 'icons', expectedExtensionIcons );
		expect( manifest ).toHaveProperty( 'browser_action.default_icon', expectedToolbarIcons );
		expect( manifest ).toHaveProperty( 'permissions', [
			'storage',
			'activeTab',
			'alarms',
			'declarativeNetRequestWithHostAccess',
			'scripting',
		] );
		expect( manifest ).toHaveProperty( 'optional_permissions', [
			'webNavigation',
			'*://*/*',
		] );
		expect( manifest ).toHaveProperty( 'web_accessible_resources', expectedProtectedPageResources );
		expectNoUnnecessaryBrowsingPermissions( manifest );
		expectValidExtensionVersion( manifest );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'connects the generated %s popup to its component implementation', async ( _browser, outputUrl ) => {
		await expectPopupComposition( outputUrl );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'connects the generated %s options page to its settings shell', async ( _browser, outputUrl ) => {
		await expectOptionsComposition( outputUrl );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'packages the generated %s onboarding page and its local site icons', async ( _browser, outputUrl ) => {
		await expectOnboardingComposition( outputUrl );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'connects the generated %s interruption page to its screen', async ( _browser, outputUrl ) => {
		await expectInterruptionComposition( outputUrl );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'packages the isolated %s protected-page layer and brand font', async ( _browser, outputUrl ) => {
		await expectProtectedPageComposition( outputUrl );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'packages complete localized %s manifest metadata', async ( _browser, outputUrl ) => {
		await expectLocalizedManifestMessages( outputUrl );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'keeps %s classic runtimes compatible and within their localization budget', async ( _browser, outputUrl ) => {
		await expectClassicRuntimeLocalization( outputUrl, 'background.js' );
		await expectClassicRuntimeLocalization( outputUrl, 'protected-page.js' );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
		[ 'Safari', safariOutputUrl ],
	] )( 'generates every declared %s icon at its declared dimensions', async ( _browser, outputUrl ) => {
		for ( const [ size, iconPath ] of Object.entries( expectedExtensionIcons ) ) {
			const icon = await readOutputBuffer( outputUrl, iconPath );

			expectSquarePng( icon, Number( size ) );
		}
	} );

	test( 'keeps the theme icon recolorable with a brown standalone fallback', async () => {
		const iconSource = await readFile( fileURLToPath( themeIconUrl ), 'utf8' );

		expect( iconSource ).toContain( 'fill="currentColor"' );
		expect( iconSource ).toContain( 'color="#744331"' );
	} );
} );
