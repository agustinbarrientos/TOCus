import { useRef, useState } from 'react';
import type { Language } from '../../../../domains/preferences/types';
import type { AppearanceControlsUpdate } from '../../../preferences/components/appearance-controls/types';
import { OnboardingLanguageSelectEventName } from '../../components/language-step/types';
import {
	OnboardingCompleteEventName, OnboardingOpenSettingsEventName, OnboardingRetryEventName,
} from '../../components/shell/types';
import type { OnboardingPageShell } from '../onboarding-page/types';
import { type OnboardingController, type OnboardingState, OnboardingStepIndex } from '../../types/flow';
import { useOnboardingSites } from '../onboarding-sites';
import { usePendingOperation } from '../pending-operation';

/**
 * Coordinates guarded step navigation and preference persistence with the existing page service.
 * @since 0.1.0
 * @param state - Current page-service render projection.
 * @param port - Live page port for persistence, localization and lifecycle events.
 * @return Presentation-neutral onboarding state and actions.
 */
export function useOnboardingController(
	state: Readonly<OnboardingState>, port: OnboardingPageShell,
): OnboardingController {
	const [ step, setStep ] = useState<OnboardingStepIndex>( OnboardingStepIndex.LANGUAGE );
	const [ completedSteps, setCompletedSteps ] = useState( 0 );
	const [ completed, setCompleted ] = useState( false );
	const completedRef = useRef( false );
	const [ preferenceError, setPreferenceError ] = useState( false );
	const operation = usePendingOperation();

	/** Projects completion and emits its page-service event once. */
	function complete(): void {
		if ( completedRef.current ) {
			return;
		}
		completedRef.current = true;
		setCompleted( true );
		port.dispatchEvent( new Event( OnboardingCompleteEventName ) );
	}

	const sites = useOnboardingSites( state, port, operation, complete );

	/**
	 * Returns to an earlier visited step without discarding site additions.
	 * @param next - Requested zero-based step.
	 */
	function selectPreviousStep( next: number ): void {
		const earlierStep = next === OnboardingStepIndex.LANGUAGE || next === OnboardingStepIndex.APPEARANCE;
		if ( operation.isPending() || next >= step || ! earlierStep ) {
			return;
		}
		setPreferenceError( false );
		setStep( next );
	}

	/**
	 * Applies language immediately so the service can update the current copy.
	 * @param language - Selected supported language.
	 */
	function selectLanguage( language: Language ): void {
		if ( operation.isPending() ) {
			return;
		}
		port.language = language;
		port.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, { detail: { language } } ) );
	}

	/**
	 * Updates controlled theme or palette without a separate storage write.
	 * @param update - Validated appearance control update.
	 */
	function selectAppearance( update: AppearanceControlsUpdate ): void {
		if ( operation.isPending() ) {
			return;
		}
		if ( 'theme' in update ) {
			port.theme = update.theme;
		}
		if ( 'palette' in update ) {
			port.palette = update.palette;
		}
	}

	/**
	 * Persists preferences and waits for language readiness before advancing.
	 * @return Completion of the save/readiness sequence.
	 */
	async function advance(): Promise<void> {
		if ( step === OnboardingStepIndex.SITES || ! operation.begin() ) {
			return;
		}
		setPreferenceError( false );
		try {
			if ( ! port.editor ) {
				setPreferenceError( true );
				return;
			}
			const result = await port.editor.update( {
				language: port.language, theme: port.theme, palette: port.palette,
			} );
			if ( result === null || result.language === null ) {
				setPreferenceError( true );
				return;
			}
			if ( step === OnboardingStepIndex.LANGUAGE && port.synchronizeLanguage &&
				! await port.synchronizeLanguage( port.language ) ) {
				setPreferenceError( true );
				return;
			}
			setCompletedSteps( ( previous ) => Math.max( previous, step + 1 ) );
			setStep( step === OnboardingStepIndex.LANGUAGE
				? OnboardingStepIndex.APPEARANCE : OnboardingStepIndex.SITES );
		} catch {
			setPreferenceError( true );
		} finally {
			operation.end();
		}
	}

	/** Requests the existing page-service startup recovery path. */
	function retry(): void {
		port.dispatchEvent( new Event( OnboardingRetryEventName ) );
	}
	/** Requests the existing Settings destination. */
	function openSettings(): void {
		port.dispatchEvent( new Event( OnboardingOpenSettingsEventName ) );
	}

	return {
		...sites, step, completedSteps, completed, pending: operation.pending, preferenceError,
		selectPreviousStep, selectLanguage, selectAppearance, advance, retry, openSettings,
	};
}
