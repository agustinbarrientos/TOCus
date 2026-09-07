import type { LanguageScreenCopy } from '../../language-screen/types';

/**
 * Restores the archived long-copy German wrapping scenario without changing application catalogs.
 * @param english - Complete canonical copy supplying the unchanged language names and recovery states.
 * @return Original visible German labels and explanation used by the immutable narrow screenshot.
 * @since 0.1.0
 */
export function originalLanguageCopy( english: LanguageScreenCopy ): LanguageScreenCopy {
	return {
		...english,
		eyebrow: 'Personalisierung',
		title: 'Sprache',
		introduction: 'Wählen Sie die Sprache, die TOCus in der gesamten Browser-Erweiterung für alle Hinweise und Einstellungen verwendet.',
		formLabel: 'Spracheinstellung',
		languageLabel: 'Sprache der TOCus-Benutzeroberfläche',
		browserLanguageOption: 'Spracheinstellungen des Browsers automatisch verwenden',
		save: 'Speichern',
		discard: 'Verwerfen',
		/**
		 * Preserves the original expanded browser-language explanation for line-wrapping coverage.
		 * @param languageName - Native name of the browser's effective language.
		 * @return Archived German sentence.
		 */
		formatBrowserLanguageDescription: ( languageName ) =>
			`Ihr Browser verwendet derzeit automatisch ${ languageName } für alle Hinweise und Einstellungen.`,
	};
}
