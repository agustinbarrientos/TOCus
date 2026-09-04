import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { type ProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	createProtectedSiteEnrollmentService,
	type ProtectedSiteEnrollmentService,
} from '../../services/protected-site-enrollment';
import { type SiteFaviconProvider } from '../../services/site-favicon-provider';
import { type SitePermissionManager } from '../../services/site-permission-manager';
import { resolveSiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import { ComponentProtectedSiteItem } from '../site-item';
import styles from './web-component-style.scss?inline';
import {
	DefaultProtectedSiteListCopy,
	type PresentedProtectedSite,
	type ProtectedSiteListCopy,
} from './types';

/**
 * Renders protected sites grouped by shared or independent behavior.
 * @element tocus-f-protected-site-list
 * @summary Grouped protected-site settings list.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-protected-site-list' )
export class ComponentProtectedSiteList extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Current protected sites in authoritative configuration order.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor sites: ReadonlyArray<ProtectedSiteConfiguration> = [];

	/**
	 * Domain editor forwarded to each protected-site item.
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
	 * Current browser-access result for each exact site identity.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor accessByIdentityHost: ReadonlyMap<string, boolean> = new Map();

	/**
	 * Browser permission manager forwarded to each protected-site item.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor permissionManager: SitePermissionManager | null = null;

	/**
	 * Complete localizable messages rendered by the grouped list.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy: Readonly<ProtectedSiteListCopy> = DefaultProtectedSiteListCopy;

	/**
	 * Creates sorted local presentation for each configured site.
	 * @return Alphabetically sorted protected-site presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentSites(): ReadonlyArray<PresentedProtectedSite> {
		return this.sites
			.map( ( site ) => ( {
				site,
				identity: resolveSiteDisplayIdentity( site ),
				faviconSource: this.faviconProvider?.getSource( site.identityHost ) ?? null,
				accessGranted: this.accessByIdentityHost.get( site.identityHost ) ?? false,
			} ) )
			.sort( ( first, second ) => first.identity.name.localeCompare( second.identity.name ) );
	}

	/**
	 * Focuses the edit action for one currently rendered protected site.
	 * @param identityHost - Exact configured site identity to focus.
	 * @return Whether a matching rendered site accepted focus.
	 * @since 0.1.0 Initial implementation.
	 */
	public async focusEditAction( identityHost: string ): Promise<boolean> {
		await this.updateComplete;
		const item = Array.from(
			this.renderRoot.querySelectorAll<ComponentProtectedSiteItem>( 'tocus-f-protected-site-item' ),
		).find( ( candidate ) => candidate.site?.identityHost === identityHost );

		if ( ! ( item instanceof ComponentProtectedSiteItem ) ) {
			return false;
		}

		await item.focusEditAction();
		return true;
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
	 * Renders the empty state or grouped protected sites.
	 * @return Current grouped-list template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		const sites = this.presentSites();
		const enrollmentService = this.editor === null || this.permissionManager === null
			? null
			: createProtectedSiteEnrollmentService( {
				editor: this.editor,
				permissionManager: this.permissionManager,
			} );

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
}

declare global {
	/**
	 * Maps the grouped protected-site list tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-protected-site-list': ComponentProtectedSiteList;
	}
}
