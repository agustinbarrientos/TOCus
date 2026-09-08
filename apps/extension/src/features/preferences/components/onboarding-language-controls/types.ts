import type {
	Language,
} from '../../../../domains/preferences/types';
import type {
	OnboardingLanguageStepCopy,
} from '../../../onboarding/components/language-step/types';


/**
 * Controlled onboarding family and variant presentation.
 * @since 0.1.0
 */
export interface OnboardingLanguageControlsProps {
	copy: OnboardingLanguageStepCopy;
	value: Language;
	disabled?: boolean;
	onChange: ( language: Language ) => void;
}
