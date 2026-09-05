import { type Messages } from '@lingui/core';
import { Language } from '../../domains/preferences/types';
import { createLocalizationBundle } from '../utils/create-localization-bundle';

/**
 * Empty runtime catalog that exercises each colocated English source message.
 * @since 0.1.0 Initial implementation.
 */
const EmptyEnglishMessages: Messages = Object.freeze( {} );

/**
 * Complete English localization bundle for feature tests.
 * @since 0.1.0 Initial implementation.
 */
export const TestEnglishLocalizationBundle = createLocalizationBundle(
	Language.ENGLISH,
	EmptyEnglishMessages,
);
