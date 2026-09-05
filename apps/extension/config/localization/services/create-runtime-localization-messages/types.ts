import { type Messages } from '@lingui/core';
import { type Language } from '../../../../src/domains/preferences/types.ts';
import { type LocalizationCatalogReader } from '../read-localization-catalog/types.ts';

/**
 * Compiled Lingui messages indexed by extension preference language.
 * @since 0.1.0 Initial implementation.
 */
export type RuntimeLocalizationMessages = Readonly<Record<Language, Readonly<Messages>>>;

/**
 * Dependencies used to project focused runtime localization messages.
 * @since 0.1.0 Initial implementation.
 */
export interface CreateRuntimeLocalizationMessagesOptions {
	readCatalog: LocalizationCatalogReader;
}
