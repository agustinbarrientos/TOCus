import {
	Radio,
	Stack,
} from '@tocus/ui';
import {
	Language,
	LanguageSchema,
} from '../../../../domains/preferences/types';
import { getLanguageTag } from '../../../../domains/preferences/utils/resolve-language';
import {
	OnboardingLanguageFamily,
} from '../../../onboarding/components/language-step/types';
import type {
	OnboardingLanguageControlsProps,
} from './types';
import '../appearance-controls/style.scss';


/**
 * Retains regional choices when the current language family is selected again.
 * @param props - Controlled onboarding language family, variant and local copy.
 * @return Language families followed by applicable regional variants.
 * @since 0.1.0
 */
export function OnboardingLanguageControls( props: OnboardingLanguageControlsProps ) {
	const { copy, value, disabled = false } = props;
	const family = value.startsWith( 'es-' ) ? OnboardingLanguageFamily.SPANISH : value.startsWith( 'pt-' ) ? OnboardingLanguageFamily.PORTUGUESE : value;
	const variants = family === OnboardingLanguageFamily.SPANISH
		? [ { value: Language.SPANISH_TU, label: copy.spanishTuLabel },
			{ value: Language.SPANISH_VOS, label: copy.spanishVosLabel } ]
		: family === OnboardingLanguageFamily.PORTUGUESE
			? [ { value: Language.PORTUGUESE_BRAZIL, label: copy.portugueseBrazilLabel },
				{ value: Language.PORTUGUESE_PORTUGAL, label: copy.portuguesePortugalLabel } ]
			: [];
	return <Stack gap="1.5rem">
		<Radio.Group name="language-family" label={ copy.languageLegend }
			classNames={ { label: 'preferences-language-section-label' } } value={ family } onChange={ ( next ) => {
				props.onChange( next === family ? value : next === OnboardingLanguageFamily.SPANISH
					? Language.SPANISH_TU
					: next === OnboardingLanguageFamily.PORTUGUESE
						? Language.PORTUGUESE_BRAZIL : LanguageSchema.parse( next ) );
			} }>
			<div className="preferences-language-options">
				{ Object.values( OnboardingLanguageFamily ).map( ( next ) =>
					<Radio.Card key={ next } value={ next } disabled={ disabled }
						aria-label={ copy.languageLabels[ next ] }
						className="tocus-choice-card tocus-choice-language preferences-language-card">
						<strong className="preferences-language-label" lang={ next }>{ copy.languageLabels[ next ] }</strong>
					</Radio.Card>
				) }
			</div>
		</Radio.Group>
		{ variants.length > 0 && <Radio.Group name="language-variant" value={ value }
			classNames={ { label: 'preferences-language-section-label' } }
			label={ family === OnboardingLanguageFamily.SPANISH
				? copy.spanishVariantLegend : copy.portugueseVariantLegend }
			onChange={ ( next ) => {
				props.onChange( LanguageSchema.parse( next ) );
			} }>
			<div className="preferences-language-options preferences-language-variants">
				{ variants.map( ( option ) => <Radio.Card key={ option.value } value={ option.value }
					disabled={ disabled } aria-label={ option.label }
					className="tocus-choice-card tocus-choice-language preferences-language-card">
					<strong className="preferences-language-label" lang={ getLanguageTag( option.value ) }>{ option.label }</strong>
				</Radio.Card> ) }
			</div>
		</Radio.Group> }
	</Stack>;
}
