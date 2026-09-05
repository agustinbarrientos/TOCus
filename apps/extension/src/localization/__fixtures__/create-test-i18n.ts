import { setupI18n, type I18n } from '@lingui/core';

/**
 * Creates an English Lingui instance that falls back to colocated source messages.
 * @return English test localization runtime.
 * @since 0.1.0 Initial implementation.
 */
export function createTestI18n(): I18n {
	return setupI18n( { locale: 'en', messages: { en: {} } } );
}
