import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type PropertyValues,
	type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditor,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconSource } from '../../services/site-favicon-provider';
import {
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../services/site-permission-manager';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentService,
} from '../../services/protected-site-enrollment';
import { type SiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import styles from './web-component-style.scss?inline';
import {
	DefaultProtectedSiteItemCopy,
	ProtectedSiteAccessRestoredEventName,
	type ProtectedSiteAccessRestoredEventDetail,
	ProtectedSiteConfigurationChangedEventName,
	ProtectedSiteConfigurationChangeKind,
	type ProtectedSiteConfigurationChangedEventDetail,
	type ProtectedSiteEditSubmitEvent,
	type ProtectedSiteItemCopy,
} from './types';

/**
 * Renders one protected site's local identity and editable protection behavior.
 * @element tocus-f-protected-site-item
 * @summary Protected-site settings item.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-protected-site-item' )
export class ComponentProtectedSiteItem extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Persisted protected-site identity and matching configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor site: ProtectedSiteConfiguration | null = null;

	/**
	 * Resolved local display name and monogram presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor identity: SiteDisplayIdentity | null = null;

	/**
	 * Domain editor responsible for validated atomic persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: ProtectionConfigurationEditor | null = null;

	/**
	 * Feature service coordinating protected-site removal and browser access.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor enrollmentService: ProtectedSiteEnrollmentService | null = null;

	/**
	 * Browser-cached local favicon source, or null for the monogram fallback.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor faviconSource: SiteFaviconSource = null;

	/**
	 * Whether the browser currently grants every capability required by this site.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor accessGranted = true;

	/**
	 * Browser permission manager used to restore access after revocation.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor permissionManager: SitePermissionManager | null = null;

	/**
	 * Complete localizable messages rendered by the item.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy: Readonly<ProtectedSiteItemCopy> = DefaultProtectedSiteItemCopy;

	@state()
	private accessor editing = false;

	@state()
	private accessor faviconUnavailable = false;

	@state()
	private accessor operationError = '';

	@state()
	private accessor confirmingRemoval = false;

	@state()
	private accessor saving = false;

	@state()
	private accessor restoringAccess = false;

	/**
	 * Restores favicon eligibility when the owning screen supplies a new source.
	 * @param changedProperties - Properties changed before this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override willUpdate( changedProperties: PropertyValues<this> ): void {
		if ( changedProperties.has( 'faviconSource' ) ) {
			this.faviconUnavailable = false;
		}
	}

	/**
	 * Focuses one required control after the current render completes.
	 * @param selector - Control selector inside the shadow root.
	 * @return Promise resolved after focus is applied when the control exists.
	 * @since 0.1.0 Initial implementation.
	 */
	private async focusControl( selector: string ): Promise<void> {
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLElement>( selector )?.focus();
	}

	/**
	 * Focuses the primary edit action after an owning list rerenders this item.
	 * @return Promise resolved after focus is applied.
	 * @since 0.1.0 Initial implementation.
	 */
	public async focusEditAction(): Promise<void> {
		await this.focusControl( '.edit-action' );
	}

	/**
	 * Opens the inline site editor.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleEdit = (): void => {
		this.operationError = '';
		this.confirmingRemoval = false;
		this.editing = true;
		void this.focusControl( '#display-name' );
	};

	/**
	 * Closes the inline editor without persisting changes.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleCancel = (): void => {
		this.operationError = '';
		this.confirmingRemoval = false;
		this.editing = false;
		void this.focusControl( '.edit-action' );
	};

	/**
	 * Clears the editable name field so automatic local naming is restored on save.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleUseAutomaticName = (): void => {
		const input = this.shadowRoot?.querySelector<HTMLInputElement>( '#display-name' );

		if ( input !== null && input !== undefined ) {
			input.value = '';
			input.focus();
		}
	};

	/**
	 * Uses the deterministic monogram after a cached favicon cannot be rendered.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleFaviconError = (): void => {
		this.faviconUnavailable = true;
	};

	/**
	 * Restores the complete browser grant required by the current protected site.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRestoreAccess = async (): Promise<void> => {
		if ( this.restoringAccess || this.site === null || this.permissionManager === null ) {
			return;
		}

		this.restoringAccess = true;
		this.operationError = '';

		try {
			const result = await this.permissionManager.request( this.site.rule );

			if ( result.status !== SitePermissionRequestStatus.GRANTED ) {
				this.operationError = this.copy.accessRequestError;
				return;
			}

			this.dispatchEvent( new CustomEvent<ProtectedSiteAccessRestoredEventDetail>(
				ProtectedSiteAccessRestoredEventName,
				{
					bubbles: true,
					composed: true,
					detail: { identityHost: this.site.identityHost },
				},
			) );
		} catch {
			this.operationError = this.copy.accessRequestError;
		} finally {
			this.restoringAccess = false;
		}
	};

	/**
	 * Opens the inline removal confirmation.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRequestRemoval = (): void => {
		this.confirmingRemoval = true;
		void this.focusControl( '.confirm-remove-action' );
	};

	/**
	 * Returns from removal confirmation to the editable form.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleKeepSite = (): void => {
		this.confirmingRemoval = false;
		void this.focusControl( '.remove-action' );
	};

	/**
	 * Emits one persisted configuration to the owning settings screen.
	 * @param detail - Complete protected-site configuration change detail.
	 * @since 0.1.0 Initial implementation.
	 */
	private announceConfigurationChange(
		detail: ProtectedSiteConfigurationChangedEventDetail,
	): void {
		this.dispatchEvent( new CustomEvent<ProtectedSiteConfigurationChangedEventDetail>(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail,
			},
		) );
	}

	/**
	 * Saves the editable display name and shared or independent behavior atomically.
	 * @param event - Inline edit form submission.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSubmit = async ( event: ProtectedSiteEditSubmitEvent ): Promise<void> => {
		event.preventDefault();

		if ( this.saving ) {
			return;
		}

		if ( this.site === null || this.editor === null ) {
			this.operationError = this.copy.operationError;
			return;
		}

		const form = event.currentTarget;
		const formData = new FormData( form );
		const displayName = formData.get( 'display-name' );
		const independent = formData.get( 'behavior' ) === 'independent';
		this.saving = true;
		this.operationError = '';

		try {
			const result = await this.editor.update(
				this.site.identityHost,
				displayName,
				independent,
			);

			if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
				this.operationError = this.copy.configurationChangedError;
				return;
			}

			this.announceConfigurationChange( {
				kind: ProtectedSiteConfigurationChangeKind.UPDATED,
				identityHost: this.site.identityHost,
				configuration: result.configuration,
			} );
			this.editing = false;
			this.confirmingRemoval = false;
			void this.focusControl( '.edit-action' );
		} catch {
			this.operationError = this.copy.operationError;
		} finally {
			this.saving = false;
		}
	};

	/**
	 * Removes the current site after inline confirmation.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleConfirmRemoval = async (): Promise<void> => {
		if ( this.saving ) {
			return;
		}

		if ( this.site === null || this.enrollmentService === null ) {
			this.operationError = this.copy.operationError;
			return;
		}

		this.saving = true;
		this.operationError = '';

		try {
			const result = await this.enrollmentService.remove( this.site );

			if ( result.status !== ProtectedSiteEnrollmentStatus.REMOVED ) {
				this.operationError = this.copy.configurationChangedError;
				return;
			}

			this.announceConfigurationChange( {
				kind: ProtectedSiteConfigurationChangeKind.REMOVED,
				identityHost: this.site.identityHost,
				configuration: result.configuration,
				permissionReleaseStatus: result.permissionReleaseStatus,
			} );
		} catch {
			this.operationError = this.copy.operationError;
		} finally {
			this.saving = false;
		}
	};

	/**
	 * Renders the protected-site summary when complete inputs are available.
	 * @return Protected-site item template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( this.site === null || this.identity === null ) {
			return html``;
		}

		const independent = this.site.rule.scopeId !== DefaultProtectionScopeId;
		const boundary = this.copy.formatBoundary(
			this.site.rule.host,
			this.site.rule.includeSubdomains,
		);
		const faviconSource = this.faviconSource ?? '';
		const showFavicon = faviconSource !== '' && ! this.faviconUnavailable;

		return html`
			<article aria-labelledby="site-name">
				<div class="summary">
					<span
						class="site-icon"
						data-color-index=${ String( this.identity.colorIndex ) }
						aria-hidden="true"
					>
						${ showFavicon
							? html`<img
								alt=""
								width="32"
								height="32"
								src=${ faviconSource }
								@error=${ this.handleFaviconError }
							>`
							: html`<span class="monogram">${ this.identity.monogram }</span>` }
					</span>
					<div class="identity">
						<h3 id="site-name">${ this.identity.name }</h3>
						<p class="domain">${ this.site.rule.host }</p>
					</div>
					<span class="scope-label">
						${ independent ? this.copy.independentLabel : this.copy.sharedLabel }
					</span>
					<button
						class="edit-action"
						type="button"
						aria-expanded=${ this.editing ? 'true' : 'false' }
						@click=${ this.handleEdit }
					>${ this.copy.edit }</button>
				</div>
				<p class="boundary">${ boundary }</p>
				${ this.accessGranted ? html`` : html`
					<div class="access-required" role="status">
						<span>${ this.copy.accessRequired }</span>
						<button
							class="restore-access-action"
							type="button"
							?disabled=${ this.restoringAccess || this.permissionManager === null }
							@click=${ this.handleRestoreAccess }
						>${ this.restoringAccess ? this.copy.allowingAccess : this.copy.allowAccess }</button>
					</div>
					${ this.renderOperationError() }
				` }
				${ this.editing ? this.renderEditor( this.site, this.identity, independent ) : html`` }
			</article>
		`;
	}

	/**
	 * Renders the inline editor or removal confirmation.
	 * @param site - Persisted site rendered by this editor.
	 * @param identity - Resolved local identity rendered by this editor.
	 * @param independent - Whether the current site has its own scope.
	 * @return Inline edit presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderEditor(
		site: ProtectedSiteConfiguration,
		identity: SiteDisplayIdentity,
		independent: boolean,
	): TemplateResult {
		if ( this.confirmingRemoval ) {
			return html`
				<div class="remove-confirmation" role="group" aria-labelledby="remove-question">
					<p id="remove-question">${ this.copy.formatRemoveQuestion( identity.name ) }</p>
					<div class="editor-actions">
						<button type="button" ?disabled=${ this.saving } @click=${ this.handleKeepSite }>
							${ this.copy.keepSite }
						</button>
						<button
							class="confirm-remove-action dangerous-action"
							type="button"
							?disabled=${ this.saving }
							@click=${ this.handleConfirmRemoval }
						>${ this.saving ? this.copy.saving : this.copy.confirmRemove }</button>
					</div>
					${ this.renderOperationError() }
				</div>
			`;
		}

		return html`
			<form @submit=${ this.handleSubmit }>
				<div class="name-field">
					<label for="display-name">${ this.copy.displayNameLabel }</label>
					<div class="name-control">
						<input
							id="display-name"
							name="display-name"
							type="text"
							maxlength="80"
							.value=${ site.displayNameOverride ?? identity.name }
							?disabled=${ this.saving }
						>
						<button type="button" ?disabled=${ this.saving } @click=${ this.handleUseAutomaticName }>
							${ this.copy.useAutomaticName }
						</button>
					</div>
				</div>
				<fieldset>
					<legend>${ this.copy.behaviorLegend }</legend>
					<label class="behavior-option">
						<input
							type="radio"
							name="behavior"
							value="shared"
							.checked=${ ! independent }
							?disabled=${ this.saving }
						>
						<span class="behavior-selection" aria-hidden="true"></span>
						<span>
							<strong>${ this.copy.sharedBehavior }</strong>
							<small>${ this.copy.sharedBehaviorDescription }</small>
						</span>
					</label>
					<label class="behavior-option">
						<input
							type="radio"
							name="behavior"
							value="independent"
							.checked=${ independent }
							?disabled=${ this.saving }
						>
						<span class="behavior-selection" aria-hidden="true"></span>
						<span>
							<strong>${ this.copy.independentBehavior }</strong>
							<small>${ this.copy.independentBehaviorDescription }</small>
						</span>
					</label>
				</fieldset>
				${ this.renderOperationError() }
				<div class="editor-footer">
					<button
						class="remove-action dangerous-action"
						type="button"
						?disabled=${ this.saving }
						@click=${ this.handleRequestRemoval }
					>${ this.copy.removeSite }</button>
					<div class="editor-actions">
						<button type="button" ?disabled=${ this.saving } @click=${ this.handleCancel }>
							${ this.copy.cancel }
						</button>
						<button class="primary-action" type="submit" ?disabled=${ this.saving }>
							${ this.saving ? this.copy.saving : this.copy.saveChanges }
						</button>
					</div>
				</div>
			</form>
		`;
	}

	/**
	 * Renders a persistent operation error when the current action failed.
	 * @return Error message or an empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderOperationError(): TemplateResult {
		return this.operationError === ''
			? html``
			: html`<p class="operation-error" role="alert">${ this.operationError }</p>`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the protected-site item tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-protected-site-item': ComponentProtectedSiteItem;
	}
}
