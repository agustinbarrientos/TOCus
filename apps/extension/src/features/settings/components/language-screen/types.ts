import {
	type Language as LanguageValue,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';

/**
 * Stable loading states rendered by the Language settings screen.
 * @since 0.1.0 Initial implementation.
 */
export const LanguageScreenLoadStatus = {
	FAILED: 'failed',
	LOADING: 'loading',
	MALFORMED: 'malformed',
	READY: 'ready',
} as const;

/**
 * Current loading state rendered by the Language settings screen.
 * @since 0.1.0 Initial implementation.
 */
export type LanguageScreenLoadStatus = typeof LanguageScreenLoadStatus[
	keyof typeof LanguageScreenLoadStatus
];

/**
 * Native select change whose current target is the language control.
 * @since 0.1.0 Initial implementation.
 */
export interface LanguageSelectEvent extends Event {
	readonly currentTarget: HTMLSelectElement;
}

/**
 * Live preference projection used while a language choice is edited.
 * @since 0.1.0 Initial implementation.
 */
export interface LanguagePreferencesPreview {
	/**
	 * Projects complete preferences without persisting them.
	 * @param preferences - Preferences selected by the user.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void;
}

/**
 * Receives one validated preferences projection or a malformed-data marker from another local context.
 * @since 0.1.0 Initial implementation.
 */
export type LanguagePreferencesChangeListener = (
	preferences: PreferencesDocument | null,
) => void;

/**
 * Validated preference projections observed by the Language settings screen.
 * @since 0.1.0 Initial implementation.
 */
export interface LanguagePreferencesSource {
	/**
	 * Begins observing validated preference projections and malformed-data markers.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: LanguagePreferencesChangeListener ): void;

	/**
	 * Stops observing validated preference projections and malformed-data markers.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: LanguagePreferencesChangeListener ): void;
}

/**
 * Localizable messages rendered by the Language settings screen.
 * @since 0.1.0 Initial implementation.
 */
export interface LanguageScreenCopy {
	eyebrow: string;
	title: string;
	introduction: string;
	formLabel: string;
	languageLabel: string;
	languageLabels: Readonly<Record<LanguageValue, string>>;
	browserLanguageOption: string;
	explicitLanguageDescription: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	restoreDefaults: string;
	restoreDefaultsError: string;
	saveError: string;
	savedAnnouncement: string;
	restoredAnnouncement: string;
	/**
	 * Formats the helper shown while TOCus follows the browser language.
	 * @param languageName - Native name of the detected browser language.
	 * @return Localized automatic-language explanation.
	 * @since 0.1.0 Initial implementation.
	 */
	formatBrowserLanguageDescription( languageName: string ): string;
}
