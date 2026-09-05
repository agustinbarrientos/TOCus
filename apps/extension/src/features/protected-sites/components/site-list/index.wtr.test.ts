import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	type ProtectedSiteConfiguration,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../services/site-favicon-provider';
import { ComponentProtectedSiteItem } from '../site-item';
import {
	ProtectedSiteAccessRestoredEventName,
	type ProtectedSiteAccessRestoredEventDetail,
} from '../site-item/types';
import { ComponentProtectedSiteList } from './index';

/**
 * Shared protected-site fixture rendered by list tests.
 * @since 0.1.0 Initial implementation.
 */
const SHARED_SITE: ProtectedSiteConfiguration = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};

/**
 * Independent protected-site fixture rendered by list tests.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SITE: ProtectedSiteConfiguration = {
	identityHost: 'x.com',
	rule: {
		host: 'x.com',
		includeSubdomains: true,
		scopeId: ProtectionScopeIdSchema.parse( 'scope_x' ),
	},
};

/**
 * Additional shared site used to verify localized ordering.
 * @since 0.1.0 Initial implementation.
 */
const ADDITIONAL_SHARED_SITE: ProtectedSiteConfiguration = {
	identityHost: 'instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};

/**
 * Deterministic local favicon source used by list tests.
 * @since 0.1.0 Initial implementation.
 */
const FAVICON_SOURCE = 'chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Fyoutube.com&size=32';

/**
 * Deterministic cached-favicon provider used by list tests.
 * @since 0.1.0 Initial implementation.
 */
const FAVICON_PROVIDER: SiteFaviconProvider = {
	/**
	 * Returns a favicon only for the shared fixture site.
	 * @param identityHost - Exact site identity requested by the list.
	 * @return Cached local source or null for the monogram fallback.
	 * @since 0.1.0 Initial implementation.
	 */
	getSource( identityHost: unknown ) {
		return identityHost === SHARED_SITE.identityHost ? FAVICON_SOURCE : null;
	},
};

/**
 * Sorts display names in deterministic descending order.
 * @param firstName - First display name.
 * @param secondName - Second display name.
 * @return Descending comparison result.
 * @since 0.1.0 Initial implementation.
 */
function compareNamesDescending( firstName: string, secondName: string ): number {
	return secondName.localeCompare( firstName, 'en' );
}

/**
 * Returns all rendered site items from one grouped list.
 * @param element - Rendered grouped protected-site list.
 * @return Protected-site item elements in visual order.
 * @since 0.1.0 Initial implementation.
 */
function getSiteItems(
	element: ComponentProtectedSiteList,
): ReadonlyArray<ComponentProtectedSiteItem> {
	return Array.from(
		element.shadowRoot?.querySelectorAll<ComponentProtectedSiteItem>(
			'tocus-f-protected-site-item',
		) ?? [],
	);
}

describe( 'tocus-f-protected-site-list', () => {
	it( 'renders an accessible empty state without site groups', async () => {
		const element = await fixture<ComponentProtectedSiteList>( html`
			<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }></tocus-f-protected-site-list>
		` );

		assert.include( element.shadowRoot?.textContent, 'No websites yet' );
		assert.include(
			element.shadowRoot?.textContent,
			'Add the first site you want TOCus to gently interrupt.',
		);
		assert.equal( element.shadowRoot?.querySelector( '.site-groups' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'groups, sorts, and fully presents shared and independent sites', async () => {
		const itemCopy = { ...TestEnglishLocalizationBundle.protectedSiteItem, edit: 'Localized edit' };
		const element = await fixture<ComponentProtectedSiteList>( html`
			<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
				.sites=${ [ SHARED_SITE, INDEPENDENT_SITE ] }
				.faviconProvider=${ FAVICON_PROVIDER }
				.accessByIdentityHost=${ new Map( [ [ SHARED_SITE.identityHost, true ] ] ) }
				.itemCopy=${ itemCopy }
			></tocus-f-protected-site-list>
		` );
		const items = getSiteItems( element );

		assert.include( element.shadowRoot?.textContent, 'Shared timing' );
		assert.include( element.shadowRoot?.textContent, 'Independent sites' );
		assert.deepEqual( items.map( ( item ) => item.identity?.name ), [ 'YouTube', 'X' ] );
		assert.equal( items.at( 0 )?.faviconSource, FAVICON_SOURCE );
		assert.isTrue( items.at( 0 )?.accessGranted );
		assert.equal( items.at( 1 )?.faviconSource, null );
		assert.isFalse( items.at( 1 )?.accessGranted );
		assert.isTrue( items.every( ( item ) => item.copy === itemCopy ) );
		await expect( element ).to.be.accessible();
	} );

	it( 'omits an empty independent group', async () => {
		const element = await fixture<ComponentProtectedSiteList>( html`
			<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.sites=${ [ SHARED_SITE ] }
			></tocus-f-protected-site-list>
		` );

		assert.instanceOf( element.shadowRoot?.querySelector( '.shared-sites' ), HTMLElement );
		assert.equal( element.shadowRoot.querySelector( '.independent-sites' ), null );
	} );

	it( 'uses the localized name comparator for visual ordering', async () => {
		const element = await fixture<ComponentProtectedSiteList>( html`
			<tocus-f-protected-site-list
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.sites=${ [ SHARED_SITE, ADDITIONAL_SHARED_SITE ] }
				.copy=${ { ...TestEnglishLocalizationBundle.protectedSiteList, compareNames: compareNamesDescending } }
			></tocus-f-protected-site-list>
		` );

		assert.deepEqual(
			getSiteItems( element ).map( ( item ) => item.identity?.name ),
			[ 'YouTube', 'Instagram' ],
		);
	} );

	it( 'focuses the matching site edit action after a grouped-list rerender', async () => {
		const element = await fixture<ComponentProtectedSiteList>( html`
			<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.sites=${ [ SHARED_SITE, INDEPENDENT_SITE ] }
			></tocus-f-protected-site-list>
		` );

		const focused = await element.focusEditAction( INDEPENDENT_SITE.identityHost );
		const independentItem = getSiteItems( element ).find(
			( item ) => item.site?.identityHost === INDEPENDENT_SITE.identityHost,
		);

		assert.isTrue( focused );
		assert.instanceOf( independentItem, ComponentProtectedSiteItem );
		assert.equal(
			independentItem.shadowRoot?.activeElement,
			independentItem.shadowRoot?.querySelector( '.edit-action' ),
		);
	} );

	it( 'reports when no rendered site can accept restored edit focus', async () => {
		const element = await fixture<ComponentProtectedSiteList>( html`
			<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.sites=${ [ SHARED_SITE ] }
			></tocus-f-protected-site-list>
		` );

		assert.isFalse( await element.focusEditAction( 'missing.example' ) );
	} );

	it( 'allows composed site-item events to reach the screen boundary', async () => {
		const frame = await fixture<HTMLDivElement>( html`
			<div>
				<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
					.sites=${ [ SHARED_SITE ] }
				></tocus-f-protected-site-list>
			</div>
		` );
		const list = frame.querySelector( 'tocus-f-protected-site-list' );
		const details: ProtectedSiteAccessRestoredEventDetail[] = [];

		assert.instanceOf( list, ComponentProtectedSiteList );
		if ( ! ( list instanceof ComponentProtectedSiteList ) ) {
			throw new TypeError( 'Expected the grouped-list fixture to render its component.' );
		}

		frame.addEventListener( ProtectedSiteAccessRestoredEventName, ( event ) => {
			details.push( ( event as CustomEvent<ProtectedSiteAccessRestoredEventDetail> ).detail );
		} );
		getSiteItems( list ).at( 0 )?.dispatchEvent( new CustomEvent(
			ProtectedSiteAccessRestoredEventName,
			{
				bubbles: true,
				composed: true,
				detail: { identityHost: SHARED_SITE.identityHost },
			},
		) );

		assert.deepEqual( details, [ { identityHost: SHARED_SITE.identityHost } ] );
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentProtectedSiteList>( html`<tocus-f-protected-site-list></tocus-f-protected-site-list>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
