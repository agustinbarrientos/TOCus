import { LitElement, css, html, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor';
import { ProtectedSiteConfigurationSetSchema, type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { canonicalizeProtectedSite, ProtectedSiteCanonicalizationStatus } from '../../../../domains/protection/utils/protected-site-canonicalizer';
import { ProtectedSiteEnrollmentStatus, type ProtectedSiteEnrollmentService } from '../../../protected-sites/services/protected-site-enrollment';
import { SitePermissionReleaseStatus } from '../../../protected-sites/services/site-permission-manager';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import { type OnboardingSiteSuggestion } from '../../utils/site-suggestion-catalog';
import circleCheckIconMarkup from '../../assets/icon-circle-check.svg?raw';
import styles from './web-component-style.scss?inline';
import {
	OnboardingSitesFinishEventName,
	OnboardingSiteUnexpectedFailure,
	type OnboardingEnrollmentFailure,
	type OnboardingPendingSiteRemoval,
	type OnboardingSiteInputEvent,
	type OnboardingSiteRemovalClickEvent,
	type OnboardingSiteSubmitEvent,
	type OnboardingSiteSuggestionClickEvent,
	type OnboardingSitesStepCopy,
} from './types';

/**
 * Collects local website selections and requests browser access together at completion.
 * @element tocus-f-onboarding-sites-step
 * @summary Protected-site onboarding step.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-onboarding-sites-step' )
export class ComponentOnboardingSitesStep extends LitElement {
	/**
	 * Shadow-root styles for the Sites step.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Browser enrollment boundary invoked by explicit completion or persisted removal.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor enrollment: ProtectedSiteEnrollmentService | null = null;

	/**
	 * Authoritative protected sites loaded or changed outside this component.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor protectedSites: readonly ProtectedSiteConfiguration[] = [];

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
	private accessor currentSites: readonly ProtectedSiteConfiguration[] = [];

	@state()
	private accessor draftSites: readonly ProtectedSiteConfiguration[] = [];

	@state()
	private accessor hasManualAddress = false;

	@state()
	private accessor pending = false;

	/**
	 * Focused row kept mounted until removal and browser-access cleanup settle.
	 * @since 0.1.0 Initial implementation.
	 */
	private pendingRemoval: OnboardingPendingSiteRemoval | null = null;

	@state()
	private accessor manualFailure: OnboardingEnrollmentFailure | null = null;

	@state()
	private accessor finishFailure: OnboardingEnrollmentFailure | null = null;

	@state()
	private accessor removalFailed = false;

	@state()
	private accessor removedSiteName: string | null = null;

	@state()
	private accessor permissionRetained = false;

	@state()
	private accessor announcedSiteName: string | null = null;

	@state()
	private accessor announcementSequence = 0;

	/**
	 * Applies authoritative site changes while preserving unrelated local selections.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override willUpdate( changedProperties: PropertyValues<this> ): void {
		if ( changedProperties.has( 'protectedSites' ) ) {
			this.currentSites = this.protectedSites;
			this.draftSites = this.draftSites.filter( ( site ) =>
				ProtectedSiteConfigurationSetSchema.safeParse( [ ...this.currentSites, site ] ).success,
			);
		}
	}

	/**
	 * Returns the persisted and locally selected sites in visible order.
	 * @return Complete visible list.
	 * @since 0.1.0 Initial implementation.
	 */
	private get visibleSites(): readonly ProtectedSiteConfiguration[] {
		const sites = [ ...this.currentSites, ...this.draftSites ];
		const removal = this.pendingRemoval;
		if ( removal !== null && ! sites.some( ( site ) => site.identityHost === removal.site.identityHost ) ) {
			sites.splice( removal.index, 0, removal.site );
		}
		return sites;
	}

	/**
	 * Resolves one presentation-neutral enrollment failure to localized copy.
	 * @param result - Failure returned by enrollment or local validation.
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
	 * Validates and appends one local selection without requesting browser access.
	 * @param siteInput - User-entered domain or URL.
	 * @return Whether the local selection was accepted.
	 * @since 0.1.0 Initial implementation.
	 */
	private addDraft( siteInput: string ): boolean {
		const canonical = canonicalizeProtectedSite( siteInput, DefaultProtectionScopeId );
		this.manualFailure = null;
		this.finishFailure = null;
		this.removedSiteName = null;
		this.removalFailed = false;
		if ( canonical.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			this.manualFailure = {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
			};
			return false;
		}
		const site = { identityHost: canonical.identityHost, rule: canonical.rule };
		if ( ! ProtectedSiteConfigurationSetSchema.safeParse( [ ...this.visibleSites, site ] ).success ) {
			this.manualFailure = {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
			};
			return false;
		}
		this.draftSites = [ ...this.draftSites, site ];
		this.announcedSiteName = resolveSiteDisplayIdentity( site ).name;
		this.announcementSequence += 1;
		return true;
	}

	/**
	 * Restores focus beside a removed row only while its action still owns focus.
	 * @param source - Focused removal action, or null for a suggestion toggle.
	 * @param removedIndex - Former visible position of the removed row.
	 * @return Promise resolved after the list and focus settle.
	 * @since 0.1.0 Initial implementation.
	 */
	private async restoreRemovalFocus( source: HTMLButtonElement | null, removedIndex: number ): Promise<void> {
		if ( source === null || this.shadowRoot?.activeElement !== source ) {
			return;
		}
		await this.updateComplete;
		const buttons = this.renderRoot.querySelectorAll<HTMLButtonElement>( '.remove-action' );
		const target = buttons.length > 0
			? buttons.item( Math.min( removedIndex, buttons.length - 1 ) )
			: this.renderRoot.querySelector<HTMLInputElement>( '#onboarding-site-address' );
		target?.focus();
	}

	/**
	 * Removes a draft locally or delegates persisted removal to shared enrollment.
	 * @param site - Visible site selected for removal.
	 * @param source - Removal action whose focus may need to move after success.
	 * @return Promise resolved after removal settles.
	 * @since 0.1.0 Initial implementation.
	 */
	private async removeSite(
		site: ProtectedSiteConfiguration,
		source: HTMLButtonElement | null = null,
	): Promise<void> {
		if ( this.pending ) {
			return;
		}
		this.removalFailed = false;
		this.removedSiteName = null;
		this.permissionRetained = false;
		this.finishFailure = null;
		this.announcedSiteName = null;
		const removedIndex = this.visibleSites.findIndex(
			( candidate ) => candidate.identityHost === site.identityHost,
		);
		const name = resolveSiteDisplayIdentity( site ).name;
		if ( this.draftSites.some( ( draft ) => draft.identityHost === site.identityHost ) ) {
			this.draftSites = this.draftSites.filter( ( draft ) => draft.identityHost !== site.identityHost );
			this.removedSiteName = name;
			await this.restoreRemovalFocus( source, removedIndex );
			return;
		}
		if ( this.enrollment === null ) {
			return;
		}
		this.pendingRemoval = source !== null && this.shadowRoot?.activeElement === source
			? { site, index: removedIndex } : null;
		this.pending = true;
		try {
			const result = await this.enrollment.remove( site );
			if ( result.status !== ProtectedSiteEnrollmentStatus.REMOVED ) {
				this.removalFailed = true;
				return;
			}
			this.currentSites = result.configuration.sites;
			this.removedSiteName = name;
			this.permissionRetained = result.permissionReleaseStatus !== SitePermissionReleaseStatus.RELEASED;
		} catch {
			this.removalFailed = true;
			return;
		} finally {
			this.pendingRemoval = null;
			this.pending = false;
		}
		await this.restoreRemovalFocus( source, removedIndex );
	}

	/**
	 * Toggles one popular website in the visible selection.
	 * @param event - Suggestion button click.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSuggestionClick = ( event: OnboardingSiteSuggestionClickEvent ): void => {
		if ( this.pending ) {
			return;
		}
		const suggestion = this.suggestions.find(
			( candidate ) => candidate.id === event.currentTarget.dataset.siteId,
		);
		if ( suggestion === undefined ) {
			return;
		}
		const site = this.visibleSites.find( ( candidate ) => candidate.rule.host === suggestion.ruleHost );
		if ( site === undefined ) {
			this.addDraft( suggestion.siteInput );
		} else {
			void this.removeSite( site );
		}
	};

	/**
	 * Tracks whether the address makes the add action ready.
	 * @param event - Native address-field input.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleManualInput = ( event: OnboardingSiteInputEvent ): void => {
		this.hasManualAddress = event.currentTarget.value.trim() !== '';
	};

	/**
	 * Adds the manually entered address to the local selection.
	 * @param event - Manual add-site submission.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleManualSubmit = ( event: OnboardingSiteSubmitEvent ): void => {
		event.preventDefault();
		if ( this.pending ) {
			return;
		}
		const input = event.currentTarget.elements.namedItem( 'site-address' );
		if ( input instanceof HTMLInputElement && this.addDraft( input.value ) ) {
			input.value = '';
			this.hasManualAddress = false;
		}
	};

	/**
	 * Emits completion after browser access and persistence have succeeded.
	 * @since 0.1.0 Initial implementation.
	 */
	private announceFinish(): void {
		this.dispatchEvent( new Event( OnboardingSitesFinishEventName, { bubbles: true, composed: true } ) );
	}

	/**
	 * Requests all draft domains in the original Finish click stack.
	 * @return Promise resolved after enrollment and completion settle.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleFinish = async (): Promise<void> => {
		if ( this.pending ) {
			return;
		}
		if ( this.draftSites.length === 0 ) {
			this.announceFinish();
			return;
		}
		if ( this.enrollment === null ) {
			return;
		}
		this.pending = true;
		this.finishFailure = null;
		try {
			const result = await this.enrollment.addMany( this.draftSites.map( ( site ) => site.identityHost ) );
			if ( result.status !== ProtectedSiteEnrollmentStatus.ADDED ) {
				this.finishFailure = result;
				return;
			}
			this.currentSites = result.configuration.sites;
			this.draftSites = [];
			this.announceFinish();
		} catch {
			this.finishFailure = OnboardingSiteUnexpectedFailure;
		} finally {
			this.pending = false;
		}
	};

	/**
	 * Renders one locally packaged suggestion and its selection state.
	 * @param suggestion - Suggestion displayed by the button.
	 * @return Accessible toggle action.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderSuggestion( suggestion: Readonly<OnboardingSiteSuggestion> ): TemplateResult {
		const selected = this.visibleSites.some( ( site ) => site.rule.host === suggestion.ruleHost );
		const actionLabel = selected
			? `${ this.copy.removeSiteLabel }: ${ suggestion.displayName }`
			: this.copy.formatAddSuggestionLabel( suggestion.displayName );

		return html`
			<button
				class="suggestion"
				data-site-id=${ suggestion.id }
				type="button"
				aria-label=${ actionLabel }
				aria-pressed=${ selected ? 'true' : 'false' }
				?disabled=${ this.pending }
				@click=${ this.handleSuggestionClick }
			>
				<span class="site-icon" aria-hidden="true">
					<img src=${ suggestion.iconUrl } alt="">
				</span>
				<strong>${ suggestion.displayName }</strong>
				${ selected ? html`
					<span class="selection-mark" aria-hidden="true">
						${ unsafeSVG( circleCheckIconMarkup ) }
					</span>
				` : null }
			</button>
		`;
	}

	/**
	 * Renders one selected site with local identity and a direct removal action.
	 * @param site - Persisted or draft site displayed in the list.
	 * @return Compact accessible list row.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderSite( site: ProtectedSiteConfiguration ): TemplateResult {
		const identity = resolveSiteDisplayIdentity( site );
		const suggestion = this.suggestions.find( ( candidate ) => candidate.ruleHost === site.rule.host );
		const disabled = this.pending && this.pendingRemoval?.site.identityHost !== site.identityHost ||
			this.enrollment === null && this.currentSites.includes( site );

		return html`
			<li class="added-site">
				<span class="site-icon" aria-hidden="true">
					${ suggestion === undefined
						? html`<span class="monogram">${ identity.monogram }</span>`
						: html`<img src=${ suggestion.iconUrl } alt="">` }
				</span>
				<div class="site-identity">
					<strong>${ identity.name }</strong>
					<span>${ site.rule.host }</span>
				</div>
				<button
					class="remove-action"
					type="button"
					aria-label=${ `${ this.copy.removeSiteLabel }: ${ identity.name }` }
					aria-disabled=${ this.pending || disabled ? 'true' : 'false' }
					?disabled=${ disabled }
					@click=${ ( event: OnboardingSiteRemovalClickEvent ) =>
						void this.removeSite( site, event.currentTarget ) }
				>
					${ this.copy.removeSiteLabel }
				</button>
			</li>
		`;
	}

	/**
	 * Renders website selection, validation, and completion controls.
	 * @return Localized Sites step or an empty template while copy loads.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		const manualError = this.manualFailure === null ? '' : this.presentEnrollmentFailure( this.manualFailure );
		const finishError = this.finishFailure === null ? '' : this.presentEnrollmentFailure( this.finishFailure );
		const removalStatus = this.removalFailed ? this.copy.removalError : this.removedSiteName === null ? ''
			: this.permissionRetained ? this.copy.formatPermissionRetainedAnnouncement( this.removedSiteName )
				: this.copy.formatRemovedAnnouncement( this.removedSiteName );

		return html`
			<section class="step" aria-labelledby="sites-step-title" aria-busy=${ this.pending ? 'true' : 'false' }>
				<header>
					<h1 id="sites-step-title" tabindex="-1">${ this.copy.title }</h1>
					<p>${ this.copy.introduction }</p>
				</header>
				<section class="suggestions" aria-labelledby="suggestions-title">
					<div class="section-heading">
						<h2 id="suggestions-title">${ this.copy.suggestionsLegend }</h2>
					</div>
					<div class="suggestion-grid">
						${ this.suggestions.map( ( suggestion ) => this.renderSuggestion( suggestion ) ) }
					</div>
				</section>
				<form class="manual-form" @submit=${ this.handleManualSubmit }>
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
							?disabled=${ this.pending }
							@input=${ this.handleManualInput }
						>
						<button
							class=${ this.hasManualAddress ? 'filled-action' : '' }
							type="submit"
							?disabled=${ this.pending }
						>
							${ this.copy.addSiteLabel }
						</button>
					</div>
					<p class="field-help" id="onboarding-site-help">${ this.copy.addressHelp }</p>
					<p class="manual-error" id="manual-error" role="alert">${ manualError }</p>
				</form>
				${ this.visibleSites.length === 0 ? null : html`
					<ul class="added-sites">
						${ repeat( this.visibleSites, ( site ) => site.identityHost, ( site ) => this.renderSite( site ) ) }
					</ul>
				` }
				<p class="removal-status" role="status">${ removalStatus }</p>
				<p class="finish-error" role="alert">${ finishError }</p>
				${ this.draftSites.length === 0 ? null : html`
					<p class="field-help">${ this.copy.finishHelp }</p>
				` }
				<div class="actions">
					<button
						class="finish-action"
						type="button"
						?disabled=${ this.pending || ( this.draftSites.length > 0 && this.enrollment === null ) }
						@click=${ this.handleFinish }
					>
						${ this.pending ? this.copy.addingSiteLabel : this.copy.finishLabel }
					</button>
				</div>
				<p class="announcement" role="status" aria-live="polite">
					${ this.announcedSiteName === null ? null : keyed( this.announcementSequence, html`
						<span>${ this.copy.formatAddedAnnouncement( this.announcedSiteName ) }</span>
					` ) }
				</p>
			</section>
		`;
	}
}

export { OnboardingSitesFinishEventName, type OnboardingSitesStepCopy } from './types';

declare global {
	/**
	 * Maps the Sites-step tag to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-onboarding-sites-step': ComponentOnboardingSitesStep;
	}
}
