import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	Language,
	type Language as LanguageValue,
} from '../../../../domains/preferences/types';
import { getLanguageTag } from '../../../../domains/preferences/utils/resolve-language';
import styles from './web-component-style.scss?inline';
import {
	OnboardingLanguageContinueEventName,
	OnboardingLanguageFamily,
	OnboardingLanguageSelectEventName,
	type OnboardingLanguageEventDetail,
	type OnboardingLanguageFamily as OnboardingLanguageFamilyValue,
	type OnboardingLanguageInputEvent,
	type OnboardingLanguageStepCopy,
	type OnboardingLanguageSubmitEvent,
} from './types';

/**
 * Fixed onboarding language-family order.
 * @since 0.1.0 Initial implementation.
 */
const LanguageFamilies: readonly OnboardingLanguageFamilyValue[] = Object.freeze( [
	OnboardingLanguageFamily.ENGLISH,
	OnboardingLanguageFamily.SPANISH,
	OnboardingLanguageFamily.PORTUGUESE,
	OnboardingLanguageFamily.ITALIAN,
	OnboardingLanguageFamily.FRENCH,
	OnboardingLanguageFamily.GERMAN,
	OnboardingLanguageFamily.JAPANESE,
	OnboardingLanguageFamily.RUSSIAN,
] );

/**
 * Resolves one exact language to its visible onboarding family.
 * @param language - Exact language selected by the user.
 * @return Matching language family.
 * @since 0.1.0 Initial implementation.
 */
function getLanguageFamily( language: LanguageValue ): OnboardingLanguageFamilyValue {
	if ( language === Language.SPANISH_TU || language === Language.SPANISH_VOS ) {
		return OnboardingLanguageFamily.SPANISH;
	}

	if ( language === Language.PORTUGUESE_BRAZIL || language === Language.PORTUGUESE_PORTUGAL ) {
		return OnboardingLanguageFamily.PORTUGUESE;
	}

	return language;
}

/**
 * Resolves a newly selected family to one exact supported language.
 * @param family - Language family selected by the user.
 * @param currentLanguage - Exact language selected before the family changed.
 * @return Exact language to retain or select by default.
 * @since 0.1.0 Initial implementation.
 */
function resolveFamilyLanguage(
	family: OnboardingLanguageFamilyValue,
	currentLanguage: LanguageValue,
): LanguageValue {
	if ( family === OnboardingLanguageFamily.SPANISH ) {
		return currentLanguage === Language.SPANISH_VOS
			? Language.SPANISH_VOS
			: Language.SPANISH_TU;
	}

	if ( family === OnboardingLanguageFamily.PORTUGUESE ) {
		return currentLanguage === Language.PORTUGUESE_PORTUGAL
			? Language.PORTUGUESE_PORTUGAL
			: Language.PORTUGUESE_BRAZIL;
	}

	return family;
}

