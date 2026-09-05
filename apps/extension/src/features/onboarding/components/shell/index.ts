import iconMarkup from '@tocus/theme/icon.svg?raw';
import circleCheckIconMarkup from '../../assets/icon-circle-check.svg?raw';
import exclamationIconMarkup from '../../assets/icon-exclamation.svg?raw';
import lockIconMarkup from '../../assets/icon-lock.svg?raw';
import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import {
	Language,
	Palette,
	ThemeMode,
	type Language as LanguageValue,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import '../../../interruption/components/screen';
import {
	InterruptionScreenMode,
	InterruptionScreenState,
	type InterruptionScreenCopy,
} from '../../../interruption/components/screen';
import { type ProtectedSiteEnrollmentService } from '../../../protected-sites/services/protected-site-enrollment';
import { type OnboardingSiteSuggestion } from '../../utils/site-suggestion-catalog';
import '../appearance-step';
import {
	type OnboardingAppearanceEventDetail,
} from '../appearance-step';
import '../language-step';
import {
	type OnboardingLanguageEventDetail,
} from '../language-step';
import '../sites-step';
import styles from './web-component-style.scss?inline';
import {
	OnboardingCompleteEventName,
	OnboardingOpenSettingsEventName,
	OnboardingRetryEventName,
	OnboardingStep,
	type OnboardingLanguageSynchronizer,
	type OnboardingShellCopy,
	type OnboardingStep as OnboardingStepValue,
} from './types';

/**
 * Approved onboarding step order.
 * @since 0.1.0 Initial implementation.
 */
const OnboardingSteps: readonly OnboardingStepValue[] = Object.freeze( [
	OnboardingStep.LANGUAGE,
	OnboardingStep.APPEARANCE,
	OnboardingStep.SITES,
] );

/**
 * Renders and coordinates the complete first-install onboarding experience.
 * @element tocus-f-onboarding-shell
 * @summary Local-first three-step onboarding shell.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-onboarding-shell' )
export class ComponentOnboardingShell extends LitElement {
	/**
	 * Shadow-root styles for the onboarding shell.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Coordinated local preference editor used by the first two steps.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: PreferencesEditor | null = null;

	/**
	 * Enrollment service invoked directly by final-step user actions.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor enrollment: ProtectedSiteEnrollmentService | null = null;

	/**
	 * Explicit language preselected from stored preferences or browser locale.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor language: LanguageValue = Language.ENGLISH;

	/**
	 * Appearance mode preselected from local preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'data-tocus-theme', reflect: true } )
	accessor theme: ThemeModeValue = ThemeMode.SYSTEM;

	/**
	 * Full-scene palette preselected from local preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'data-tocus-palette', reflect: true } )
	accessor palette: PaletteValue = Palette.BROWN;

	/**
	 * Whether user or operating-system preferences disable continuous preview motion.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'reduced-motion', type: Boolean } )
	accessor reducedMotion = false;

	/**
	 * Authoritative site configurations already protected before onboarding renders.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor protectedSites: readonly ProtectedSiteConfiguration[] = [];

	/**
	 * Fixed local suggestions rendered by the final step.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor suggestions: readonly Readonly<OnboardingSiteSuggestion>[] = [];

	/**
	 * Complete localizable messages rendered by onboarding.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<OnboardingShellCopy>;

	/**
	 * Complete localized interruption copy rendered by the real-screen preview.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor interruptionCopy!: Readonly<InterruptionScreenCopy>;

	/**
	 * Localization readiness gate required before Language navigation.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor synchronizeLanguage: OnboardingLanguageSynchronizer | null = null;

	/**
	 * Whether startup failed and onboarding must offer explicit recovery actions.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false, type: Boolean } )
	accessor startupUnavailable = false;

	@state()
	private accessor step: OnboardingStepValue = OnboardingStep.LANGUAGE;

	@state()
	private accessor preferencePending = false;

	@state()
	private accessor preferenceSaveFailed = false;

	@state()
	private accessor completed = false;

	/**
	 * Adopts an exact language selection immediately for the controlled child step.
	 * @param event - Exact language selection emitted by the Language step.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleLanguageSelect = (
		event: CustomEvent<OnboardingLanguageEventDetail>,
	): void => {
		this.language = event.detail.language;
		this.preferenceSaveFailed = false;
	};

	/**
	 * Persists the exact language before advancing to Appearance.
	 * @param event - Continue request emitted by the Language step.
	 * @return Promise resolved after persistence and navigation settle.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleLanguageContinue = async (
		event: CustomEvent<OnboardingLanguageEventDetail>,
	): Promise<void> => {
		if (
			this.preferencePending ||
			this.editor === null ||
			this.synchronizeLanguage === null
		) {
			this.preferenceSaveFailed = true;
			return;
		}

		this.preferencePending = true;
		this.preferenceSaveFailed = false;

		try {
			const preferences = await this.editor.update( { language: event.detail.language } );

			if ( preferences === null || preferences.language === null ) {
				this.preferenceSaveFailed = true;
				return;
			}

			const localizationReady = await this.synchronizeLanguage( preferences.language );

			if ( ! localizationReady ) {
				return;
			}

			this.language = preferences.language;
			this.step = OnboardingStep.APPEARANCE;
		} catch {
			this.preferenceSaveFailed = true;
			return;
		} finally {
			this.preferencePending = false;
		}

		await this.focusCurrentStep();
	};

	/**
	 * Adopts a theme and color selection immediately for preview.
	 * @param event - Appearance selection emitted by the Appearance step.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAppearanceSelect = (
		event: CustomEvent<OnboardingAppearanceEventDetail>,
	): void => {
		this.theme = event.detail.theme;
		this.palette = event.detail.palette;
		this.preferenceSaveFailed = false;
	};

	/**
	 * Persists theme and color before advancing to Websites.
	 * @param event - Continue request emitted by the Appearance step.
	 * @return Promise resolved after persistence and navigation settle.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAppearanceContinue = async (
		event: CustomEvent<OnboardingAppearanceEventDetail>,
	): Promise<void> => {
		if ( this.preferencePending || this.editor === null ) {
			this.preferenceSaveFailed = true;
			return;
		}

		this.preferencePending = true;
		this.preferenceSaveFailed = false;

		try {
			const preferences = await this.editor.update( {
				theme: event.detail.theme,
				palette: event.detail.palette,
			} );

			if ( preferences === null ) {
				this.preferenceSaveFailed = true;
				return;
			}

			this.theme = preferences.theme;
			this.palette = preferences.palette;
			this.step = OnboardingStep.SITES;
		} catch {
			this.preferenceSaveFailed = true;
			return;
		} finally {
			this.preferencePending = false;
		}

		await this.focusCurrentStep();
	};

	/**
	 * Reports whether the real-screen preview belongs in the current shell state.
	 * @return Whether Appearance is active with complete interruption copy.
	 * @since 0.1.0 Initial implementation.
	 */
	private isPausePreviewVisible(): boolean {
		return this.step === OnboardingStep.APPEARANCE &&
			! this.completed &&
			! this.startupUnavailable &&
			isLocalizationReady( this.interruptionCopy );
	}

	/**
	 * Emits the public onboarding completion event from the final step.
	 * @param event - Internal final-step completion request.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSitesFinish = ( event: Event ): void => {
		event.stopPropagation();
		this.completed = true;
		this.dispatchEvent( new Event( OnboardingCompleteEventName, {
			bubbles: true,
			composed: true,
		} ) );
		void this.focusCurrentStep();
	};

	/**
	 * Emits the public Settings request from the visible completion fallback.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleOpenSettings = (): void => {
		this.dispatchEvent( new Event( OnboardingOpenSettingsEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};

	/**
	 * Emits the public startup Retry request from the recovery state.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = (): void => {
		this.dispatchEvent( new Event( OnboardingRetryEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};

	/**
	 * Focuses the active step heading without moving the viewport.
	 * @return Promise resolved after the active child has rendered.
	 * @since 0.1.0 Initial implementation.
	 */
	private async focusCurrentStep(): Promise<void> {
		await this.updateComplete;
		const activeStep = this.renderRoot.querySelector<LitElement>( '[data-onboarding-step]' );

		await activeStep?.updateComplete;
		const activeHeading = activeStep?.shadowRoot?.querySelector<HTMLElement>( 'h1' ) ??
			this.renderRoot.querySelector<HTMLElement>( '.completion h1, .recovery h1' );

		activeHeading?.focus( { preventScroll: true } );
	}

	/**
	 * Renders the completion fallback retained when the browser does not close the tab.
	 * @return Localized completion state with a Settings action.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderCompletion(): TemplateResult {
		return html`
			<div class="completion">
				<span class="status-mark completion__mark" aria-hidden="true">
					${ unsafeSVG( circleCheckIconMarkup ) }
				</span>
				<h1 id="onboarding-completion-title" tabindex="-1">${ this.copy.completionTitle }</h1>
				<p>${ this.copy.completionDescription }</p>
				<button class="completion__settings" type="button" @click=${ this.handleOpenSettings }>
					${ this.copy.openSettingsLabel }
				</button>
			</div>
		`;
	}

	/**
	 * Renders localized recovery actions after an exceptional startup failure.
	 * @return Branded startup-recovery state with Retry and Settings actions.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderRecovery(): TemplateResult {
		return html`
			<div class="recovery">
				<span class="status-mark recovery__mark" aria-hidden="true">
					${ unsafeSVG( exclamationIconMarkup ) }
				</span>
				<h1 id="onboarding-recovery-title" tabindex="-1">${ this.copy.startupErrorTitle }</h1>
				<p>${ this.copy.startupErrorDescription }</p>
				<div class="recovery__actions">
					<button class="recovery__retry" type="button" @click=${ this.handleRetry }>
						${ this.copy.retryLabel }
					</button>
					<button class="recovery__settings" type="button" @click=${ this.handleOpenSettings }>
						${ this.copy.openSettingsLabel }
					</button>
				</div>
			</div>
		`;
	}

	/**
	 * Renders the actual interruption screen as an automatic, analytics-free preview.
	 * @return Floating preview while Appearance is active, or an empty template otherwise.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderPausePreview(): TemplateResult {
		if ( ! this.isPausePreviewVisible() ) {
			return html``;
		}

		return html`
			<figure class="pause-preview">
				<figcaption>${ this.copy.appearance.previewTitle }</figcaption>
				<div class="pause-preview-browser" aria-hidden="true">
					<div class="pause-preview-chrome">
						<div class="pause-preview-tab-strip">
							<span class="pause-preview-window-controls"></span>
							<span class="pause-preview-tab">
								<span class="pause-preview-tab-icon"></span>
								<span class="pause-preview-tab-label"></span>
							</span>
						</div>
						<div class="pause-preview-toolbar">
							<span class="pause-preview-navigation"></span>
							<span class="pause-preview-address">
								<span class="pause-preview-address-placeholder"></span>
								<span class="pause-preview-address-placeholder pause-preview-address-placeholder-short"></span>
							</span>
							<span class="pause-preview-menu"></span>
						</div>
					</div>
					<div class="pause-preview-viewport">
						<tocus-f-interruption-screen
							preview
							aria-hidden="true"
							.inert=${ true }
							.copy=${ this.interruptionCopy }
							.mode=${ InterruptionScreenMode.BREATHING }
							.progressing=${ true }
							.reducedMotion=${ this.reducedMotion }
							.state=${ InterruptionScreenState.WAITING }
							.continueShortcutEnabled=${ false }
						></tocus-f-interruption-screen>
					</div>
				</div>
			</figure>
		`;
	}

	/**
	 * Renders the approved active onboarding step with its exact dependencies.
	 * @return Active Language, Appearance, or Sites step.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderStep(): TemplateResult {
		const preferenceError = this.preferenceSaveFailed
			? this.copy.preferenceSaveError
			: '';

		if ( this.step === OnboardingStep.LANGUAGE ) {
			return html`
				<tocus-f-onboarding-language-step
					data-onboarding-step
					.copy=${ this.copy.language }
					.errorMessage=${ preferenceError }
					.language=${ this.language }
					.pending=${ this.preferencePending }
					@tocus-onboarding-language-select=${ this.handleLanguageSelect }
					@tocus-onboarding-language-continue=${ this.handleLanguageContinue }
				></tocus-f-onboarding-language-step>
			`;
		}

		if ( this.step === OnboardingStep.APPEARANCE ) {
			return html`
				<tocus-f-onboarding-appearance-step
					data-onboarding-step
					.copy=${ this.copy.appearance }
					.errorMessage=${ preferenceError }
					.theme=${ this.theme }
					.palette=${ this.palette }
					.pending=${ this.preferencePending }
					@tocus-onboarding-appearance-select=${ this.handleAppearanceSelect }
					@tocus-onboarding-appearance-continue=${ this.handleAppearanceContinue }
				></tocus-f-onboarding-appearance-step>
			`;
		}

		return html`
			<tocus-f-onboarding-sites-step
				data-onboarding-step
				.copy=${ this.copy.sites }
				.enrollment=${ this.enrollment }
				.protectedSites=${ this.protectedSites }
				.suggestions=${ this.suggestions }
				@tocus-onboarding-sites-finish=${ this.handleSitesFinish }
			></tocus-f-onboarding-sites-step>
		`;
	}

	/**
	 * Renders the complete local-first onboarding shell.
	 * @return Full-page onboarding experience or an empty template until copy is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}

		const currentStepIndex = OnboardingSteps.indexOf( this.step );
		const progress = this.copy.formatStepProgress(
			currentStepIndex + 1,
			OnboardingSteps.length,
			this.copy.stepNames[ this.step ],
		);
		const layoutClass = this.isPausePreviewVisible()
			? 'onboarding-layout onboarding-layout-with-preview'
			: 'onboarding-layout';

		return html`
			<div class=${ layoutClass }>
				<header class="topbar">
					<div class="brand" aria-label="TOCus">
						<span class="brand-icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
						<span class="wordmark">TOCus</span>
					</div>
				</header>
				<main>
					<section class="context" aria-labelledby="onboarding-introduction">
						<p class="introduction" id="onboarding-introduction">${ this.copy.introduction }</p>
						<div class="privacy-card">
							<span class="privacy-mark" aria-hidden="true">
								${ unsafeSVG( lockIconMarkup ) }
							</span>
							<div>
								<strong>${ this.copy.privacyTitle }</strong>
								<p>${ this.copy.privacyDescription }</p>
							</div>
						</div>
					</section>
					<section
						class="setup-card"
						aria-label=${ this.startupUnavailable
							? this.copy.startupErrorTitle
							: this.completed
								? this.copy.completionTitle
								: progress }
					>
						${ this.startupUnavailable
							? this.renderRecovery()
							: this.completed ? this.renderCompletion() : html`
						<nav class="progress" aria-label=${ this.copy.progressLabel }>
							<ol>
								${ OnboardingSteps.map( ( step, index ) => html`
									<li
										class=${ index < currentStepIndex ? 'complete' : '' }
										aria-current=${ step === this.step ? 'step' : 'false' }
									>
										<span aria-hidden="true">${ ( index + 1 ).toString() }</span>
										<strong>${ this.copy.stepNames[ step ] }</strong>
									</li>
								` ) }
							</ol>
						</nav>
						<div class="step-content">${ this.renderStep() }</div>
						` }
					</section>
				</main>
				<footer>${ this.copy.settingsNote }</footer>
			</div>
			${ this.renderPausePreview() }
		`;
	}
}

export {
	OnboardingCompleteEventName,
	OnboardingOpenSettingsEventName,
	OnboardingRetryEventName,
	OnboardingStep,
	type OnboardingShellCopy,
} from './types';

declare global {
	/**
	 * Maps the onboarding-shell tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-onboarding-shell': ComponentOnboardingShell;
	}
}
