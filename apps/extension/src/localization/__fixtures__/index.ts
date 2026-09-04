import englishCatalog from '../../../locales/en.json';
import { Language } from '../../domains/preferences/types';
import { createLocalizationBundle } from '../index';

/**
 * Complete English localization bundle for feature tests.
 * @since 0.1.0 Initial implementation.
 */
export const TestEnglishLocalizationBundle = createLocalizationBundle(
	Language.ENGLISH,
	englishCatalog,
);
