import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Language } from '../../../domains/preferences/types';
import { type LanguageScreenCopy } from '../../../features/settings/components/language-screen/types';

/**
 * Creates localized Language-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Language-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createLanguageScreenCopy( i18n: I18n ): Readonly<LanguageScreenCopy> {
	/**
	 * Formats the current browser-derived language explanation.
	 * @param name - Autonym for the resolved browser language.
	 * @return Complete localized helper sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatBrowserLanguageDescription( name: string ): string {
		return i18n._( msg`Your browser currently selects ${ { name } }.` );
	}

	return Object.freeze( {
		eyebrow: i18n._( msg`Personalization` ),
		title: i18n._( msg`Language` ),
		introduction: i18n._( msg`Choose the language TOCus uses across the extension.` ),
		formLabel: i18n._( msg`Language preference` ),
		languageLabel: i18n._( msg`TOCus language` ),
		languageLabels: Object.freeze( {
			[ Language.ENGLISH ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in English.',
				message: 'English',
			} ) ),
			[ Language.SPANISH_TU ]: i18n._( msg( {
				comment: 'Language-menu autonym for the tuteo variant. Keep this language name written in Spanish.',
				message: 'Espa\u00f1ol (t\u00fa)',
			} ) ),
			[ Language.SPANISH_VOS ]: i18n._( msg( {
				comment: 'Language-menu autonym for the voseo variant. Keep this language name written in Spanish.',
				message: 'Espa\u00f1ol (vos)',
			} ) ),
			[ Language.PORTUGUESE_BRAZIL ]: i18n._( msg( {
				comment: 'Language-menu autonym for Brazilian Portuguese. Keep this language name written in Portuguese.',
				message: 'Portugu\u00eas (Brasil)',
			} ) ),
			[ Language.PORTUGUESE_PORTUGAL ]: i18n._( msg( {
				comment: 'Language-menu autonym for European Portuguese. Keep this language name written in Portuguese.',
				message: 'Portugu\u00eas (Portugal)',
			} ) ),
			[ Language.ITALIAN ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in Italian.',
				message: 'Italiano',
			} ) ),
			[ Language.FRENCH ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in French.',
				message: 'Fran\u00e7ais',
			} ) ),
			[ Language.GERMAN ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in German.',
				message: 'Deutsch',
			} ) ),
			[ Language.JAPANESE ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in Japanese.',
				message: '\u65e5\u672c\u8a9e',
			} ) ),
			[ Language.RUSSIAN ]: i18n._( msg( {
				comment: 'Language-menu autonym. Keep this language name written in Russian.',
				message: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
			} ) ),
		} ),
		browserLanguageOption: i18n._( msg`Use browser language` ),
		explicitLanguageDescription: i18n._( msg`TOCus will keep using this language until you change it.` ),
		loading: i18n._( msg`Loading language settings...` ),
		malformedDataTitle: i18n._( msg`Personalization settings need your attention` ),
		malformedDataDescription: i18n._(
			msg`Your local personalization data is not valid. Restoring defaults will reset appearance, pause, motion, and language preferences.`,
		),
		loadErrorTitle: i18n._( msg`Language settings could not load` ),
		loadErrorDescription: i18n._( msg`TOCus could not load your local language setting. Nothing was changed.` ),
		retry: i18n._( msg`Try again` ),
		restoreDefaults: i18n._( msg`Restore personalization defaults` ),
		restoreDefaultsError: i18n._( msg`TOCus could not restore your personalization defaults. Nothing was changed.` ),
		saveError: i18n._( msg`Your language could not be saved. TOCus returned to your previous language.` ),
		savedAnnouncement: i18n._( msg`Language saved.` ),
		restoredAnnouncement: i18n._( msg`Personalization defaults restored.` ),
		formatBrowserLanguageDescription,
	} );
}
