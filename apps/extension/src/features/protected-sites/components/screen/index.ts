import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import {
	ProtectionConfigurationEditRejectionReason,
	type ProtectionConfigurationEditor,
} from '../../../../domains/protection/services/protection-configuration-editor';
import {
	ProtectedSiteConfigurationSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../services/site-favicon-provider';
import {
	SitePermissionReleaseStatus,
	type SitePermissionManager,
} from '../../services/site-permission-manager';
import {
	ProtectedSiteEnrollmentStatus,
	createProtectedSiteEnrollmentService,
	type ProtectedSiteEnrollmentService,
	type UnsuccessfulProtectedSiteEnrollmentResult,
} from '../../services/protected-site-enrollment';
import { resolveSiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import { ComponentProtectedSiteItem } from '../site-item';
import {
	ProtectedSiteConfigurationChangeKind,
	type ProtectedSiteAccessRestoredEventDetail,
	type ProtectedSiteConfigurationChangedEventDetail,
} from '../site-item/types';
import styles from './web-component-style.scss?inline';
import {
	DefaultProtectedSitesScreenCopy,
	ProtectedSitesScreenLoadStatus,
	type PresentedProtectedSite,
	type ProtectedSitesAddSubmitEvent,
	type ProtectedSitesScreenCopy,
} from './types';

/**
 * Renders protected-site loading, manual entry, grouping, and local recovery states.
 * @element tocus-f-protected-sites-screen
 * @summary Protected Sites settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-protected-sites-screen' )
export class ComponentProtectedSitesScreen extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Domain editor responsible for validated local configuration persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: ProtectionConfigurationEditor | null = null;

	/**
	 * Browser-capability-aware local favicon provider.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor faviconProvider: SiteFaviconProvider | null = null;

	/**
	 * Browser permission manager used before persisting protection rules.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor permissionManager: SitePermissionManager | null = null;

	/**
	 * Complete localizable messages rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy: Readonly<ProtectedSitesScreenCopy> = DefaultProtectedSitesScreenCopy;

	@state()
	private accessor configuration: ProtectionConfigurationDocument | null = null;

	@state()
	private accessor loadStatus: ProtectedSitesScreenLoadStatus = ProtectedSitesScreenLoadStatus.LOADING;

	@state()
	private accessor siteInputError = '';

	@state()
	private accessor announcement = '';

	@state()
	private accessor announcementSequence = 0;

	@state()
	private accessor saving = false;

	@state()
	private accessor accessByIdentityHost: ReadonlyMap<string, boolean> = new Map();

	private accessRefreshGeneration = 0;

	/**
	 * Loads local protected-site configuration after all template properties are assigned.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override firstUpdated(): void {
		void this.loadConfiguration();
	}

	/**
	 * Loads validated local configuration without replacing malformed data.
	 * @return Promise resolved after the screen state is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	private async loadConfiguration(): Promise<void> {
		this.loadStatus = ProtectedSitesScreenLoadStatus.LOADING;
		this.siteInputError = '';

		if ( this.editor === null ) {
			this.configuration = null;
			this.loadStatus = ProtectedSitesScreenLoadStatus.FAILED;
			return;
		}

		try {
			const configuration = await this.editor.load();

			if ( configuration === null ) {
				this.configuration = null;
				this.loadStatus = ProtectedSitesScreenLoadStatus.MALFORMED;
				return;
			}

			this.configuration = configuration;
			await this.refreshAccessState();
			this.loadStatus = ProtectedSitesScreenLoadStatus.READY;
		} catch {
			this.configuration = null;
			this.loadStatus = ProtectedSitesScreenLoadStatus.FAILED;
		}
	}

	/**
	 * Loads complete browser-access state for every configured site.
	 * @param configuration - Validated local protection configuration.
	 * @return Access state indexed by stable site identity.
	 * @since 0.1.0 Initial implementation.
	 */
	private async loadSiteAccess(
		configuration: ProtectionConfigurationDocument,
	): Promise<ReadonlyMap<string, boolean>> {
		if ( this.permissionManager === null ) {
			return new Map( configuration.sites.map( ( site ) => [ site.identityHost, false ] ) );
		}

		const accessibleConfiguration = await this.permissionManager.filterConfiguration( configuration );
		const accessibleIdentities = new Set(
			accessibleConfiguration.sites.map( ( site ) => site.identityHost ),
		);
		const accessEntries = configuration.sites.map( ( site ) => [
			site.identityHost,
			accessibleIdentities.has( site.identityHost ),
		] as const );

		return new Map( accessEntries );
	}

	/**
	 * Refreshes rendered browser-access state without reloading local configuration.
	 * @return Committed access snapshot, or null when a newer state supersedes the request.
	 * @since 0.1.0 Initial implementation.
	 */
	public async refreshAccessState(): Promise<ReadonlyMap<string, boolean> | null> {
		const generation = this.accessRefreshGeneration + 1;
		const configuration = this.configuration;

		this.accessRefreshGeneration = generation;
		if ( configuration === null ) {
			return null;
		}

		const accessByIdentityHost = await this.loadSiteAccess( configuration );

		if (
			generation !== this.accessRefreshGeneration ||
			configuration !== this.configuration
		) {
			return null;
		}

		this.accessByIdentityHost = accessByIdentityHost;

		return accessByIdentityHost;
	}

	/**
	 * Retries the current local configuration read.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = async (): Promise<void> => {
		await this.loadConfiguration();
		await this.updateComplete;

		const focusTarget = this.loadStatus === ProtectedSitesScreenLoadStatus.READY
			? '#site-address'
			: '.retry-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Replaces the live-region content so repeated messages are announced again.
	 * @param message - Localized status message to announce.
	 * @since 0.1.0 Initial implementation.
	 */
	private announce( message: string ): void {
		this.announcement = message;
		this.announcementSequence += 1;
	}

	/**
	 * Creates enrollment coordination from available screen dependencies.
	 * @param editor - Domain editor used for protected-site persistence.
	 * @param permissionManager - Browser permission manager used for site access.
	 * @return Protected-site enrollment service.
	 * @since 0.1.0 Initial implementation.
	 */
	private createEnrollmentService(
		editor: ProtectionConfigurationEditor,
		permissionManager: SitePermissionManager,
	): ProtectedSiteEnrollmentService {
		return createProtectedSiteEnrollmentService( { editor, permissionManager } );
	}

	/**
	 * Resolves one presentation-neutral enrollment failure to localized copy.
	 * @param result - Enrollment failure returned by the feature service.
	 * @return Localized error message for manual entry.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentEnrollmentFailure( result: UnsuccessfulProtectedSiteEnrollmentResult ): string {
		if ( result.status === ProtectedSiteEnrollmentStatus.REJECTED ) {
			const messages = {
				[ ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED ]:
					this.copy.alreadyProtectedError,
				[ ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ]:
					this.copy.invalidConfigurationError,
				[ ProtectionConfigurationEditRejectionReason.INVALID_DISPLAY_NAME ]:
					this.copy.invalidDisplayNameError,
				[ ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE ]:
					this.copy.invalidConfigurationError,
				[ ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID ]: this.copy.invalidScopeError,
				[ ProtectionConfigurationEditRejectionReason.INVALID_SITE ]: this.copy.invalidSiteError,
				[ ProtectionConfigurationEditRejectionReason.INVALID_TIMING_CONFIGURATION ]:
					this.copy.invalidConfigurationError,
				[ ProtectionConfigurationEditRejectionReason.SCOPE_NOT_FOUND ]:
					this.copy.invalidConfigurationError,
				[ ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND ]: this.copy.siteNotFoundError,
			};

			return messages[ result.reason ];
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
	 * Adds one manually entered website with the selected scope behavior.
	 * @param event - Manual add-site form submission.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAddSite = async ( event: ProtectedSitesAddSubmitEvent ): Promise<void> => {
		event.preventDefault();

		if (
			this.saving ||
			this.editor === null ||
			this.permissionManager === null ||
			this.configuration === null
		) {
			return;
		}

		const enrollmentService = this.createEnrollmentService( this.editor, this.permissionManager );
		const form = event.currentTarget;
		const formData = new FormData( form );
		const siteInput = formData.get( 'site-address' );
		const independent = formData.get( 'behavior' ) === 'independent';
		this.saving = true;
		this.siteInputError = '';

		try {
			const result = await enrollmentService.add( siteInput, independent );

			if ( result.status !== ProtectedSiteEnrollmentStatus.ADDED ) {
				this.siteInputError = this.presentEnrollmentFailure( result );
				return;
			}

			const identity = resolveSiteDisplayIdentity( result.site );
			this.configuration = result.configuration;
			this.accessByIdentityHost = new Map( this.accessByIdentityHost ).set(
				result.site.identityHost,
				true,
			);
			this.announce( this.copy.formatAddedAnnouncement( identity.name ) );
			form.reset();
		} finally {
			this.saving = false;
		}
	};

	/**
	 * Records restored browser access and announces the successful recovery.
	 * @param event - Composed access-restoration event from one site item.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAccessRestored = async (
		event: CustomEvent<ProtectedSiteAccessRestoredEventDetail>,
	): Promise<void> => {
		event.stopPropagation();
		const site = this.configuration?.sites.find(
			( candidate ) => candidate.identityHost === event.detail.identityHost,
		);

		if ( site === undefined ) {
			return;
		}

		const accessByIdentityHost = await this.refreshAccessState();

		if ( accessByIdentityHost?.get( site.identityHost ) !== true ) {
			return;
		}

		this.announce( this.copy.formatAccessRestoredAnnouncement( resolveSiteDisplayIdentity( site ).name ) );
	};

	/**
	 * Applies one persisted item update or removal to the rendered configuration.
	 * @param event - Composed protected-site configuration change event.
	 * @return Promise resolved after focus is restored.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleConfigurationChanged = async (
		event: CustomEvent<ProtectedSiteConfigurationChangedEventDetail>,
	): Promise<void> => {
		event.stopPropagation();
		const { detail } = event;
		const identitySource = detail.kind === ProtectedSiteConfigurationChangeKind.REMOVED
			? this.configuration
			: detail.configuration;
		const changedSite = ProtectedSiteConfigurationSchema.parse(
			identitySource?.sites.find( ( site ) => site.identityHost === detail.identityHost ),
		);
		const identity = resolveSiteDisplayIdentity( changedSite );
		const permissionReleaseStatus = detail.kind === ProtectedSiteConfigurationChangeKind.REMOVED
			? detail.permissionReleaseStatus
			: SitePermissionReleaseStatus.RELEASED;
		this.configuration = detail.configuration;
		if ( detail.kind === ProtectedSiteConfigurationChangeKind.REMOVED ) {
			const accessByIdentityHost = new Map( this.accessByIdentityHost );
			accessByIdentityHost.delete( detail.identityHost );
			this.accessByIdentityHost = accessByIdentityHost;
		}
		this.announce( detail.kind === ProtectedSiteConfigurationChangeKind.REMOVED
			? permissionReleaseStatus === SitePermissionReleaseStatus.RELEASED
				? this.copy.formatRemovedAnnouncement( identity.name )
				: this.copy.formatPermissionRetainedAnnouncement( identity.name )
			: this.copy.formatUpdatedAnnouncement( identity.name ) );

		await this.updateComplete;

		if ( detail.kind === ProtectedSiteConfigurationChangeKind.REMOVED ) {
			this.shadowRoot?.querySelector<HTMLInputElement>( '#site-address' )?.focus();
			return;
		}

		const changedItem = Array.from(
			this.renderRoot.querySelectorAll<ComponentProtectedSiteItem>( 'tocus-f-protected-site-item' ),
		).find( ( item ) => item.site?.identityHost === detail.identityHost );

		if ( ! ( changedItem instanceof ComponentProtectedSiteItem ) ) {
			this.shadowRoot?.querySelector<HTMLInputElement>( '#site-address' )?.focus();
			return;
		}

		await changedItem.focusEditAction();
	};

	/**
	 * Creates sorted local presentation for each currently configured site.
	 * @return Alphabetically sorted protected-site presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentSites(): ReadonlyArray<PresentedProtectedSite> {
		return ( this.configuration?.sites ?? [] )
			.map( ( site ) => ( {
				site,
				identity: resolveSiteDisplayIdentity( site ),
				faviconSource: this.faviconProvider?.getSource( site.identityHost ) ?? null,
				accessGranted: this.accessByIdentityHost.get( site.identityHost ) ?? false,
			} ) )
			.sort( ( first, second ) => first.identity.name.localeCompare( second.identity.name ) );
	}

	/**
	 * Renders one nonempty shared or independent site group.
	 * @param className - Stable group class name.
	 * @param title - Localized group heading.
	 * @param description - Localized group explanation.
	 * @param sites - Presented sites belonging to the group.
	 * @param enrollmentService - Coordinated site enrollment and removal operations.
	 * @return Site-group template or an empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderSiteGroup(
		className: string,
		title: string,
		description: string,
		sites: ReadonlyArray<PresentedProtectedSite>,
		enrollmentService: ProtectedSiteEnrollmentService | null,
	): TemplateResult {
		if ( sites.length === 0 ) {
			return html``;
		}

		return html`
			<section class="site-group ${ className }" aria-labelledby="${ className }-title">
				<div class="group-heading">
					<h2 id="${ className }-title">${ title }</h2>
					<p>${ description }</p>
				</div>
				<ul>
					${ repeat( sites, ( presentedSite ) => presentedSite.site.identityHost, ( presentedSite ) => html`
						<li>
							<tocus-f-protected-site-item
								.site=${ presentedSite.site }
								.identity=${ presentedSite.identity }
								.editor=${ this.editor }
								.enrollmentService=${ enrollmentService }
								.faviconSource=${ presentedSite.faviconSource }
								.accessGranted=${ presentedSite.accessGranted }
								.permissionManager=${ this.permissionManager }
							></tocus-f-protected-site-item>
						</li>
					` ) }
				</ul>
			</section>
		`;
	}

	/**
	 * Renders loading, recovery, empty, or populated site content.
	 * @param sites - Current sorted protected-site presentation.
	 * @param enrollmentService - Coordinated site enrollment and removal operations.
	 * @return Current screen-state template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderContent(
		sites: ReadonlyArray<PresentedProtectedSite>,
		enrollmentService: ProtectedSiteEnrollmentService | null,
	): TemplateResult {
		if ( this.loadStatus === ProtectedSitesScreenLoadStatus.LOADING ) {
			return html`<p class="loading-status" role="status">${ this.copy.loading }</p>`;
		}

		if (
			this.loadStatus === ProtectedSitesScreenLoadStatus.MALFORMED ||
			this.loadStatus === ProtectedSitesScreenLoadStatus.FAILED
		) {
			const malformed = this.loadStatus === ProtectedSitesScreenLoadStatus.MALFORMED;

			return html`
				<div class="load-error" role="alert">
					<div>
						<h2>${ malformed ? this.copy.malformedDataTitle : this.copy.loadErrorTitle }</h2>
						<p>${ malformed ? this.copy.malformedDataDescription : this.copy.loadErrorDescription }</p>
					</div>
					<button class="retry-action secondary-action" type="button" @click=${ this.handleRetry }>
						${ this.copy.retry }
					</button>
				</div>
			`;
		}

		if ( sites.length === 0 ) {
			return html`
				<div class="empty-state">
					<h2>${ this.copy.emptyTitle }</h2>
					<p>${ this.copy.emptyDescription }</p>
				</div>
			`;
		}

		const sharedSites = sites.filter( ( presentedSite ) =>
			presentedSite.site.rule.scopeId === DefaultProtectionScopeId,
		);
		const independentSites = sites.filter( ( presentedSite ) =>
			presentedSite.site.rule.scopeId !== DefaultProtectionScopeId,
		);

		return html`
			<div class="site-groups">
				${ this.renderSiteGroup(
					'shared-sites',
					this.copy.sharedGroupTitle,
					this.copy.sharedGroupDescription,
					sharedSites,
					enrollmentService,
				) }
				${ this.renderSiteGroup(
					'independent-sites',
					this.copy.independentGroupTitle,
					this.copy.independentGroupDescription,
					independentSites,
					enrollmentService,
				) }
			</div>
		`;
	}

	/**
	 * Renders the current protected-site management state.
	 * @return Protected Sites settings template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		const loading = this.loadStatus === ProtectedSitesScreenLoadStatus.LOADING;
		const formDisabled =
			this.loadStatus !== ProtectedSitesScreenLoadStatus.READY ||
			this.saving ||
			this.permissionManager === null;
		const sites = this.presentSites();
		const enrollmentService = this.editor === null || this.permissionManager === null
			? null
			: this.createEnrollmentService( this.editor, this.permissionManager );

		return html`
			<main
				aria-labelledby="protected-sites-title"
				aria-busy=${ loading ? 'true' : 'false' }
				@tocus-protected-site-access-restored=${ this.handleAccessRestored }
				@tocus-protected-site-configuration-changed=${ this.handleConfigurationChanged }
			>
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="protected-sites-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				<form class="add-site-form" @submit=${ this.handleAddSite }>
					<label for="site-address">${ this.copy.addressLabel }</label>
					<div class="add-site-control">
						<input
							id="site-address"
							name="site-address"
							type="text"
							placeholder=${ this.copy.addressPlaceholder }
							autocomplete="url"
							aria-describedby="site-address-help site-address-error"
							aria-invalid=${ this.siteInputError === '' ? 'false' : 'true' }
							?disabled=${ formDisabled }
						>
						<button class="primary-action" type="submit" ?disabled=${ formDisabled }>
							${ this.saving ? this.copy.addingSite : this.copy.addSite }
						</button>
					</div>
					<p id="site-address-help" class="field-help">${ this.copy.addressHelp }</p>
					<p id="site-address-error" class="site-input-error" role="alert">
						${ this.siteInputError }
					</p>
					<fieldset ?disabled=${ formDisabled }>
						<legend>${ this.copy.behaviorLegend }</legend>
						<div class="behavior-options">
							<label class="behavior-option">
								<input type="radio" name="behavior" value="shared" checked>
								<span class="behavior-selection" aria-hidden="true"></span>
								<span>
									<strong>${ this.copy.sharedBehavior }</strong>
									<small>${ this.copy.sharedBehaviorDescription }</small>
								</span>
							</label>
							<label class="behavior-option">
								<input type="radio" name="behavior" value="independent">
								<span class="behavior-selection" aria-hidden="true"></span>
								<span>
									<strong>${ this.copy.independentBehavior }</strong>
									<small>${ this.copy.independentBehaviorDescription }</small>
								</span>
							</label>
						</div>
					</fieldset>
				</form>
				${ this.renderContent( sites, enrollmentService ) }
				<p class="announcement" role="status" aria-live="polite">
					${ keyed(
						this.announcementSequence,
						html`<span>${ this.announcement }</span>`,
					) }
				</p>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the Protected Sites screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-protected-sites-screen': ComponentProtectedSitesScreen;
	}
}
