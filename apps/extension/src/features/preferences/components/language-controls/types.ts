import type {
	Language,
} from '../../../../domains/preferences/types';
import type {
	LanguageScreenCopy,
} from '../../../settings/components/language-screen/types';

/**
 * Select sentinel for the nullable follow-browser preference.
 * @since 0.1.0
 */
export const BrowserLanguageOption = 'browser';


/**
 * Controlled Settings language presentation.
 * @since 0.1.0
 */
export interface LanguageControlsProps {
	copy: Pick<LanguageScreenCopy, 'languageLabel' | 'languageLabels' | 'browserLanguageOption' | 'formatBrowserLanguageDescription'>;
	value: Language | null;
	browserLanguage: Language;
	disabled?: boolean;
	onChange: ( language: Language | null ) => void;
}
