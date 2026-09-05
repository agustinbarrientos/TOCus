import { type Messages } from '@lingui/core';
import { type Language } from '../../../domains/preferences/types';

/**
 * Asynchronous packaged-catalog boundary used by the localization bundle loader.
 * @since 0.1.0 Initial implementation.
 */
export type LocalizationMessagesLoader = (
	language: Language,
) => Promise<Messages>;
