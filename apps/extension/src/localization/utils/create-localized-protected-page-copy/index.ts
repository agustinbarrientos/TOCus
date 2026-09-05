import { setupI18n } from '@lingui/core';
import { messagesByLanguage } from 'virtual:tocus/protected-page-localization';
import { type Language as LanguageValue } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { createInterruptionCopy } from '../create-interruption-copy';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createProtectedPageLayerCopy } from '../create-protected-page-layer-copy';
import { createWellbeingCopy } from '../create-wellbeing-copy';
import { type ProtectedPageLocalizationBundle } from './types';

/**
 * Creates synchronous protected-page copy from the selected compiled messages.
 * @param language - Browser-derived or explicitly selected language.
 * @return Localized copy required by the injected protected-page layer.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizedProtectedPageCopy(
	language: LanguageValue,
): Readonly<ProtectedPageLocalizationBundle> {
	const languageTag = getLanguageTag( language );
	const i18n = setupI18n( {
		locale: languageTag,
		messages: { [ languageTag ]: messagesByLanguage[ language ] },
	} );
	const formatters = createLocalizationFormatters( languageTag );

	return Object.freeze( {
		language,
		languageTag,
		interruption: createInterruptionCopy( i18n ),
		protectedPageLayer: createProtectedPageLayerCopy( i18n ),
		wellbeing: createWellbeingCopy( i18n, formatters ),
	} ) satisfies Readonly<ProtectedPageLocalizationBundle>;
}

export { type ProtectedPageLocalizationBundle } from './types';
