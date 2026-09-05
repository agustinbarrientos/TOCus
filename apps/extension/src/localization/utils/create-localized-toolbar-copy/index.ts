import { setupI18n } from '@lingui/core';
import { messagesByLanguage } from 'virtual:tocus/toolbar-localization';
import { type Language as LanguageValue } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { type LocalizationBundle } from '../create-localization-bundle/types';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createToolbarCopy } from '../create-toolbar-copy';

/**
 * Creates synchronous localized toolbar copy from the selected compiled messages.
 * @param language - Browser-derived or explicitly selected language.
 * @return Localized toolbar copy for the selected language.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizedToolbarCopy(
	language: LanguageValue,
): Readonly<LocalizationBundle[ 'toolbar' ]> {
	const languageTag = getLanguageTag( language );
	const i18n = setupI18n( {
		locale: languageTag,
		messages: { [ languageTag ]: messagesByLanguage[ language ] },
	} );

	return createToolbarCopy( i18n, createLocalizationFormatters( languageTag ) );
}
