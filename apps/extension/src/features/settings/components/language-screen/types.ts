import {
	Language,
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
 * One fixed language autonym and its valid metadata tag.
 * @since 0.1.0 Initial implementation.
 */
export interface LanguageOption {
	language: LanguageValue;
	label: string;
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

/**
 * Native language labels indexed by every supported explicit choice.
 * @since 0.1.0 Initial implementation.
 */
export const LanguageNames: Readonly<Record<LanguageValue, string>> = Object.freeze( {
	[ Language.ENGLISH ]: 'English',
	[ Language.SPANISH_TU ]: 'Espa\u00f1ol (t\u00fa)',
	[ Language.SPANISH_VOS ]: 'Espa\u00f1ol (vos)',
	[ Language.PORTUGUESE_BRAZIL ]: 'Portugu\u00eas (Brasil)',
	[ Language.PORTUGUESE_PORTUGAL ]: 'Portugu\u00eas (Portugal)',
	[ Language.ITALIAN ]: 'Italiano',
	[ Language.FRENCH ]: 'Fran\u00e7ais',
	[ Language.GERMAN ]: 'Deutsch',
	[ Language.JAPANESE ]: '\u65e5\u672c\u8a9e',
	[ Language.RUSSIAN ]: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
} );

/**
 * Fixed language options rendered in approved product order after browser-following.
 * @since 0.1.0 Initial implementation.
 */
export const LanguageOptions: readonly Readonly<LanguageOption>[] = Object.freeze( [
	Object.freeze( {
		language: Language.ENGLISH,
		label: LanguageNames[ Language.ENGLISH ],
	} ),
	Object.freeze( {
		language: Language.SPANISH_TU,
		label: LanguageNames[ Language.SPANISH_TU ],
	} ),
	Object.freeze( {
		language: Language.SPANISH_VOS,
		label: LanguageNames[ Language.SPANISH_VOS ],
	} ),
	Object.freeze( {
		language: Language.PORTUGUESE_BRAZIL,
		label: LanguageNames[ Language.PORTUGUESE_BRAZIL ],
	} ),
	Object.freeze( {
		language: Language.PORTUGUESE_PORTUGAL,
		label: LanguageNames[ Language.PORTUGUESE_PORTUGAL ],
	} ),
	Object.freeze( {
		language: Language.ITALIAN,
		label: LanguageNames[ Language.ITALIAN ],
	} ),
	Object.freeze( {
		language: Language.FRENCH,
		label: LanguageNames[ Language.FRENCH ],
	} ),
	Object.freeze( {
		language: Language.GERMAN,
		label: LanguageNames[ Language.GERMAN ],
	} ),
	Object.freeze( {
		language: Language.JAPANESE,
		label: LanguageNames[ Language.JAPANESE ],
	} ),
	Object.freeze( {
		language: Language.RUSSIAN,
		label: LanguageNames[ Language.RUSSIAN ],
	} ),
] );
