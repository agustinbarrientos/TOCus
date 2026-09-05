import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import '../../../preferences/components/appearance-controls';
import {
	type AppearanceControlsChangeDetail,
} from '../../../preferences/components/appearance-controls';
import styles from './web-component-style.scss?inline';
import {
	OnboardingAppearanceContinueEventName,
	OnboardingAppearanceSelectEventName,
	type OnboardingAppearanceEventDetail,
	type OnboardingAppearanceStepCopy,
	type OnboardingAppearanceSubmitEvent,
} from './types';

/**
 * Renders theme and color controls during onboarding.
 * @element tocus-f-onboarding-appearance-step
 * @summary Appearance onboarding step.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-onboarding-appearance-step' )
export class ComponentOnboardingAppearanceStep extends LitElement {
	/**
	 * Shadow-root styles for the onboarding Appearance step.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Appearance mode currently selected.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'data-tocus-theme', reflect: true } )
	accessor theme: ThemeModeValue = ThemeMode.SYSTEM;

	/**
	 * Full-scene palette currently selected.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'data-tocus-palette', reflect: true } )
	accessor palette: PaletteValue = Palette.BROWN;

	/**
	 * Whether the owning shell is persisting the appearance selection.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true, type: Boolean } )
	accessor pending = false;

	/**
	 * Localized persistence error supplied by the owning shell.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'error-message' } )
	accessor errorMessage = '';

	/**
	 * Complete localizable messages rendered by the step.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<OnboardingAppearanceStepCopy>;

	/**
	 * Emits the complete current appearance selection.
	 * @param eventName - Stable selection or continuation event name.
	 * @since 0.1.0 Initial implementation.
	 */
	private emitAppearance( eventName: string ): void {
		this.dispatchEvent( new CustomEvent<OnboardingAppearanceEventDetail>( eventName, {
			bubbles: true,
			composed: true,
			detail: {
				theme: this.theme,
				palette: this.palette,
			},
		} ) );
	}

	/**
	 * Applies and emits one selected value from the shared appearance controls.
	 * @param event - Shared controlled appearance change.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSelectionChange = (
		event: CustomEvent<AppearanceControlsChangeDetail>,
	): void => {
		event.stopPropagation();

		if ( 'theme' in event.detail.update ) {
			this.theme = event.detail.update.theme;
		} else {
			this.palette = event.detail.update.palette;
		}

		this.emitAppearance( OnboardingAppearanceSelectEventName );
	};

	/**
	 * Requests persistence of every appearance choice.
	 * @param event - Submitted Appearance-step form.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSubmit = ( event: OnboardingAppearanceSubmitEvent ): void => {
		event.preventDefault();

		if ( ! this.pending ) {
			this.emitAppearance( OnboardingAppearanceContinueEventName );
		}
	};

	/**
	 * Renders the onboarding Appearance step.
	 * @return Appearance selection form or an empty template until copy is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}

		return html`
			<section class="step" aria-labelledby="appearance-step-title">
				<header>
					<h1 id="appearance-step-title" tabindex="-1">${ this.copy.title }</h1>
					<p>${ this.copy.introduction }</p>
				</header>
				<form aria-busy=${ this.pending ? 'true' : 'false' } @submit=${ this.handleSubmit }>
					<tocus-f-appearance-controls
						.copy=${ this.copy }
						.theme=${ this.theme }
						.palette=${ this.palette }
						.disabled=${ this.pending }
						@tocus-appearance-controls-change=${ this.handleSelectionChange }
					></tocus-f-appearance-controls>
					<p class="error" role="alert">${ this.errorMessage }</p>
					<div class="actions">
						<button class="continue-action" type="submit" ?disabled=${ this.pending }>
							${ this.copy.continueLabel }
						</button>
					</div>
				</form>
			</section>
		`;
	}
}

export {
	OnboardingAppearanceContinueEventName,
	OnboardingAppearanceSelectEventName,
	type OnboardingAppearanceEventDetail,
	type OnboardingAppearanceStepCopy,
} from './types';

declare global {
	/**
	 * Maps the onboarding Appearance-step tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-onboarding-appearance-step': ComponentOnboardingAppearanceStep;
	}
}
