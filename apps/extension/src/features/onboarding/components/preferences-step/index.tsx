import { OnboardingStepIndex } from '../../types/flow';
import { Alert, Button, Icon, IconName, Stack } from '@tocus/ui';
import { AppearanceControls } from '../../../preferences/components/appearance-controls';
import { OnboardingLanguageControls } from '../../../preferences/components/onboarding-language-controls';
import type { OnboardingStepProps } from '../../types/presentation';

/**
 * Uses the same packaged appearance controls as Settings, with onboarding's Continue flow.
 * @param props - Current choices, localized labels and service-backed save action.
 * @return The Language or Appearance form; neither offers a breathing-disable control.
 * @since 0.1.0
 */
export function PreferencesStep( props: OnboardingStepProps ) {
	const { state, copy, controller } = props;
	const languageStep = controller.step === OnboardingStepIndex.LANGUAGE;
	const continueLabel = languageStep ? copy.language.continueLabel : copy.appearance.continueLabel;
	return (
		<form onSubmit={ ( event ) => {
			event.preventDefault();
			void controller.advance();
		} }>
			<Stack gap={ 0 }>
				{ languageStep ? (
					<OnboardingLanguageControls copy={ copy.language } value={ state.language }
						disabled={ controller.pending } onChange={ controller.selectLanguage } />
				) : (
					<AppearanceControls copy={ copy.appearance } theme={ state.theme } palette={ state.palette }
						disabled={ controller.pending } onChange={ controller.selectAppearance } />
				) }
				<div className="tocus-preferences-error">{ controller.preferenceError && (
					<Alert color="red" role="alert" icon={ <Icon name={ IconName.EXCLAMATION } /> }>
						{ copy.preferenceSaveError }
					</Alert>
				) }</div>
				<div className={ `tocus-form-actions tocus-preferences-actions ${ languageStep ? '' : 'tocus-preferences-appearance-actions' }` }>
					<Button className="tocus-action-raised" type="submit" loading={ controller.pending } disabled={ controller.pending }>
						{ continueLabel }
					</Button>
				</div>
			</Stack>
		</form>
	);
}
