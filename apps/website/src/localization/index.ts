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
		eyebrow: i18n._( msg`Open-source browser extension` ),
		intro: i18n._( msg`Pause before you scroll.` ),
		description: i18n._( msg`TOCus adds a breathing pause to the websites you choose.` ),
		sourceLink: i18n._( msg`Explore the source on GitHub` ),
		privacy: i18n._( msg`Settings and statistics stay in your browser. TOCus works without an internet connection.` ),
		howTitle: i18n._( msg`How TOCus works.` ),
		chooseTitle: i18n._( msg`Choose the websites to pause.` ),
		chooseDescription: i18n._( msg`Select the sites where you want a pause.` ),
		chooseLabel: i18n._( msg`Choose sites` ),
		visitLabel: i18n._( msg`Open a site` ),
		pauseLabel: i18n._( msg`Breathe` ),
		continueLabel: i18n._( msg`Continue` ),
		browseLabel: i18n._( msg`Browse` ),
		visitTitle: i18n._( msg`Visit a website` ),
		visitDescription: i18n._( msg`Open a website you added to TOCus.` ),
		pauseTitle: i18n._( msg`Take a moment before you continue.` ),
		pauseDescription: i18n._( msg`Follow the breathing guide. Your browsing time has not started yet.` ),
		continueTitle: i18n._( msg`Continue after the pause` ),
		continueDescription: i18n._( msg`When the wait ends, select Continue to open the website, or close the tab.` ),
		browseTitle: i18n._( msg`Browse for five minutes` ),
		browseDescription: i18n._( msg`By default, the next pause comes five minutes after you select Continue.` ),
		settingsTitle: i18n._( msg`Set the pause to fit your day.` ),
		timingTitle: i18n._( msg`Pause and browsing time` ),
		timingDescription: i18n._( msg`Choose your wait, browsing time, and schedule.` ),
		timingPause: i18n._( msg`10s pause` ),
		timingBrowse: i18n._( msg`5m browsing` ),
		exampleTiming: i18n._( msg`Example timing` ),
		scheduleTitle: i18n._( msg`Only when you want` ),
		scheduleDescription: i18n._( msg`Set the days and hours TOCus is active.` ),
		appearanceTitle: i18n._( msg`Appearance` ),
		appearanceDescription: i18n._( msg`Six palettes with light, dark, or system appearance. Turn off breathing guidance or use reduced motion.` ),
		statisticsTitle: i18n._( msg`See your progress.` ),
		statisticsDescription: i18n._( msg`Pauses taken. Visits reconsidered.` ),
		exampleData: i18n._( msg`Example data` ),
		mediaTitle: i18n._( msg`Your video pauses, too.` ),
		mediaDescription: i18n._( msg`On supported sites, playing videos pause and resume when you continue.` ),
		sitesTitle: i18n._( msg`Different sites, different timing` ),
		sitesDescription: i18n._( msg`Give any website its own wait and schedule.` ),
		privacyTitle: i18n._( msg`100% private.` ),
		privacyAccounts: i18n._( msg`No accounts.` ),
		privacyTracking: i18n._( msg`No tracking.` ),
		privacyCalls: i18n._( msg`No external calls.` ),
		privacyLocal: i18n._( msg`Your data stays on your device.` ),
		openSourceTitle: i18n._( msg`Free and open source.` ),
		openSourceDescription: i18n._( msg`Read the code, suggest changes, or make it your own.` ),
		authorLink: i18n._( msg`Meet the creator` ),
		previewCaption: i18n._( msg`A preview of the breathing pause.` ),
		previewPhase: i18n._( msg`Breathe in` ),
		getExtension: i18n._( msg`Download TOCus` ),
		howLink: i18n._( msg`How it works` ),
		alsoAvailable: i18n._( msg`Also available on` ),
		comingSoon: i18n._( msg`Coming soon` ),
		downloadTitle: i18n._( msg`Add a pause to your browser.` ),
		downloadDescription: i18n._( msg`A short pause before the websites you choose.` ),
		downloadFor: i18n._( msg`Download for` ),
		readPrivacy: i18n._( msg`Read the privacy policy` ),
		freeLabel: i18n._( msg`Free and open source` ),
		mascotAlt: i18n._( msg`A smiling capybara peeking over the browser` ),
		demoLabel: i18n._( msg`How TOCus works.` ),
		demoSiteSelected: i18n._( msg`Website added` ),
		demoTimeLeft: i18n._( msg`Time left` ),
		privacyLink: i18n._( msg`Privacy` ),
		supportLink: i18n._( msg`Support` ),
		madeBy: i18n._( msg`Made by` ),
		creatorStory: i18n._( msg`For anyone who needs a moment away from everything online.` ),
		privacyShort: i18n._( msg`No account. No tracking.` ),
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
