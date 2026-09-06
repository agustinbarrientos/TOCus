import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import styles from './web-component-style.scss?inline';
import { PrivacyResetAction, type PrivacyDataActions, type PrivacyScreenCopy } from './types';

/**
 * Explains local data and offers explicitly confirmed reset operations.
 * @element tocus-f-privacy-screen
 * @summary Privacy and local data settings.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-privacy-screen' )
export class ComponentPrivacyScreen extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Complete localized copy rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<PrivacyScreenCopy>;

	/**
	 * Authoritative local data operations, or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor actions: PrivacyDataActions | null = null;

	/**
	 * Whether the browser offers the cached favicon permission.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor supportsCachedFavicons = false;

	/**
	 * Operation awaiting explicit confirmation or retry.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor confirmation: PrivacyResetAction | null = null;

	/**
	 * Whether an authoritative reset is in flight.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor pending = false;

	/**
	 * Whether the most recent reset needs a retry.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor failed = false;

	/**
	 * Successful operation announced in the current language.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor completed: PrivacyResetAction | null = null;

	/**
	 * Opens one inline confirmation and focuses its non-destructive action.
	 * @param action - Operation requested by the user.
	 * @return Completion of the confirmation render.
	 * @since 0.1.0 Initial implementation.
	 */
	private async showConfirmation( action: PrivacyResetAction ): Promise<void> {
		if ( this.pending || this.actions === null ) {
			return;
		}
		this.confirmation = action;
		this.failed = false;
		this.completed = null;
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLButtonElement>( '#cancel-reset' )?.focus();
	}

	/**
	 * Closes confirmation without touching stored data.
	 * @return Completion of the trigger focus restoration.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly cancelReset = async (): Promise<void> => {
		if ( this.pending || this.confirmation === null ) {
			return;
		}
		const action = this.confirmation;
		this.confirmation = null;
		this.failed = false;
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLButtonElement>( `#reset-${ action }` )?.focus();
	};

	/**
	 * Executes only the confirmed operation and presents its authoritative result.
	 * @return Completion of the reset result and focus update.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly confirmReset = async (): Promise<void> => {
		if ( this.pending || this.actions === null || this.confirmation === null ) {
			return;
		}
		const action = this.confirmation;
		const actions = this.actions;
		this.pending = true;
		this.failed = false;
		let succeeded: boolean;
		try {
			succeeded = action === PrivacyResetAction.STATISTICS
				? await actions.resetStatistics()
				: await actions.resetAllData();
		} catch {
			succeeded = false;
		}
		this.pending = false;
		this.failed = ! succeeded;
		if ( succeeded ) {
			this.confirmation = null;
			this.completed = action;
		}
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLButtonElement>( succeeded ? `#reset-${ action }` : '#confirm-reset' )?.focus();
	};

	/**
	 * Renders a confirmation only beneath the selected reset section.
	 * @param action - Operation belonging to the section.
	 * @return Inline confirmation or an empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderConfirmation( action: PrivacyResetAction ): TemplateResult {
		if ( this.confirmation !== action ) {
			return html``;
		}
		const statistics = action === PrivacyResetAction.STATISTICS;
		return html`
			<div class="confirmation" id="${ action }-confirmation" role="group" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
				<h3 id="confirmation-title">${ statistics ? this.copy.statisticsConfirmationTitle : this.copy.allConfirmationTitle }</h3>
				<p id="confirmation-description">${ statistics ? this.copy.statisticsConfirmation : this.copy.allConfirmation }</p>
				${ this.failed ? html`<p class="error" role="alert">${ this.copy.resetError }</p>` : html`` }
				<div class="actions">
					<button id="cancel-reset" type="button" ?disabled=${ this.pending } @click=${ this.cancelReset }>${ this.copy.cancel }</button>
					<button id="confirm-reset" class="primary" type="button" ?disabled=${ this.pending || this.actions === null } @click=${ this.confirmReset }>
						${ this.pending ? this.copy.resetting : this.failed ? this.copy.retry : statistics ? this.copy.resetStatistics : this.copy.resetAll }
					</button>
				</div>
			</div>
		`;
	}

	/**
	 * Renders one full-width data control and its inline confirmation.
	 * @param action - Operation exposed by the control.
	 * @return Data control section.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderResetSection( action: PrivacyResetAction ): TemplateResult {
		const statistics = action === PrivacyResetAction.STATISTICS;
		return html`
			<section class="data-control" aria-labelledby="${ action }-title">
				<h2 id="${ action }-title">${ statistics ? this.copy.statisticsTitle : this.copy.allTitle }</h2>
				<p>${ statistics ? this.copy.statisticsDescription : this.copy.allDescription }</p>
				<button id="reset-${ action }" type="button" ?disabled=${ this.pending || this.actions === null } aria-expanded=${ this.confirmation === action ? 'true' : 'false' } aria-controls="${ action }-confirmation" @click=${ () => this.showConfirmation( action ) }>
					${ statistics ? this.copy.resetStatistics : this.copy.resetAll }
				</button>
				${ this.renderConfirmation( action ) }
			</section>
		`;
	}

	/**
	 * Renders privacy disclosures and separate confirmed data controls.
	 * @return Localized settings content.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		return html`
			<main aria-labelledby="privacy-title" aria-busy=${ this.pending ? 'true' : 'false' }>
				<header>
					<h1 id="privacy-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				<section aria-labelledby="stored-title">
					<h2 id="stored-title">${ this.copy.storedTitle }</h2>
					<p>${ this.copy.storedDescription }</p>
					<p>${ this.copy.statisticsPrivacy }</p>
					<p>${ this.copy.recoveryPrivacy }</p>
				</section>
				<details>
					<summary>${ this.copy.permissionsTitle }</summary>
					<ul>
						<li>${ this.copy.websitePermission }</li>
						<li>${ this.copy.toolbarPermission }</li>
						<li>${ this.copy.navigationPermission }</li>
						<li>${ this.copy.localToolsPermission }</li>
						${ this.supportsCachedFavicons ? html`<li id="favicon-permission">${ this.copy.faviconPermission }</li>` : html`` }
					</ul>
					<p>${ this.copy.deniedPermission }</p>
				</details>
				${ this.renderResetSection( PrivacyResetAction.STATISTICS ) }
				${ this.renderResetSection( PrivacyResetAction.ALL ) }
				${ this.actions === null ? html`<p role="alert">${ this.copy.unavailable }</p>` : html`` }
				<p class="status" role="status">${ this.completed === null ? '' : this.completed === PrivacyResetAction.STATISTICS ? this.copy.statisticsSuccess : this.copy.allSuccess }</p>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the Privacy settings tag to its component.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-privacy-screen': ComponentPrivacyScreen;
	}
}