/**
 * Renders the explicit language choice at the start of onboarding.
 * @element tocus-f-onboarding-language-step
 * @summary Language and regional-form selection step.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-onboarding-language-step' )
export class ComponentOnboardingLanguageStep extends LitElement {
	/**
	 * Shadow-root styles for the onboarding Language step.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Exact supported language currently selected.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor language: LanguageValue = Language.ENGLISH;

	/**
	 * Whether the owning shell is persisting the selection.
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
	accessor copy!: Readonly<OnboardingLanguageStepCopy>;

	/**
	 * Emits one exact language selection to the owning shell.
	 * @param language - Exact supported language selected by the user.
	 * @since 0.1.0 Initial implementation.
	 */
	private selectLanguage( language: LanguageValue ): void {
		this.language = language;
		this.dispatchEvent( new CustomEvent<OnboardingLanguageEventDetail>(
			OnboardingLanguageSelectEventName,
			{
				bubbles: true,
				composed: true,
				detail: { language },
			},
		) );
	}

	/**
	 * Resolves and emits a language-family selection.
	 * @param event - Changed language-family radio control.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleFamilyChange = ( event: OnboardingLanguageInputEvent ): void => {
		if ( ! event.currentTarget.checked || this.pending ) {
			return;
		}

		const family = LanguageFamilies.find( ( option ) => option === event.currentTarget.value );

		if ( family !== undefined ) {
			this.selectLanguage( resolveFamilyLanguage( family, this.language ) );
		}
	};

	/**
	 * Emits one exact Spanish or Portuguese selection.
	 * @param event - Changed regional-form radio control.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleVariantChange = ( event: OnboardingLanguageInputEvent ): void => {
		if ( ! event.currentTarget.checked || this.pending ) {
			return;
		}

		const result = Object.values( Language ).find( ( language ) => language === event.currentTarget.value );

		if ( result !== undefined ) {
			this.selectLanguage( result );
		}
	};

	/**
	 * Requests persistence of the currently selected exact language.
	 * @param event - Submitted Language-step form.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSubmit = ( event: OnboardingLanguageSubmitEvent ): void => {
		event.preventDefault();

		if ( this.pending ) {
			return;
		}

		this.dispatchEvent( new CustomEvent<OnboardingLanguageEventDetail>(
			OnboardingLanguageContinueEventName,
			{
				bubbles: true,
				composed: true,
				detail: { language: this.language },
			},
		) );
	};

	/**
	 * Renders one top-level language-family option.
	 * @param family - Stable family value.
	 * @param selectedFamily - Family selected by the exact current language.
	 * @return Native radio option with a localized autonym.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderFamilyOption(
		family: OnboardingLanguageFamilyValue,
		selectedFamily: OnboardingLanguageFamilyValue,
	): TemplateResult {
		const id = `language-family-${ family }`;

		return html`
			<label class="language-option" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name="language-family"
					value=${ family }
					.checked=${ selectedFamily === family }
					?disabled=${ this.pending }
					@change=${ this.handleFamilyChange }
				>
				<span class="selection" aria-hidden="true"></span>
				<strong lang=${ family }>${ this.copy.languageLabels[ family ] }</strong>
			</label>
		`;
	}

	/**
	 * Renders one exact conversational or regional language option.
	 * @param value - Exact supported language value.
	 * @param label - Localized variant label.
	 * @return Native nested radio option.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderVariantOption( value: LanguageValue, label: string ): TemplateResult {
		const id = `language-variant-${ value }`;

		return html`
			<label class="language-option" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name="language-variant"
					value=${ value }
					.checked=${ this.language === value }
					?disabled=${ this.pending }
					@change=${ this.handleVariantChange }
				>
				<span class="selection" aria-hidden="true"></span>
				<strong lang=${ getLanguageTag( value ) }>${ label }</strong>
			</label>
		`;
	}

	/**
	 * Renders the regional form required by the selected language family.
	 * @param family - Currently selected family.
	 * @return Regional-form radios or an empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderVariantChoice( family: OnboardingLanguageFamilyValue ): TemplateResult {
		if ( family === OnboardingLanguageFamily.SPANISH ) {
			return html`
				<fieldset class="variant-choice">
					<legend>${ this.copy.spanishVariantLegend }</legend>
					<div class="variant-options">
						${ this.renderVariantOption( Language.SPANISH_TU, this.copy.spanishTuLabel ) }
						${ this.renderVariantOption( Language.SPANISH_VOS, this.copy.spanishVosLabel ) }
					</div>
				</fieldset>
			`;
		}

		if ( family === OnboardingLanguageFamily.PORTUGUESE ) {
			return html`
				<fieldset class="variant-choice">
					<legend>${ this.copy.portugueseVariantLegend }</legend>
					<div class="variant-options">
						${ this.renderVariantOption( Language.PORTUGUESE_BRAZIL, this.copy.portugueseBrazilLabel ) }
						${ this.renderVariantOption( Language.PORTUGUESE_PORTUGAL, this.copy.portuguesePortugalLabel ) }
					</div>
				</fieldset>
			`;
		}

		return html``;
	}

	/**
	 * Renders the onboarding Language step.
	 * @return Language selection form or an empty template until copy is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}

		const selectedFamily = getLanguageFamily( this.language );

		return html`
			<section class="step" aria-labelledby="language-step-title">
				<header>
					<h1 id="language-step-title" tabindex="-1">${ this.copy.title }</h1>
					<p>${ this.copy.introduction }</p>
				</header>
				<form aria-busy=${ this.pending ? 'true' : 'false' } @submit=${ this.handleSubmit }>
					<fieldset>
						<legend>${ this.copy.languageLegend }</legend>
						<div class="language-options">
							${ LanguageFamilies.map( ( family ) => this.renderFamilyOption( family, selectedFamily ) ) }
						</div>
					</fieldset>
					${ this.renderVariantChoice( selectedFamily ) }
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
	OnboardingLanguageContinueEventName,
	OnboardingLanguageFamily,
	OnboardingLanguageSelectEventName,
	type OnboardingLanguageEventDetail,
	type OnboardingLanguageStepCopy,
} from './types';

declare global {
	/**
	 * Maps the onboarding Language-step tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-onboarding-language-step': ComponentOnboardingLanguageStep;
	}
}
