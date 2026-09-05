import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import {
	OnboardingLanguageFamily,
	type OnboardingLanguageStepCopy,
} from '../../../features/onboarding/components/language-step/types';

/**
 * Creates localized onboarding Language-step copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Language-step copy.
 * @since 0.1.0 Initial implementation.
 */
export function createOnboardingLanguageStepCopy( i18n: I18n ): Readonly<OnboardingLanguageStepCopy> {
	return Object.freeze( {
		title: i18n._( msg`Choose your language` ),
		introduction: i18n._( msg`TOCus will use it everywhere. You can change it later in Settings.` ),
		languageLegend: i18n._( msg`Language` ),
		languageLabels: Object.freeze( {
			[ OnboardingLanguageFamily.ENGLISH ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in English.',
				message: 'English',
			} ) ),
			[ OnboardingLanguageFamily.SPANISH ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in Spanish.',
				message: 'Espa\u00f1ol',
			} ) ),
			[ OnboardingLanguageFamily.PORTUGUESE ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in Portuguese.',
				message: 'Portugu\u00eas',
			} ) ),
			[ OnboardingLanguageFamily.ITALIAN ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in Italian.',
				message: 'Italiano',
			} ) ),
			[ OnboardingLanguageFamily.FRENCH ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in French.',
				message: 'Fran\u00e7ais',
			} ) ),
			[ OnboardingLanguageFamily.GERMAN ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in German.',
				message: 'Deutsch',
			} ) ),
			[ OnboardingLanguageFamily.JAPANESE ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in Japanese.',
				message: '\u65e5\u672c\u8a9e',
			} ) ),
			[ OnboardingLanguageFamily.RUSSIAN ]: i18n._( msg( {
				comment: 'Language autonym. Keep the language name written in Russian.',
				message: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
			} ) ),
		} ),
		spanishVariantLegend: i18n._( msg`Which Spanish should TOCus use?` ),
		spanishTuLabel: i18n._( msg( {
			comment: 'Conversational Spanish variant name. Keep this label written in Spanish.',
			message: 'T\u00fa',
		} ) ),
		spanishVosLabel: i18n._( msg`Vos` ),
		portugueseVariantLegend: i18n._( msg`Which Portuguese should TOCus use?` ),
		portugueseBrazilLabel: i18n._( msg`Brasil` ),
		portuguesePortugalLabel: i18n._( msg`Portugal` ),
		continueLabel: i18n._( msg`Continue` ),
	} );
}
