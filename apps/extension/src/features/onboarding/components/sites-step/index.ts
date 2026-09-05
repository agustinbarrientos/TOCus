import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type PropertyValues,
	type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	ProtectionConfigurationEditRejectionReason,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
	type ProtectedSiteEnrollmentService,
} from '../../../protected-sites/services/protected-site-enrollment';
import { type OnboardingSiteSuggestion } from '../../utils/site-suggestion-catalog';
import circleCheckIconMarkup from '../../assets/icon-circle-check.svg?raw';
import styles from './web-component-style.scss?inline';
import {
	OnboardingSitesFinishEventName,
	OnboardingSiteUnexpectedFailure,
	type OnboardingEnrollmentFailure,
	type OnboardingSiteSubmitEvent,
	type OnboardingSiteSuggestionClickEvent,
	type OnboardingSitesStepCopy,
} from './types';

/**
 * Renders built-in suggestions and direct manual site enrollment during onboarding.
 * @element tocus-f-onboarding-sites-step
 * @summary Protected-site onboarding step.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-onboarding-sites-step' )
export class ComponentOnboardingSitesStep extends LitElement {
	/**
	 * Shadow-root styles for the onboarding Sites step.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Enrollment service invoked directly by each user action.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor enrollment: ProtectedSiteEnrollmentService | null = null;

	/**
	 * Canonical matching hosts protected before or outside this component.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor protectedRuleHosts: readonly CanonicalHost[] = [];

	/**
	 * Fixed local suggestions displayed in their supplied order.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor suggestions: readonly Readonly<OnboardingSiteSuggestion>[] = [];

	/**
	 * Complete localizable messages rendered by the step.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<OnboardingSitesStepCopy>;

	@state()
	private accessor selectedRuleHosts: ReadonlySet<string> = new Set();

	@state()
	private accessor pendingSiteInput: string | null = null;

	@state()
	private accessor pendingManualSite = false;

	@state()
	private accessor suggestionFailure: OnboardingEnrollmentFailure | null = null;

	@state()
	private accessor manualFailure: OnboardingEnrollmentFailure | null = null;

	@state()
	private accessor announcedSiteName: string | null = null;

	@state()
	private accessor announcementSequence = 0;

	/**
	 * Incorporates authoritative protected rules without discarding successful local enrollment state.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override willUpdate( changedProperties: PropertyValues<this> ): void {
		if ( changedProperties.has( 'protectedRuleHosts' ) ) {
			this.selectedRuleHosts = new Set( [
				...this.selectedRuleHosts,
				...this.protectedRuleHosts,
			] );
		}
	}

	/**
	 * Resolves one presentation-neutral enrollment failure to localized copy.
	 * @param result - Enrollment failure returned by the feature service.
	 * @return Localized recoverable error.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentEnrollmentFailure( result: OnboardingEnrollmentFailure ): string {
		if ( result === OnboardingSiteUnexpectedFailure ) {
			return this.copy.unexpectedError;
		}

		if ( result.status === ProtectedSiteEnrollmentStatus.REJECTED ) {
			if ( result.reason === ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED ) {
				return this.copy.alreadyProtectedError;
			}

			return result.reason === ProtectionConfigurationEditRejectionReason.INVALID_SITE
				? this.copy.invalidSiteError
				: this.copy.saveError;
		}

		const messages = {
			[ ProtectedSiteEnrollmentStatus.PERMISSION_DENIED ]: this.copy.permissionDeniedError,
			[ ProtectedSiteEnrollmentStatus.PERMISSION_ERROR ]: this.copy.permissionRequestError,
			[ ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED ]: this.copy.permissionRetainedError,
			[ ProtectedSiteEnrollmentStatus.SAVE_ERROR ]: this.copy.saveError,
		};

		return messages[ result.status ];
	}

	/**
	 * Marks one successful site rule and announces the visible site name.
	 * @param ruleHost - Canonical matching rule added to protection.
	 * @param siteName - Site name displayed to the user.
	 * @since 0.1.0 Initial implementation.
	 */
	private markSiteSelected( ruleHost: CanonicalHost, siteName: string ): void {
		this.selectedRuleHosts = new Set( [ ...this.selectedRuleHosts, ruleHost ] );
		this.announcedSiteName = siteName;
		this.announcementSequence += 1;
	}

	/**
	 * Presents one localized enrollment error beside the action that caused it.
	 * @param failure - Presentation-neutral recoverable failure.
	 * @param suggestion - Matching suggestion, or null for manual entry.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentEnrollmentError(
		failure: OnboardingEnrollmentFailure,
		suggestion: Readonly<OnboardingSiteSuggestion> | null,
	): void {
		if ( suggestion === null ) {
			this.manualFailure = failure;
		} else {
			this.suggestionFailure = failure;
		}
	}

	/**
	 * Enrolls one site while preventing concurrent browser permission prompts.
	 * @param siteInput - Domain or URL passed directly to enrollment.
	 * @param suggestion - Matching built-in suggestion, or null for manual entry.
	 * @return Whether enrollment completed successfully.
	 * @since 0.1.0 Initial implementation.
	 */
	private async enrollSite(
		siteInput: string,
		suggestion: Readonly<OnboardingSiteSuggestion> | null,
	): Promise<boolean> {
		if ( this.pendingSiteInput !== null || this.enrollment === null ) {
			return false;
		}

		this.pendingSiteInput = siteInput;
		this.suggestionFailure = null;
		this.manualFailure = null;
		this.announcedSiteName = null;

		try {
			const result: ProtectedSiteEnrollmentResult = await this.enrollment.add( siteInput, false );

			if ( result.status === ProtectedSiteEnrollmentStatus.ADDED ) {
				const siteName = suggestion?.displayName ?? result.site.displayNameOverride ?? result.site.identityHost;

				this.markSiteSelected( result.site.rule.host, siteName );

				return true;
			}

			if (
				suggestion !== null &&
				result.status === ProtectedSiteEnrollmentStatus.REJECTED &&
				result.reason === ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED
			) {
				this.markSiteSelected( suggestion.ruleHost, suggestion.displayName );

				return true;
			}

			this.presentEnrollmentError( result, suggestion );

			return false;
		} catch {
			this.presentEnrollmentError( OnboardingSiteUnexpectedFailure, suggestion );

			return false;
		} finally {
			this.pendingSiteInput = null;
		}
	}

	/**
	 * Starts enrollment for one built-in suggestion in the original click stack.
	 * @param event - Suggestion button click.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSuggestionClick = ( event: OnboardingSiteSuggestionClickEvent ): void => {
		const suggestion = this.suggestions.find(
			( candidate ) => candidate.id === event.currentTarget.dataset.siteId,
		);

		if ( suggestion === undefined || this.selectedRuleHosts.has( suggestion.ruleHost ) ) {
			return;
		}

		void this.enrollSite( suggestion.siteInput, suggestion );
	};

	/**
	 * Starts manual shared whole-domain enrollment in the original submit stack.
	 * @param event - Manual add-site submission.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleManualSubmit = ( event: OnboardingSiteSubmitEvent ): void => {
		event.preventDefault();

		if ( this.pendingSiteInput !== null ) {
			return;
		}

		const input = event.currentTarget.elements.namedItem( 'site-address' );

		if ( ! ( input instanceof HTMLInputElement ) ) {
			return;
		}

		this.pendingManualSite = true;
		void this.enrollSite( input.value, null ).then( ( added ) => {
			if ( added ) {
				input.value = '';
			}

			this.pendingManualSite = false;
		} );
	};

	/**
	 * Emits a plain completion request while no enrollment is pending.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleFinish = (): void => {
		if ( this.pendingSiteInput !== null ) {
			return;
		}

		this.dispatchEvent( new Event( OnboardingSitesFinishEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};

	/**
	 * Renders one built-in local site suggestion.
	 * @param suggestion - Suggestion displayed by the button.
	 * @return Accessible suggestion action.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderSuggestion( suggestion: Readonly<OnboardingSiteSuggestion> ): TemplateResult {
		const selected = this.selectedRuleHosts.has( suggestion.ruleHost );
		const pending = this.pendingSiteInput === suggestion.siteInput;
		const actionLabel = selected
			? this.copy.formatAddedSuggestionLabel( suggestion.displayName )
			: pending
				? this.copy.formatAddingSuggestionLabel( suggestion.displayName )
				: this.copy.formatAddSuggestionLabel( suggestion.displayName );

		return html`
			<button
				class="suggestion"
				data-site-id=${ suggestion.id }
				type="button"
				aria-busy=${ pending ? 'true' : 'false' }
				aria-label=${ actionLabel }
				aria-pressed=${ selected ? 'true' : 'false' }
				?disabled=${ selected || this.pendingSiteInput !== null || this.enrollment === null }
				@click=${ this.handleSuggestionClick }
			>
				<span class="site-icon" aria-hidden="true"><img src=${ suggestion.iconUrl } alt=""></span>
				<strong>${ suggestion.displayName }</strong>
				${ selected
					? html`<span class="selection-mark" aria-hidden="true">${ unsafeSVG( circleCheckIconMarkup ) }</span>`
					: null }
			</button>
		`;
	}

	/**
	 * Renders the onboarding Sites step.
	 * @return Suggested and manual enrollment controls or an empty template until copy is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}

		const enrollmentUnavailable = this.enrollment === null;
		const actionsDisabled = enrollmentUnavailable || this.pendingSiteInput !== null;
		const suggestionError = this.suggestionFailure === null
			? ''
			: this.presentEnrollmentFailure( this.suggestionFailure );
		const manualError = this.manualFailure === null
			? ''
			: this.presentEnrollmentFailure( this.manualFailure );
		const announcement = this.announcedSiteName === null
			? ''
			: this.copy.formatAddedAnnouncement( this.announcedSiteName );

		return html`
			<section class="step" aria-labelledby="sites-step-title">
				<header>
					<h1 id="sites-step-title" tabindex="-1">${ this.copy.title }</h1>
					<p>${ this.copy.introduction }</p>
				</header>
				<section class="suggestions" aria-labelledby="suggestions-title" aria-describedby="suggestions-error">
					<div class="section-heading">
						<h2 id="suggestions-title">${ this.copy.suggestionsLegend }</h2>
					</div>
					<div class="suggestion-grid">
						${ this.suggestions.map( ( suggestion ) => this.renderSuggestion( suggestion ) ) }
					</div>
					<p class="suggestion-error" id="suggestions-error" role="alert">${ suggestionError }</p>
				</section>
				<form class="manual-form" aria-busy=${ this.pendingManualSite ? 'true' : 'false' } @submit=${ this.handleManualSubmit }>
					<h2>${ this.copy.manualLegend }</h2>
					<div class="manual-control">
						<input
							id="onboarding-site-address"
							name="site-address"
							type="text"
							placeholder=${ this.copy.addressPlaceholder }
							autocomplete="url"
							aria-label=${ this.copy.addressLabel }
							aria-describedby="onboarding-site-help manual-error"
							aria-invalid=${ manualError === '' ? 'false' : 'true' }
							?disabled=${ actionsDisabled }
						>
						<button type="submit" ?disabled=${ actionsDisabled }>
							${ this.pendingManualSite ? this.copy.addingSiteLabel : this.copy.addSiteLabel }
						</button>
					</div>
					<p class="field-help" id="onboarding-site-help">${ this.copy.addressHelp }</p>
					<p class="manual-error" id="manual-error" role="alert">${ manualError }</p>
				</form>
				<div class="actions">
					<button class="finish-action" type="button" ?disabled=${ this.pendingSiteInput !== null } @click=${ this.handleFinish }>
						${ this.copy.finishLabel }
					</button>
				</div>
				<p class="announcement" role="status" aria-live="polite">
					${ announcement === ''
						? null
						: keyed( this.announcementSequence, html`<span>${ announcement }</span>` ) }
				</p>
			</section>
		`;
	}
}

export {
	OnboardingSitesFinishEventName,
	type OnboardingSitesStepCopy,
} from './types';

declare global {
	/**
	 * Maps the onboarding Sites-step tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-onboarding-sites-step': ComponentOnboardingSitesStep;
	}
}
