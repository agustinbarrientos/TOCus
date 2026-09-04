import { Language, type Language as LanguageValue } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { loadLocalizationCatalog, type LocalizationCatalog } from '../../catalogs';
import { createFormatters } from './formatters';
import {
	createInterruptionCopy,
	createProtectedPageLayerCopy,
	createWellbeingCopy,
} from './interruption-copy-adapters';
import {
	createAppearanceCopy,
	createLanguageScreenCopy,
	createProtectedSiteItemCopy,
	createProtectedSiteListCopy,
	createProtectedSitesCopy,
	createScheduleCopy,
	createStatisticsCopy,
	createTimingCopy,
} from './settings-copy-adapters';
import { createToolbarCopy } from './toolbar-copy-adapter';
import {
	type LocalizationBundle,
	type LocalizationCatalogLoader,
} from './types';

/**
 * Builds the complete typed copy bundle for one effective preference language.
 * @param language - Authoritative effective language selected by PreferencesController.
 * @param catalog - Translator-authored catalog for the selected language.
 * @return Complete local copy bundle and valid document metadata.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizationBundle(
	language: LanguageValue,
	catalog: LocalizationCatalog,
): Readonly<LocalizationBundle> {
	const languageTag = getLanguageTag( language );
	const formatters = createFormatters( languageTag );
	const protectedSiteList = createProtectedSiteListCopy( catalog, formatters );

	return Object.freeze( {
		language,
		languageTag,
		document: Object.freeze( catalog.document ),
		popup: Object.freeze( catalog.popup ),
		settingsShell: Object.freeze( catalog.settingsShell ),
		languageScreen: createLanguageScreenCopy( catalog ),
		appearance: createAppearanceCopy( catalog ),
		schedule: createScheduleCopy( catalog, formatters ),
		timing: createTimingCopy( catalog, formatters ),
		protectedSites: createProtectedSitesCopy( catalog, formatters ),
		protectedSiteList,
		protectedSiteItem: createProtectedSiteItemCopy( catalog ),
		statistics: createStatisticsCopy( catalog, formatters ),
		interruption: createInterruptionCopy( catalog, formatters ),
		protectedPageLayer: createProtectedPageLayerCopy( catalog, formatters ),
		wellbeing: createWellbeingCopy( catalog, formatters ),
		toolbar: createToolbarCopy( catalog, formatters ),
	} ) satisfies Readonly<LocalizationBundle>;
}

/**
 * Loads one packaged catalog and builds its complete typed copy bundle.
 * @param language - Authoritative effective language selected by PreferencesController.
 * @param catalogLoader - Packaged catalog boundary used for the requested language.
 * @return Complete local copy bundle for only the requested language.
 * @since 0.1.0 Initial implementation.
 */
export async function loadLocalizationBundle(
	language: LanguageValue,
	catalogLoader: LocalizationCatalogLoader = loadLocalizationCatalog,
): Promise<Readonly<LocalizationBundle>> {
	try {
		return createLocalizationBundle( language, await catalogLoader( language ) );
	} catch {
		return createLocalizationBundle(
			Language.ENGLISH,
			await loadLocalizationCatalog( Language.ENGLISH ),
		);
	}
}

export {
	type DocumentCopy,
	type LocalizationBundle,
} from './types';
