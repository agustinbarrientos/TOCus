import { describe, expect, it } from 'vitest';
import { type Language } from '../../domains/preferences/types';
import {
	SupportedLanguages,
	loadLocalizationCatalog,
} from './index';
import { createBrowserLocaleMessages } from './create-browser-locale-messages';
import { type LocalizationCatalog } from './types';

/**
 * One path and localized leaf message discovered in a catalog.
 * @since 0.1.0 Initial implementation.
 */
type CatalogLeafEntry = readonly [ string, string ];

/**
 * One supported language and its asynchronously loaded local catalog.
 * @since 0.1.0 Initial implementation.
 */
type LoadedCatalogEntry = readonly [ Language, LocalizationCatalog ];

/**
 * Exact-English catalog paths that are intentionally brand, placeholder, or linguistic invariants.
 * @since 0.1.0 Initial implementation.
 */
const allowedExactEnglishPaths = Object.freeze( {
	de: [
		'appearance.options.system.label',
		'appearance.palettes.orange',
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'schedule.startTimeLabel',
		'toolbar.activeTitle',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
	],
	'es-tu': [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'toolbar.activeTitle',
		'toolbar.allowance.completeText',
		'toolbar.allowance.lessThanMinuteText',
		'toolbar.allowance.minuteText',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
	],
	'es-vos': [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'toolbar.activeTitle',
		'toolbar.allowance.completeText',
		'toolbar.allowance.lessThanMinuteText',
		'toolbar.allowance.minuteText',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
	],
	fr: [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'appearance.palettes.orange',
		'protectedSites.addressPlaceholder',
		'protectedSites.eyebrow',
		'schedule.eyebrow',
		'schedule.independentScopeLabel',
		'timing.eyebrow',
		'toolbar.allowance.completeText',
		'toolbar.allowance.lessThanMinuteText',
		'toolbar.allowance.minuteText',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
		'units.minute.zero',
		'units.minute.one',
		'units.minute.two',
		'units.minute.few',
		'units.minute.many',
		'units.minute.other',
	],
	it: [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'toolbar.activeTitle',
		'toolbar.allowance.completeText',
		'toolbar.allowance.lessThanMinuteText',
		'toolbar.allowance.minuteText',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
	],
	ja: [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'toolbar.inactiveTitle',
		'toolbar.multipleText',
	],
	'pt-BR': [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'toolbar.activeTitle',
		'toolbar.allowance.completeText',
		'toolbar.allowance.lessThanMinuteText',
		'toolbar.allowance.minuteText',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
	],
	'pt-PT': [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'toolbar.activeTitle',
		'toolbar.allowance.completeText',
		'toolbar.allowance.lessThanMinuteText',
		'toolbar.allowance.minuteText',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
		'toolbar.waiting.minuteText',
		'toolbar.waiting.secondText',
	],
	ru: [
		'document.interruptionTitle',
		'document.popupTitle',
		'extension.name',
		'protectedSites.addressPlaceholder',
		'schedule.independentScopeLabel',
		'toolbar.activeTitle',
		'toolbar.inactiveTitle',
		'toolbar.multipleIndicator',
		'toolbar.multipleText',
		'toolbar.overflowIndicator',
	],
} satisfies Readonly<Record<Exclude<Language, 'en'>, ReadonlyArray<string>>> );

/**
 * Loads every supported catalog for cross-catalog validation in tests.
 * @return Catalog entries in stable preference-screen order.
 * @since 0.1.0 Initial implementation.
 */
async function loadAllCatalogs(): Promise<ReadonlyArray<LoadedCatalogEntry>> {
	return Promise.all( SupportedLanguages.map( async ( language ) => [
		language,
		await loadLocalizationCatalog( language ),
	] as const ) );
}

/**
 * Recursively collects every string leaf from one translator catalog.
 * @param value - Catalog value currently being inspected.
 * @param path - Dot-separated path accumulated above the value.
 * @return Deterministically ordered catalog leaf entries.
 * @since 0.1.0 Initial implementation.
 */
function collectCatalogLeafEntries( value: unknown, path = '' ): ReadonlyArray<CatalogLeafEntry> {
	if ( typeof value === 'string' ) {
		return [ [ path, value ] ];
	}

	if ( typeof value !== 'object' || value === null || Array.isArray( value ) ) {
		throw new TypeError( `Catalog value at ${ path || '<root>' } is not a string tree.` );
	}

	return Object.entries( value )
		.sort( ( [ leftKey ], [ rightKey ] ) => leftKey.localeCompare( rightKey ) )
		.flatMap( ( [ key, nestedValue ] ) => collectCatalogLeafEntries(
			nestedValue,
			path === '' ? key : `${ path }.${ key }`,
		) );
}

/**
 * Extracts sorted named placeholders from one localized message.
 * @param message - Localized message template.
 * @return Sorted placeholders including their braces.
 * @since 0.1.0 Initial implementation.
 */
function collectPlaceholders( message: string ): ReadonlyArray<string> {
	return [ ...message.matchAll( /\{[a-z][a-zA-Z0-9]*\}/gu ) ]
		.map( ( match ) => match[ 0 ] )
		.sort();
}

/**
 * Removes every supported named placeholder from one localized message.
 * @param message - Localized message template.
 * @return Message content that is not part of a supported placeholder.
 * @since 0.1.0 Initial implementation.
 */
