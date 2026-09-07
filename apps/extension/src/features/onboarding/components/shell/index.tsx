import { OnboardingStepIndex } from '../../types/flow';
import { OnboardingStep } from './types';
import { useEffect, useRef } from 'react';
import { Brand, BrandSize, Button, Group, Icon, IconName, Stack, Stepper, Text, Title, TocusProvider } from '@tocus/ui';
import { useOnboardingController } from '../../services/onboarding-flow';
import { PausePreview } from '../pause-preview';
import { PreferencesStep } from '../preferences-step';
import { SitesStep } from '../sites-step';
import type { OnboardingContentProps, OnboardingStepProps, OnboardingViewProps } from '../../types/presentation';

const stepNames = [ OnboardingStep.LANGUAGE, OnboardingStep.APPEARANCE, OnboardingStep.SITES ] as const;

/**
 * Exposes completed steps as keyboard-accessible navigation without permitting skips.
 * @param props - Current step, pending guard and localized progress labels.
 * @return Packaged stepper with completion checks and guarded backward navigation.
 */
function Progress( props: OnboardingStepProps ) {
	const { controller, copy } = props;
	return (
		<Stepper active={ controller.step } onStepClick={ controller.selectPreviousStep }
			size="sm" iconSize="1.6rem" labelPosition="right" wrap={ false } className="onboarding-progress"
			classNames={ {
				step: 'onboarding-progress-step', stepLabel: 'onboarding-progress-label',
				separator: 'onboarding-progress-separator', steps: 'onboarding-progress-steps',
				stepBody: 'onboarding-progress-body', stepIcon: 'onboarding-progress-icon', content: 'onboarding-progress-content',
			} }
			allowNextStepsSelect={ false } aria-label={ copy.progressLabel }>
			{ stepNames.map( ( name, index ) => (
				<Stepper.Step key={ name } label={ copy.stepNames[ name ] } aria-label={ copy.stepNames[ name ] }
					aria-current={ index === controller.step ? 'step' : undefined }
					data-completed-step={ index < controller.completedSteps || undefined }
					disabled={ controller.pending || index >= controller.step }
					icon={ index < controller.completedSteps ? <Icon name={ IconName.CIRCLE_CHECK } /> : undefined }
					progressIcon={ index < controller.completedSteps
						? <Icon name={ IconName.CIRCLE_CHECK } /> : undefined }
					completedIcon={ <Icon name={ IconName.CIRCLE_CHECK } /> }
					allowStepSelect={ ! controller.pending && index < controller.step } />
			) ) }
		</Stepper>
	);
}

/**
 * Selects the current page body without mixing recovery actions into form markup.
 * @param props - Loaded copy, current flow state and focus-owned page heading.
 * @return Recovery, completion or the active editable step.
 */
function Content( props: OnboardingContentProps ) {
	const { state, copy, controller, heading } = props;
	if ( state.startupUnavailable ) {
		return (
			<section className="onboarding-outcome onboarding-recovery">
				<span className="onboarding-status-mark onboarding-recovery-mark"><Icon name={ IconName.EXCLAMATION } /></span>
				<Title ref={ heading } tabIndex={ -1 } order={ 1 }>{ copy.startupErrorTitle }</Title>
				<Text c="dimmed">{ copy.startupErrorDescription }</Text>
				<div className="onboarding-outcome-actions">
					<Button className="tocus-action-raised" px="var(--tocus-space-6)" py="var(--tocus-space-3)"
						onClick={ controller.retry }>{ copy.retryLabel }</Button>
					<Button variant="outline" px="var(--tocus-space-6)" py="var(--tocus-space-3)"
						onClick={ controller.openSettings }>{ copy.openSettingsLabel }</Button>
				</div>
			</section>
		);
	}
	if ( controller.completed ) {
		return (
			<section className="onboarding-outcome">
				<span className="onboarding-status-mark onboarding-completion-mark"><Icon name={ IconName.CIRCLE_CHECK } /></span>
				<Title ref={ heading } tabIndex={ -1 } order={ 1 }>{ copy.completionTitle }</Title>
				<Text c="dimmed">{ copy.completionDescription }</Text>
				<div className="onboarding-outcome-actions">
					<Button className="tocus-action-raised" px="var(--tocus-space-6)" py="var(--tocus-space-3)"
						onClick={ controller.openSettings }>{ copy.openSettingsLabel }</Button>
				</div>
			</section>
		);
	}
	const currentCopy = copy[ stepNames[ controller.step ] ];
	return (
		<>
			<Progress { ...props } />
			<header className={ `tocus-page-header tocus-preferences-header ${ controller.step === OnboardingStepIndex.LANGUAGE
				? 'tocus-preferences-language-header' : controller.step === OnboardingStepIndex.SITES ? 'tocus-preferences-sites-header' : '' }` }>
				<Title ref={ heading } tabIndex={ -1 } order={ 1 }>{ currentCopy.title }</Title>
				<Text c="dimmed">{ currentCopy.introduction }</Text>
			</header>
			{ controller.step === OnboardingStepIndex.SITES
				? <SitesStep { ...props } /> : <PreferencesStep { ...props } /> }
		</>
	);
}

/**
 * Composes onboarding layout while the controller owns draft and persistence transitions.
 * @param props - Immutable service projection and synchronous user-event port.
 * @return The branded onboarding surface, or nothing before localization is ready.
 * @since 0.1.0
 */
export function OnboardingView( props: OnboardingViewProps ) {
	const { state, port } = props;
	const controller = useOnboardingController( state, port );
	const heading = useRef<HTMLHeadingElement>( null );
	useEffect( () => {
		heading.current?.focus( { preventScroll: true } );
	}, [ controller.step, controller.completed, state.startupUnavailable ] );
	if ( ! state.copy ) {
		return null;
	}
	const showPreview = controller.step === OnboardingStepIndex.APPEARANCE &&
		! controller.completed && ! state.startupUnavailable;
	return (
		<TocusProvider appearance={ state.theme } palette={ state.palette } reducedMotion={ state.reducedMotion }>
			<div className={ `onboarding-view${ showPreview ? ' onboarding-with-preview' : '' }` }>
				<header className="onboarding-header"><Brand size={ BrandSize.LARGE } /></header>
				<div className="onboarding-layout">
					<aside className="onboarding-introduction">
						<Title order={ 2 }>{ state.copy.introduction }</Title>
						<section className="onboarding-privacy">
							<Group wrap="nowrap" align="flex-start" gap="var(--tocus-space-3)">
								<Icon name={ IconName.USER_LOCK } />
								<Stack gap="var(--tocus-space-1)">
									<Text className="onboarding-privacy-title">{ state.copy.privacyTitle }</Text>
									<Text className="onboarding-privacy-description">{ state.copy.privacyDescription }</Text>
								</Stack>
							</Group>
						</section>
					</aside>
					<main className="tocus-page onboarding-form" aria-busy={ controller.pending }>
						<Content state={ state } copy={ state.copy } controller={ controller } heading={ heading } />
					</main>
				</div>
				<Text component="footer" className="onboarding-footer">{ state.copy.settingsNote }</Text>
				{ showPreview && <PausePreview state={ state } /> }
			</div>
		</TocusProvider>
	);
}
