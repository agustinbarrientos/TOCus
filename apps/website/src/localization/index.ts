import { setupI18n, type I18n, type Messages } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { messages as germanMessages } from '../../locales/de.po';
import { messages as englishMessages } from '../../locales/en.po';
import { messages as spanishTuMessages } from '../../locales/es.po';
import { messages as spanishVosMessages } from '../../locales/es-AR.po';
import { messages as frenchMessages } from '../../locales/fr.po';
import { messages as italianMessages } from '../../locales/it.po';
import { messages as japaneseMessages } from '../../locales/ja.po';
import { messages as portugueseBrazilMessages } from '../../locales/pt-BR.po';
import { messages as portuguesePortugalMessages } from '../../locales/pt-PT.po';
import { messages as russianMessages } from '../../locales/ru.po';
import {
	WebsiteLanguage,
	type WebsiteCatalog,
	type WebsiteLanguage as WebsiteLanguageValue,
	type WebsiteLanguageMetadata,
	type WebsiteLocalization,
} from './types';

/**
 * Website languages in stable language-menu order.
 * @since 0.1.0 Initial implementation.
 */
export const WebsiteLanguages: ReadonlyArray<WebsiteLanguageValue> = Object.freeze( [
	WebsiteLanguage.ENGLISH,
	WebsiteLanguage.SPANISH_TU,
	WebsiteLanguage.SPANISH_VOS,
	WebsiteLanguage.PORTUGUESE_BRAZIL,
	WebsiteLanguage.PORTUGUESE_PORTUGAL,
	WebsiteLanguage.ITALIAN,
	WebsiteLanguage.FRENCH,
	WebsiteLanguage.GERMAN,
	WebsiteLanguage.JAPANESE,
	WebsiteLanguage.RUSSIAN,
] );

/**
 * Compiled website messages indexed by stable language value.
 * @since 0.1.0 Initial implementation.
 */
