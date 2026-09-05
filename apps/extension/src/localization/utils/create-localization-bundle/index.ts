import { setupI18n, type Messages } from '@lingui/core';
import { type Language as LanguageValue } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { createAppearanceCopy } from '../create-appearance-copy';
import { createDocumentCopy } from '../create-document-copy';
import { createInterruptionCopy } from '../create-interruption-copy';
import { createLanguageScreenCopy } from '../create-language-screen-copy';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createOnboardingCopy } from '../create-onboarding-copy';
import { createPopupCopy } from '../create-popup-copy';
import { createProtectedPageLayerCopy } from '../create-protected-page-layer-copy';
import { createProtectedSiteItemCopy } from '../create-protected-site-item-copy';
import { createProtectedSiteListCopy } from '../create-protected-site-list-copy';
import { createProtectedSitesCopy } from '../create-protected-sites-copy';
import { createScheduleCopy } from '../create-schedule-copy';
import { createSettingsShellCopy } from '../create-settings-shell-copy';
import { createStatisticsCopy } from '../create-statistics-copy';
import { createTimingCopy } from '../create-timing-copy';
import { createToolbarCopy } from '../create-toolbar-copy';
import { createWellbeingCopy } from '../create-wellbeing-copy';
import { type LocalizationBundle } from './types';

/**
 * Builds the complete typed copy bundle for one effective preference language.
 * @param language - Authoritative effective language selected by PreferencesController.
 * @param messages - Compiled Lingui messages for the selected language.
 * @return Complete local copy bundle and valid document metadata.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizationBundle(
	language: LanguageValue,
	messages: Messages,
): Readonly<LocalizationBundle> {
	const languageTag = getLanguageTag( language );
	const i18n = setupI18n( {
		locale: languageTag,
		messages: { [ languageTag ]: messages },
	} );
	const formatters = createLocalizationFormatters( languageTag );
	const protectedSiteList = createProtectedSiteListCopy( i18n, formatters );

	return Object.freeze( {
		language,
		languageTag,
		document: createDocumentCopy( i18n ),
		onboarding: createOnboardingCopy( i18n ),
		popup: createPopupCopy( i18n ),
		settingsShell: createSettingsShellCopy( i18n ),
		languageScreen: createLanguageScreenCopy( i18n ),
		appearance: createAppearanceCopy( i18n ),
		schedule: createScheduleCopy( i18n, formatters ),
		timing: createTimingCopy( i18n ),
		protectedSites: createProtectedSitesCopy( i18n, formatters ),
		protectedSiteList,
		protectedSiteItem: createProtectedSiteItemCopy( i18n ),
		statistics: createStatisticsCopy( i18n, formatters ),
		interruption: createInterruptionCopy( i18n ),
		protectedPageLayer: createProtectedPageLayerCopy( i18n ),
		wellbeing: createWellbeingCopy( i18n, formatters ),
		toolbar: createToolbarCopy( i18n, formatters ),
	} ) satisfies Readonly<LocalizationBundle>;
}

export {
	type DocumentCopy,
	type LocalizationBundle,
} from './types';
