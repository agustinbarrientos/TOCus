import { type Language } from '../../../domains/preferences/types';
import { type LocalizationBundle } from '../create-localization-bundle/types';

/**
 * Synchronous localization projection required by an injected protected page.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLocalizationBundle {
	language: Language;
	languageTag: string;
	interruption: LocalizationBundle[ 'interruption' ];
	protectedPageLayer: LocalizationBundle[ 'protectedPageLayer' ];
	wellbeing: LocalizationBundle[ 'wellbeing' ];
}