const WebsiteMessagesByLanguage: Readonly<Record<WebsiteLanguageValue, Messages>> = Object.freeze( {
	[ WebsiteLanguage.ENGLISH ]: englishMessages,
	[ WebsiteLanguage.SPANISH_TU ]: spanishTuMessages,
	[ WebsiteLanguage.SPANISH_VOS ]: spanishVosMessages,
	[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: portugueseBrazilMessages,
	[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: portuguesePortugalMessages,
	[ WebsiteLanguage.ITALIAN ]: italianMessages,
	[ WebsiteLanguage.FRENCH ]: frenchMessages,
	[ WebsiteLanguage.GERMAN ]: germanMessages,
	[ WebsiteLanguage.JAPANESE ]: japaneseMessages,
	[ WebsiteLanguage.RUSSIAN ]: russianMessages,
} );

/**
 * Non-translatable route metadata indexed by language.
 * @since 0.1.0 Initial implementation.
 */
const WebsiteLanguageMetadataByLanguage: Readonly<Record<WebsiteLanguageValue, WebsiteLanguageMetadata>> =
	Object.freeze( {
		[ WebsiteLanguage.ENGLISH ]: { languageTag: 'en', path: '/' },
		[ WebsiteLanguage.SPANISH_TU ]: { languageTag: 'es', path: '/es/' },
		[ WebsiteLanguage.SPANISH_VOS ]: { languageTag: 'es-AR', path: '/es-ar/' },
		[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: {
			languageTag: 'pt-BR',
			path: '/pt-br/',
		},
		[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: {
			languageTag: 'pt-PT',
			path: '/pt-pt/',
		},
		[ WebsiteLanguage.ITALIAN ]: { languageTag: 'it', path: '/it/' },
		[ WebsiteLanguage.FRENCH ]: { languageTag: 'fr', path: '/fr/' },
		[ WebsiteLanguage.GERMAN ]: { languageTag: 'de', path: '/de/' },
		[ WebsiteLanguage.JAPANESE ]: { languageTag: 'ja', path: '/ja/' },
		[ WebsiteLanguage.RUSSIAN ]: { languageTag: 'ru', path: '/ru/' },
	} );

/**
 * Creates the translated website copy used by one static page.
 * @param i18n - Page-local Lingui instance activated for the selected language.
 * @return Complete localized website catalog.
 * @since 0.1.0 Initial implementation.
 */
function createWebsiteCatalog( i18n: I18n ): Readonly<WebsiteCatalog> {
	return Object.freeze( {
		metadata: Object.freeze( {
			description: i18n._( msg`TOCus is an open-source browser extension.` ),
		} ),
		intro: i18n._( msg`Pause before visiting addictive websites` ),
		description: i18n._( msg`TOCus adds a breathing pause to the websites you choose.` ),
		sourceLink: i18n._( msg`Source` ),
		privacy: i18n._( msg`Your settings and stats stay in your browser. It even works offline and needs no account.` ),
		stepOpen: i18n._( msg`Open a site` ),
		stepPause: i18n._( msg`10s pause` ),
		stepContinue: i18n._( msg`Continue` ),
		stepBrowse: i18n._( msg`5m browsing` ),
		featuresTitle: i18n._( msg`A calmer way to browse` ),
		scheduleTitle: i18n._( msg`Use it only when you want to` ),
		scheduleDescription: i18n._( msg`Choose the days and hours TOCus is active.` ),
		sitesTitle: i18n._( msg`Set a custom schedule for each site` ),
		sitesDescription: i18n._( msg`Pick different days and times for each site.` ),
		mediaTitle: i18n._( msg`Your videos will pause automatically` ),
		mediaDescription: i18n._( msg`Videos pause while you wait and resume when you\u2019re ready.` ),
		mediaServices: i18n._( msg`Works with` ),
		statisticsTitle: i18n._( msg`Check how much time you\u2019ve saved` ),
		statisticsDescription: i18n._( msg`View your completed pauses and visits you changed your mind about.` ),
		privacyLocal: i18n._( msg`Everything is stored on your device` ),
		openSourceTitle: i18n._( msg`It\u2019s free and open source` ),
		openSourceDescription: i18n._( msg`You can read the code, suggest changes, or make it your own. There\u2019s no advertising.` ),
		alsoAvailable: i18n._( msg`Also available on` ),
		comingSoon: i18n._( msg`Coming soon` ),
		downloadTitle: i18n._( msg`Take a moment to pause.` ),
		downloadFor: i18n._( msg`Download for` ),
		readPrivacy: i18n._( msg`Privacy policy` ),
		privacyLink: i18n._( msg`Privacy` ),
		madeBy: i18n._( msg`Made by` ),
		sourceShort: i18n._( msg`View the source` ),
		skipLink: i18n._( msg`Skip to content` ),
		languageMenuLabel: i18n._( msg`Website language` ),
		languageLabels: Object.freeze( {
			[ WebsiteLanguage.ENGLISH ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in English.',
				message: 'English',
			} ) ),
			[ WebsiteLanguage.SPANISH_TU ]: i18n._( msg( {
				comment: 'Language-menu autonym for the tuteo variant. Keep this language name written in Spanish.',
				message: 'Espa\u00f1ol (t\u00fa)',
			} ) ),
			[ WebsiteLanguage.SPANISH_VOS ]: i18n._( msg( {
				comment: 'Language-menu autonym for the voseo variant. Keep this language name written in Spanish.',
				message: 'Espa\u00f1ol (vos)',
			} ) ),
			[ WebsiteLanguage.PORTUGUESE_BRAZIL ]: i18n._( msg( {
				comment: 'Language-menu autonym for Brazilian Portuguese. Keep this language name written in Portuguese.',
				message: 'Portugu\u00eas (Brasil)',
			} ) ),
			[ WebsiteLanguage.PORTUGUESE_PORTUGAL ]: i18n._( msg( {
				comment: 'Language-menu autonym for European Portuguese. Keep this language name written in Portuguese.',
				message: 'Portugu\u00eas (Portugal)',
			} ) ),
			[ WebsiteLanguage.ITALIAN ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in Italian.',
				message: 'Italiano',
			} ) ),
			[ WebsiteLanguage.FRENCH ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in French.',
				message: 'Fran\u00e7ais',
			} ) ),
			[ WebsiteLanguage.GERMAN ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in German.',
				message: 'Deutsch',
			} ) ),
			[ WebsiteLanguage.JAPANESE ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in Japanese.',
				message: '\u65e5\u672c\u8a9e',
			} ) ),
			[ WebsiteLanguage.RUSSIAN ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in Russian.',
				message: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
			} ) ),
		} ),
	} );
}

/**
 * Returns one complete localized website projection.
 * @param language - Stable website language.
 * @return Catalog, route, and document language for the selected language.
 * @since 0.1.0 Initial implementation.
 */
export function getWebsiteLocalization( language: WebsiteLanguageValue ): Readonly<WebsiteLocalization> {
	const metadata = WebsiteLanguageMetadataByLanguage[ language ];
	const i18n = setupI18n( {
		locale: metadata.languageTag,
		messages: { [ metadata.languageTag ]: WebsiteMessagesByLanguage[ language ] },
	} );

	return Object.freeze( {
		language,
		catalog: createWebsiteCatalog( i18n ),
		...metadata,
	} );
}

/**
 * Returns every localized website projection in stable language-menu order.
 * @return Complete supported website localizations.
 * @since 0.1.0 Initial implementation.
 */
export function getWebsiteLocalizations(): ReadonlyArray<Readonly<WebsiteLocalization>> {
	return WebsiteLanguages.map( getWebsiteLocalization );
}

export {
	WebsiteLanguage,
	type LocalizedHomePageProperties,
	type LocalizedWebsitePageProperties,
	type WebsiteCatalog,
	type WebsiteLocalization,
} from './types';
