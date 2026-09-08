import {
	NativeSelect as SettingsSelect,
} from '@tocus/ui';
import {
	Language,
	LanguageSchema,
} from '../../../../domains/preferences/types';
import { BrowserLanguageOption,
	type LanguageControlsProps,
} from './types';
import './style.scss';


/**
 * Shares a packaged language selector across all ten supported language variants.
 * @param props - Controlled exact language or browser-following preference.
 * @return Accessible language selection and the browser language explanation.
 * @since 0.1.0
 */
export function LanguageControls( props: LanguageControlsProps ) {
	const { copy, value, browserLanguage, disabled = false } = props;
	return <SettingsSelect id="language" name="language" label={ copy.languageLabel } value={ value ?? BrowserLanguageOption }
		classNames={ { label: 'preferences-language-field-label', description: 'preferences-language-description' } }
		styles={ { wrapper: { marginBottom: value === null ? 'var(--tocus-space-2)' : 0 } } }
		inputWrapperOrder={ [ 'label', 'input', 'description', 'error' ] }
		disabled={ disabled }
		description={ value === null
			? copy.formatBrowserLanguageDescription( copy.languageLabels[ browserLanguage ] )
			: undefined }
		onChange={ ( event ) => {
			const next = event.currentTarget.value;
			props.onChange( next === BrowserLanguageOption ? null : LanguageSchema.parse( next ) );
		} }
		data={ [ { value: BrowserLanguageOption, label: copy.browserLanguageOption },
			...Object.values( Language ).map( ( language ) => ( {
				value: language, label: copy.languageLabels[ language ],
			} ) ) ] }
	/>;
}