function removeNamedPlaceholders( message: string ): string {
	return message.replace( /\{[a-z][a-zA-Z0-9]*\}/gu, '' );
}

describe( 'localization catalogs', () => {
	it( 'loads only the requested packaged catalog through the asynchronous boundary', async () => {
		await expect( loadLocalizationCatalog( 'ja' ) ).resolves.toHaveProperty(
			'document.settingsTitle',
			'TOCus の設定',
		);
	} );

	it( 'registers every approved language in stable preference order', async () => {
		expect( SupportedLanguages ).toEqual( [
			'en',
			'es-tu',
			'es-vos',
			'pt-BR',
			'pt-PT',
			'it',
			'fr',
			'de',
			'ja',
			'ru',
		] );
		expect( ( await loadAllCatalogs() ).map( ( [ language ] ) => language ) ).toEqual(
			SupportedLanguages,
		);
	} );

	it( 'includes complete browser-managed extension metadata in every catalog', async () => {
		for ( const [ language, catalog ] of await loadAllCatalogs() ) {
			expect( Object.keys( catalog ), language ).toContain( 'extension' );
			expect( createBrowserLocaleMessages( catalog.extension ) ).toEqual( {
				extensionName: {
					message: catalog.extension.name,
					description: catalog.extension.nameDescription,
				},
				extensionDescription: {
					message: catalog.extension.description,
					description: catalog.extension.descriptionDescription,
				},
			} );
		}
	} );

	it( 'keeps every translated catalog structurally identical to English', async () => {
		const catalogs = await loadAllCatalogs();
		const englishCatalog = await loadLocalizationCatalog( 'en' );
		const englishEntries = collectCatalogLeafEntries( englishCatalog );
		const englishPaths = englishEntries.map( ( [ path ] ) => path );

		expect( englishEntries ).toHaveLength( 338 );

		for ( const [ language, catalog ] of catalogs ) {
			expect(
				collectCatalogLeafEntries( catalog ).map( ( [ path ] ) => path ),
				language,
			).toEqual( englishPaths );
		}
	} );

	it( 'keeps every translated message nonempty', async () => {
		for ( const [ language, catalog ] of await loadAllCatalogs() ) {
			for ( const [ path, message ] of collectCatalogLeafEntries( catalog ) ) {
				expect( message.trim(), `${ language }:${ path }` ).not.toBe( '' );
			}
		}
	} );

	it( 'retains only audited brand, placeholder, and cognate exact-English duplicates', async () => {
		const englishEntries = new Map( collectCatalogLeafEntries( await loadLocalizationCatalog( 'en' ) ) );

		for ( const [ language, catalog ] of await loadAllCatalogs() ) {
			if ( language === 'en' ) {
				continue;
			}

			const duplicatePaths = collectCatalogLeafEntries( catalog )
				.filter( ( [ path, message ] ) => englishEntries.get( path ) === message )
				.map( ( [ path ] ) => path );

			expect( duplicatePaths.sort(), language ).toEqual(
				[ ...allowedExactEnglishPaths[ language ] ].sort(),
			);
		}
	} );

	it( 'preserves reviewed translations where a literal English carryover would be incorrect', async () => {
		const catalogs = new Map( await loadAllCatalogs() );

		expect( catalogs.get( 'fr' )?.wellbeing.neutral ).toBe( "Ce moment n'est rien que pour vous." );
		expect( catalogs.get( 'it' )?.wellbeing.focusedOnly ).toBe(
			'Da quando hai iniziato, hai dedicato {focusedPauseTime} al tuo benessere.',
		);
		expect( catalogs.get( 'de' )?.interruption.continueLabel ).toBe( 'Fortfahren' );
		expect( catalogs.get( 'de' )?.interruption.readyAnnouncement ).toContain( 'fortfahren' );
		expect( catalogs.get( 'ru' )?.schedule.sharedScope ).toBe( 'Общая защита' );
		expect( catalogs.get( 'de' )?.toolbar.allowance.minuteText ).toBe( 'B{count}m' );
		expect( catalogs.get( 'ja' )?.toolbar.waiting.secondText ).toBe( '休{count}秒' );
		expect( catalogs.get( 'ru' )?.toolbar.waiting.secondText ).toBe( 'П{count}с' );
	} );

	it( 'preserves every named placeholder used by the English source message', async () => {
		const englishCatalog = await loadLocalizationCatalog( 'en' );
		const englishEntries = new Map( collectCatalogLeafEntries( englishCatalog ) );

		for ( const [ language, catalog ] of await loadAllCatalogs() ) {
			for ( const [ path, message ] of collectCatalogLeafEntries( catalog ) ) {
				expect( collectPlaceholders( message ), `${ language }:${ path }` ).toEqual(
					collectPlaceholders( englishEntries.get( path ) ?? '' ),
				);
			}
		}
	} );

	it( 'rejects unsupported or unmatched placeholder braces', async () => {
		for ( const [ language, catalog ] of await loadAllCatalogs() ) {
			for ( const [ path, message ] of collectCatalogLeafEntries( catalog ) ) {
				expect(
					removeNamedPlaceholders( message ),
					`${ language }:${ path }`,
				).not.toMatch( /[{}]/u );
			}
		}
	} );
} );
