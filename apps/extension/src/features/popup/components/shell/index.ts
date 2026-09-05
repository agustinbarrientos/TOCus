import iconMarkup from '@tocus/theme/icon.svg?raw';
import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type PropertyValues,
	type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconSource } from '../../../protected-sites/services/site-favicon-provider';
import {
	resolveSiteDisplayIdentity,
	type SiteDisplayIdentity,
} from '../../../protected-sites/utils/site-display-name-resolver';
import {
	PopupCurrentSiteAccess,
	PopupCurrentSiteStatus,
	PopupProjectionStatus,
	PopupScheduleStatus,
	PopupScopeKind,
	PopupTimerPhase,
	type PopupActiveScope,
	type PopupAvailableProjection,
	type PopupProtectedCurrentSite,
	type PopupProjection,
} from '../../types/popup-projection';
import styles from './web-component-style.scss?inline';
import {
	PopupAddSiteRequestEventName,
	PopupOperationError,
	type PopupOperationError as PopupOperationErrorValue,
	PopupRetryRequestEventName,
	type PopupShellCopy,
} from './types';

/**
 * Displays current website status, active timing, and focused popup actions.
 * @element tocus-f-popup-shell
 * @summary Extension popup status shell.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-popup-shell' )
export class ComponentPopupShell extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Complete localized popup messages and formatters.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy: Readonly<PopupShellCopy> | null = null;

	/**
	 * Authoritative semantic popup projection.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor projection: PopupProjection | null = null;

	/**
	 * Current wall-clock instant used only for visible allowance countdowns.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor nowEpochMilliseconds = 0;

	/**
	 * Browser-cached extension-local favicon source for the current website.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor faviconSource: SiteFaviconSource = null;

	/**
	 * Exact packaged Settings route used by current-website management.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor settingsPageUrl = '';

	/**
	 * Exact packaged Statistics route used by footer navigation.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor statisticsPageUrl = '';

	/**
	 * Whether one current-website enrollment is pending.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor adding = false;

	/**
	 * Whether one popup recovery request is pending.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor retrying = false;

	/**
	 * Current recoverable enrollment failure.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor operationError: PopupOperationErrorValue | null = null;

	/**
	 * Whether the current cached favicon failed to render.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor faviconUnavailable = false;

	/**
	 * Restores favicon eligibility after its source or website changes.
	 * @param changedProperties - Reactive properties changed before this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override willUpdate( changedProperties: PropertyValues<this> ): void {
		if ( changedProperties.has( 'faviconSource' ) || changedProperties.has( 'projection' ) ) {
			this.faviconUnavailable = false;
		}
	}

	/**
	 * Resolves the concise status shown for one current website.
	 * @param currentSite - Configured current website state.
	 * @param activeScopes - Every active timing scope.
	 * @param copy - Complete localized popup copy.
	 * @return Localized current website status.
	 * @since 0.1.0 Initial implementation.
	 */
	private getProtectedSiteStatus(
		currentSite: PopupProtectedCurrentSite,
		activeScopes: ReadonlyArray<PopupActiveScope>,
		copy: Readonly<PopupShellCopy>,
	): string {
		if ( currentSite.access === PopupCurrentSiteAccess.MISSING ) {
			return copy.browserAccessNeeded;
		}
		const activeScope = activeScopes.find( ( scope ) => scope.scopeId === currentSite.scopeId );

		if ( activeScope?.phase === PopupTimerPhase.WAITING ) {
			return copy.pauseInProgress;
		}

		if ( activeScope?.phase === PopupTimerPhase.ALLOWANCE ) {
			return copy.visitWindowOpen;
		}

		if ( currentSite.schedule === PopupScheduleStatus.INACTIVE ) {
			return copy.offRightNow;
		}

		if ( currentSite.schedule === PopupScheduleStatus.UNAVAILABLE ) {
			return copy.statusUnavailable;
		}

		return copy.tocusActive;
	}

	/**
	 * Creates local presentation input for an unconfigured current website.
	 * @param identityHost - Exact normalized current website host.
	 * @return Exact-host presentation input without changing enrollment behavior.
	 * @since 0.1.0 Initial implementation.
	 */
	private createUnprotectedSitePresentation( identityHost: string ): ProtectedSiteConfiguration {
		return {
			identityHost,
			rule: {
				host: identityHost,
				includeSubdomains: false,
				scopeId: DefaultProtectionScopeId,
			},
		};
	}

	/**
	 * Uses the deterministic monogram after a cached favicon cannot render.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleFaviconError = (): void => {
		this.faviconUnavailable = true;
	};

	/**
	 * Emits an enrollment request synchronously from the user's click.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly requestAddSite = (): void => {
		if ( this.adding ) {
			return;
		}

		this.dispatchEvent( new Event( PopupAddSiteRequestEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};

	/**
	 * Emits a request for a fresh authoritative projection.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly requestRetry = (): void => {
		this.dispatchEvent( new Event( PopupRetryRequestEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};

	/**
	 * Focuses the website management action after successful enrollment.
	 * @return Promise resolved after focus is applied when the action exists.
	 * @since 0.1.0 Initial implementation.
	 */
	public async focusManageAction(): Promise<void> {
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLAnchorElement>( '.manage-action' )?.focus();
	}

	/**
	 * Focuses the most useful current action or status after retry recovery settles.
	 * @return Promise resolved after focus is applied when a target exists.
	 * @since 0.1.0 Initial implementation.
	 */
	public async focusAfterRetry(): Promise<void> {
		await this.updateComplete;
		const action = this.shadowRoot?.querySelector<HTMLElement>(
			'.manage-action, .primary-action, .retry-action',
		);
		const target = action ?? this.shadowRoot?.querySelector<HTMLElement>( '.neutral-message' );

		target?.focus();
	}

	/**
	 * Renders the local favicon or deterministic monogram for one website.
	 * @param identity - Local current website identity.
	 * @return Website avatar template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderIdentityMark( identity: SiteDisplayIdentity ): TemplateResult {
		return html`
			<span class="site-mark" aria-hidden="true">
				${ this.faviconSource !== null && ! this.faviconUnavailable
					? html`<img class="site-favicon" src=${ this.faviconSource } alt="" @error=${ this.handleFaviconError } />`
					: html`<span class="site-monogram">${ identity.monogram }</span>` }
			</span>
		`;
	}

	/**
	 * Renders the current website card for an available projection.
	 * @param projection - Available semantic popup projection.
	 * @param copy - Complete localized popup copy.
	 * @return Current website card template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderCurrentWebsite(
		projection: PopupAvailableProjection,
		copy: Readonly<PopupShellCopy>,
	): TemplateResult {
		const currentSite = projection.currentSite;

		if (
			currentSite.status !== PopupCurrentSiteStatus.PROTECTED &&
			currentSite.status !== PopupCurrentSiteStatus.UNPROTECTED
		) {
			const message = currentSite.status === PopupCurrentSiteStatus.UNSUPPORTED
				? copy.unsupportedPage
				: copy.currentWebsiteUnavailable;

			return html`
				<section class="website-card website-card--neutral" aria-labelledby="current-website-label">
					<p class="eyebrow" id="current-website-label">${ copy.currentWebsite }</p>
					<p class="neutral-message" tabindex="-1">${ message }</p>
					${ currentSite.status === PopupCurrentSiteStatus.UNAVAILABLE
						? html`<button
								class="retry-action text-action"
								type="button"
								?disabled=${ this.retrying }
								@click=${ this.requestRetry }
							>
								${ this.retrying ? copy.retrying : copy.retry }
							</button>`
						: null }
				</section>
			`;
		}
		const site = currentSite.status === PopupCurrentSiteStatus.PROTECTED
			? currentSite.site
			: this.createUnprotectedSitePresentation( currentSite.identityHost );
		const identity = resolveSiteDisplayIdentity( site );
		const status = currentSite.status === PopupCurrentSiteStatus.PROTECTED
			? this.getProtectedSiteStatus( currentSite, projection.activeScopes, copy )
			: copy.noPauseHere;

		return html`
			<section
				class="website-card"
				aria-busy=${ this.adding ? 'true' : 'false' }
				aria-labelledby="current-website-label site-name"
			>
				<p class="eyebrow" id="current-website-label">${ copy.currentWebsite }</p>
				<div class="site-overview">
					${ this.renderIdentityMark( identity ) }
					<div class="site-identity">
						<h1 class="site-name" id="site-name">${ identity.name }</h1>
						<p class="site-host">${ site.identityHost }</p>
					</div>
					<span class="site-status" role="status">${ status }</span>
				</div>
				${ currentSite.status === PopupCurrentSiteStatus.UNPROTECTED
					? html`<button
						class="primary-action"
						type="button"
						?disabled=${ this.adding }
						@click=${ this.requestAddSite }
					>${ this.adding ? copy.addingPause : copy.addPauseHere }</button>`
					: html`<a class="manage-action secondary-action" href=${ this.settingsPageUrl } target="_blank">
						${ copy.manageWebsite }
					</a>` }
				${ this.renderOperationError( copy ) }
			</section>
			<span class="action-announcement" role="status">${ this.adding ? copy.addingPause : '' }</span>
		`;
	}

	/**
	 * Resolves the current enrollment failure into localized copy.
	 * @param copy - Complete localized popup copy.
	 * @return Inline alert template or an empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderOperationError( copy: Readonly<PopupShellCopy> ): TemplateResult {
		if ( this.operationError === null ) {
			return html``;
		}

		const message = this.operationError === PopupOperationError.PERMISSION_DENIED
			? copy.permissionDeniedError
			: this.operationError === PopupOperationError.PERMISSION_ERROR
				? copy.permissionError
				: this.operationError === PopupOperationError.PERMISSION_RETAINED
					? copy.permissionRetainedError
					: copy.saveError;

		return html`<p class="operation-error" role="alert">${ message }</p>`;
	}

	/**
	 * Returns the visible timer duration for one active scope.
	 * @param scope - Active Waiting or Allowance scope.
	 * @return Nonnegative duration displayed by the popup.
	 * @since 0.1.0 Initial implementation.
	 */
	private getScopeRemainingMilliseconds( scope: PopupActiveScope ): number {
		return scope.phase === PopupTimerPhase.WAITING
			? scope.remainingMilliseconds
			: Math.max( 0, scope.expiresAtEpochMilliseconds - this.nowEpochMilliseconds );
	}

	/**
	 * Renders idle next-pause information and every active timing scope.
	 * @param projection - Available semantic popup projection.
	 * @param copy - Complete localized popup copy.
	 * @return Timing section template or an empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderTiming(
		projection: PopupAvailableProjection,
		copy: Readonly<PopupShellCopy>,
	): TemplateResult {
		const nextWait = projection.currentSite.status === PopupCurrentSiteStatus.PROTECTED
			? projection.currentSite.nextWaitMilliseconds
			: null;

		if ( nextWait === null && projection.activeScopes.length === 0 ) {
			return html``;
		}

		return html`
			${ nextWait === null
				? null
				: html`
					<section class="next-pause" aria-label=${ copy.nextPause }>
						<span>${ copy.nextPause }</span>
						<strong class="next-pause-value">${ copy.formatNextPause( nextWait ) }</strong>
					</section>
				` }
			${ projection.activeScopes.length === 0
				? null
				: html`
					<section class="timing">
						<h2 id="active-timing-title">${ copy.activeTiming }</h2>
						<div
							class="timing-list"
							role="region"
							aria-labelledby="active-timing-title"
							tabindex="0"
						>
							${ projection.activeScopes.map( ( scope ) => this.renderActiveScope( scope, copy ) ) }
						</div>
					</section>
				` }
		`;
	}

	/**
	 * Renders one active timing scope without collapsing concurrent scopes.
	 * @param scope - Active Waiting or Allowance scope.
	 * @param copy - Complete localized popup copy.
	 * @return One active timing row.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderActiveScope(
		scope: PopupActiveScope,
		copy: Readonly<PopupShellCopy>,
	): TemplateResult {
		let title: string;
		let supporting: string;

		if ( scope.kind === PopupScopeKind.SHARED ) {
			title = copy.sharedTiming;
			supporting = copy.formatWebsiteCount( scope.siteCount );
		} else {
			title = resolveSiteDisplayIdentity( scope.site ).name;
			supporting = scope.site.identityHost;
		}
		const phase = scope.phase === PopupTimerPhase.WAITING
			? copy.pause
			: copy.visitWindow;

		return html`
			<article class="timing-row">
				<div class="timing-identity">
					<strong>${ title }</strong>
					<span>${ supporting }</span>
				</div>
				<div class="timing-value">
					<span>${ phase }</span>
					<strong>${ copy.formatCountdown( this.getScopeRemainingMilliseconds( scope ) ) }</strong>
				</div>
				${ scope.isCurrentScope ? html`<span class="current-scope">${ copy.currentScope }</span>` : null }
			</article>
		`;
	}

	/**
	 * Renders a branded recovery state when background status is unavailable.
	 * @param copy - Complete localized popup copy.
	 * @return Popup recovery template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderUnavailable( copy: Readonly<PopupShellCopy> ): TemplateResult {
		return html`
			<section class="unavailable" aria-labelledby="unavailable-title">
				<span class="unavailable-mark" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
				<h1 id="unavailable-title">${ copy.unavailableTitle }</h1>
				<p>${ copy.unavailableDescription }</p>
				<button
					class="retry-action primary-action"
					type="button"
					?disabled=${ this.retrying }
					@click=${ this.requestRetry }
				>
					${ this.retrying ? copy.retrying : copy.retry }
				</button>
			</section>
		`;
	}

	/**
	 * Renders footer navigation to complete Settings and Statistics surfaces.
	 * @param copy - Complete localized popup copy.
	 * @return Popup footer template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderFooter( copy: Readonly<PopupShellCopy> ): TemplateResult {
		return html`
			<footer>
				<a class="statistics-link" href=${ this.statisticsPageUrl } target="_blank">${ copy.statistics }</a>
				<a class="settings-link" href=${ this.settingsPageUrl } target="_blank">${ copy.settings }</a>
			</footer>
		`;
	}

	/**
	 * Renders the complete popup status surface.
	 * @return Popup shell template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( this.copy === null || this.projection === null ) {
			return html``;
		}
		const copy = this.copy;

		return html`
			<main aria-label="TOCus">
				<header class="brandbar">
					<span class="brand-icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
					<span class="wordmark">TOCus</span>
				</header>
				<div class="content">
					${ this.projection.status === PopupProjectionStatus.UNAVAILABLE
						? this.renderUnavailable( copy )
						: html`
							${ this.renderCurrentWebsite( this.projection, copy ) }
							${ this.renderTiming( this.projection, copy ) }
						` }
				</div>
				<span class="retry-announcement" role="status">${ this.retrying ? copy.retrying : '' }</span>
				${ this.renderFooter( copy ) }
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the popup-shell tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-popup-shell': ComponentPopupShell;
	}
}
