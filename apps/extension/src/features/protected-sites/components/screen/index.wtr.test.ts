import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../../../domains/protection/types/protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../services/site-favicon-provider';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../services/site-permission-manager';
import { ComponentProtectedSiteItem } from '../site-item';
import {
	ProtectedSiteAccessRestoredEventName,
	ProtectedSiteConfigurationChangedEventName,
	ProtectedSiteConfigurationChangeKind,
} from '../site-item/types';
import { ComponentProtectedSiteList } from '../site-list';
import { ComponentProtectedSitesScreen } from './index';
import {
	EMPTY_CONFIGURATION,
	POPULATED_CONFIGURATION,
	X_SITE,
	YOUTUBE_SITE,
	createPermissionManager,
	createMemoryProtectedSitesScreenStorage,
	createProtectedSitesScreenFixture,
	getRequiredElement,
	getSiteListRoot,
	settleScreen,
} from './__fixtures__';

/**
 * Additional shared site rendered by sorting and access-management scenarios.
 * @since 0.1.0 Initial implementation.
 */
const INSTAGRAM_SITE: ProtectedSiteConfiguration = {
	identityHost: 'instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};

/**
 * Returns one deterministic cached-favicon fixture source.
 * @param identityHost - Exact local site identity.
 * @return Cached-favicon source for YouTube or the monogram fallback marker.
 * @since 0.1.0 Initial implementation.
 */
function getFaviconSource( identityHost: unknown ): ReturnType<SiteFaviconProvider[ 'getSource' ]> {
	return identityHost === 'youtube.com'
		? 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fyoutube.com%2F&size=32'
		: null;
}

/**
 * Deterministic local favicon provider used by the core screen suite.
 * @since 0.1.0 Initial implementation.
 */
const FAVICON_PROVIDER: SiteFaviconProvider = { getSource: getFaviconSource };

/**
 * Formats one localized protected-site addition status for live-copy tests.
 * @param name - Resolved site name.
 * @return Localized addition status.
 * @since 0.1.0 Initial implementation.
 */
function formatLocalizedAddedAnnouncement( name: string ): string {
	return `Localized addition: ${ name }.`;
}

/**
 * In-memory storage that keeps one screen write pending until the test releases it.
 * @since 0.1.0 Initial implementation.
 */
class DeferredProtectedSitesScreenStorage implements ProtectionConfigurationStorageService {
	/**
	 * Number of pending writes started by this fixture.
	 * @since 0.1.0 Initial implementation.
	 */
	writes = 0;

	/**
	 * Latest configuration supplied to this fixture.
	 * @since 0.1.0 Initial implementation.
	 */
	configuration: ProtectionConfigurationDocument | null;

	private resolvePendingSave: ( () => void ) | null = null;

	/**
	 * Creates deferred storage with one initial configuration.
	 * @param configuration - Configuration returned by the next load.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( configuration: ProtectionConfigurationDocument | null ) {
		this.configuration = configuration;
	}

	/**
	 * Loads the current in-memory configuration.
	 * @return Current configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Keeps one complete configuration write pending.
	 * @param input - Configuration waiting to be persisted.
	 * @return Promise resolved after the fixture releases the write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.writes += 1;
		this.configuration = input as ProtectionConfigurationDocument;

		return new Promise<void>( ( resolve ) => {
			this.resolvePendingSave = resolve;
		} );
	}

	/**
	 * Completes the current pending configuration write.
	 * @since 0.1.0 Initial implementation.
	 */
	completeSave(): void {
		if ( this.resolvePendingSave === null ) {
			throw new Error( 'Expected one pending Protected Sites write.' );
		}

		this.resolvePendingSave();
		this.resolvePendingSave = null;
	}
}

/**
 * Creates one connected Protected Sites screen with local dependencies.
 * @param storage - In-memory local configuration storage.
 * @param permissionManager - Browser-permission test double.
 * @return Connected screen fixture.
 * @since 0.1.0 Initial implementation.
 */
async function createScreen(
	storage: ProtectionConfigurationStorageService,
	permissionManager: SitePermissionManager | null = createPermissionManager(),
): Promise<ComponentProtectedSitesScreen> {
	return createProtectedSitesScreenFixture( {
		storage,
		faviconProvider: FAVICON_PROVIDER,
		permissionManager,
	} );
}

describe( 'tocus-f-protected-sites-screen', () => {
	it( 'reports an unavailable editor dependency without leaving the screen busy', async () => {
		const element = await fixture<ComponentProtectedSitesScreen>( html`
			<tocus-f-protected-sites-screen
			.copy=${ TestEnglishLocalizationBundle.protectedSites }
			.siteItemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }></tocus-f-protected-sites-screen>
		` );
		await settleScreen( element );
		await element.refreshAccessState();

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'could not load' );
		assert.equal( element.shadowRoot?.querySelector( '[aria-busy="true"]' ), null );
	} );

	it( 'loads an empty local configuration into the manual add experience', async () => {
		assert.equal( customElements.get( 'tocus-f-protected-sites-screen' ), ComponentProtectedSitesScreen );

		const element = await createScreen( createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION ) );

		const shadowRoot = element.shadowRoot;
		assert.instanceOf( shadowRoot, ShadowRoot );
		assert.equal( shadowRoot.querySelector( 'h1' )?.textContent.trim(), 'Websites' );
		const addressInput = shadowRoot.querySelector( '#site-address' );
		assert.instanceOf( addressInput, HTMLInputElement );
		assert.equal( addressInput.getAttribute( 'aria-label' ), 'Website address' );
		assert.equal( shadowRoot.querySelector( 'label[for="site-address"]' ), null );
		assert.equal(
			getRequiredElement( element, '.empty-state h2', Element ).textContent.trim(),
			'No websites yet',
		);
		assert.equal( shadowRoot.querySelector( '[aria-busy="true"]' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'forwards localized item messages to the grouped site list', async () => {
		const itemCopy = { ...TestEnglishLocalizationBundle.protectedSiteItem, edit: 'Localized edit' };
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
		);

		element.siteItemCopy = itemCopy;
		await element.updateComplete;
		const list = element.shadowRoot?.querySelector( 'tocus-f-protected-site-list' );

		assert.instanceOf( list, ComponentProtectedSiteList );
		if ( ! ( list instanceof ComponentProtectedSiteList ) ) {
			throw new TypeError( 'Expected the grouped protected-site list.' );
		}
		assert.equal( list.itemCopy, itemCopy );
	} );

	it( 'marks configured sites as requiring access when no permission manager is available', async () => {
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
			null,
		);
		const item = getRequiredElement(
			element,
			'.shared-sites tocus-f-protected-site-item',
			ComponentProtectedSiteItem,
		);
		const restoreAction = item.shadowRoot?.querySelector( '.restore-access-action' );

		assert.isFalse( item.accessGranted );
		assert.isTrue( getRequiredElement( element, '#site-address', HTMLInputElement ).disabled );
		assert.instanceOf( restoreAction, HTMLButtonElement );
		if ( ! ( restoreAction instanceof HTMLButtonElement ) ) {
			throw new TypeError( 'Expected an unavailable restore-access action.' );
		}
		assert.isTrue( restoreAction.disabled );
	} );

	it( 'renders the selected add behavior without relational-selector support', async () => {
		const element = await createScreen( createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION ) );
		const independentInput = getRequiredElement(
			element,
			'input[value="independent"]',
			HTMLInputElement,
		);

		independentInput.click();
		await element.updateComplete;

		const selection = independentInput.nextElementSibling;
		assert.instanceOf( selection, HTMLSpanElement );
		assert.isTrue( selection.classList.contains( 'behavior-selection' ) );
		assert.notEqual( getComputedStyle( selection ).backgroundColor, 'rgba(0, 0, 0, 0)' );
	} );

	it( 'adds a manual website to shared whole-domain protection', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		const element = await createScreen( storage );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );

		input.value = 'https://www.instagram.com/reels';
		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		const item = getRequiredElement( element, 'tocus-f-protected-site-item', ComponentProtectedSiteItem );
		assert.equal( item.identity?.name, 'Instagram' );
		assert.equal( item.site?.identityHost, 'www.instagram.com' );
		assert.equal( item.site?.rule.host, 'instagram.com' );
		assert.equal( item.site?.rule.scopeId, DefaultProtectionScopeId );
		assert.equal( input.value, '' );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'Instagram' );
		assert.equal( storage.writes, 1 );
	} );

	it( 'renders a retained addition status from the latest localized copy', async () => {
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION ),
		);
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'instagram.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.protectedSites,
			formatAddedAnnouncement: formatLocalizedAddedAnnouncement,
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, '.announcement', Element ).textContent.trim(),
			'Localized addition: Instagram.',
		);
	} );

	it( 'shows and restores browser access for a configured site whose grant was revoked', async () => {
		let accessGranted = false;
		const permissionManager = createPermissionManager();
		permissionManager.filterConfiguration = ( configuration ) => Promise.resolve(
			accessGranted ? configuration : EMPTY_CONFIGURATION,
		);
		permissionManager.request = () => {
			accessGranted = true;

			return Promise.resolve( {
				status: SitePermissionRequestStatus.GRANTED,
				provenance: SitePermissionGrantProvenance.NEW,
			} );
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
			permissionManager,
		);
		const item = getRequiredElement(
			element,
			'.shared-sites tocus-f-protected-site-item',
			ComponentProtectedSiteItem,
		);

		assert.include( item.shadowRoot?.querySelector( '.access-required' )?.textContent, 'Access required' );
		const restoreAction = item.shadowRoot?.querySelector( '.restore-access-action' );
		assert.instanceOf( restoreAction, HTMLButtonElement );
		if ( ! ( restoreAction instanceof HTMLButtonElement ) ) {
			throw new TypeError( 'Expected the protected-site item to render its restore-access action.' );
		}
		restoreAction.click();
		await settleScreen( element );
		await item.updateComplete;

		assert.equal( item.shadowRoot?.querySelector( '.access-required' ), null );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'access was restored' );
	} );

	it( 'refreshes every site after shared navigation access is restored', async () => {
		let accessGranted = false;
		const permissionManager = createPermissionManager();
		permissionManager.filterConfiguration = ( configuration ) => Promise.resolve(
			accessGranted ? configuration : EMPTY_CONFIGURATION,
		);
		permissionManager.request = () => {
			accessGranted = true;

			return Promise.resolve( {
				status: SitePermissionRequestStatus.GRANTED,
				provenance: SitePermissionGrantProvenance.EXISTING,
			} );
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
			permissionManager,
		);
		const items = Array.from(
			getSiteListRoot( element ).querySelectorAll<ComponentProtectedSiteItem>(
				'tocus-f-protected-site-item',
			),
		);
		const youtubeItem = items.find( ( item ) => item.site?.identityHost === YOUTUBE_SITE.identityHost );

		assert.instanceOf( youtubeItem, ComponentProtectedSiteItem );
		if ( ! ( youtubeItem instanceof ComponentProtectedSiteItem ) ) {
			throw new TypeError( 'Expected the YouTube protected-site item.' );
		}

		const restoreAction = youtubeItem.shadowRoot?.querySelector( '.restore-access-action' );
		assert.instanceOf( restoreAction, HTMLButtonElement );
		if ( ! ( restoreAction instanceof HTMLButtonElement ) ) {
			throw new TypeError( 'Expected the YouTube restore-access action.' );
		}

		restoreAction.click();
		await settleScreen( element );

		assert.isTrue( items.every( ( item ) => item.accessGranted ) );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'YouTube access was restored' );
	} );

	it( 'keeps a revocation authoritative when an older restoration snapshot resolves later', async () => {
		const restorationSnapshot = Promise.withResolvers<ProtectionConfigurationDocument>();
		const revocationSnapshot = Promise.withResolvers<ProtectionConfigurationDocument>();
		let snapshotRead = 0;
		const permissionManager = createPermissionManager();
		permissionManager.filterConfiguration = () => {
			snapshotRead += 1;

			if ( snapshotRead === 1 ) {
				return Promise.resolve( EMPTY_CONFIGURATION );
			}

			return snapshotRead === 2
				? restorationSnapshot.promise
				: revocationSnapshot.promise;
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
			permissionManager,
		);
		const item = getRequiredElement(
			element,
			'.shared-sites tocus-f-protected-site-item',
			ComponentProtectedSiteItem,
		);
		const restoreAction = item.shadowRoot?.querySelector( '.restore-access-action' );

		assert.instanceOf( restoreAction, HTMLButtonElement );
		if ( ! ( restoreAction instanceof HTMLButtonElement ) ) {
			throw new TypeError( 'Expected the protected-site item restore-access action.' );
		}

		restoreAction.click();
		await Promise.resolve();
		assert.equal( snapshotRead, 2 );
		const refreshAfterRevocation = element.refreshAccessState();

		revocationSnapshot.resolve( EMPTY_CONFIGURATION );
		await refreshAfterRevocation;
		restorationSnapshot.resolve( POPULATED_CONFIGURATION );
		await settleScreen( element );

		assert.isFalse( item.accessGranted );
		assert.equal( getRequiredElement( element, '.announcement', Element ).textContent.trim(), '' );
	} );

	it( 'queues a permission refresh requested during the initial access snapshot', async () => {
		const initialSnapshot = Promise.withResolvers<ProtectionConfigurationDocument>();
		const removalSnapshot = Promise.withResolvers<ProtectionConfigurationDocument>();
		let snapshotRead = 0;
		const permissionManager = createPermissionManager();
		permissionManager.filterConfiguration = () => {
			snapshotRead += 1;

			return snapshotRead === 1 ? initialSnapshot.promise : removalSnapshot.promise;
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
			permissionManager,
		);
		const refreshAfterRemoval = element.refreshAccessState();

		assert.equal( snapshotRead, 2 );
		removalSnapshot.resolve( EMPTY_CONFIGURATION );
		await refreshAfterRemoval;
		initialSnapshot.resolve( POPULATED_CONFIGURATION );
		await settleScreen( element );

		const items = Array.from(
			getSiteListRoot( element ).querySelectorAll<ComponentProtectedSiteItem>(
				'tocus-f-protected-site-item',
			),
		);

		assert.isNotEmpty( items );
		assert.isTrue( items.every( ( item ) => ! item.accessGranted ) );
	} );

	it( 'refreshes every rendered access state from one current permission snapshot', async () => {
		let accessRevoked = false;
		let snapshotReads = 0;
		const permissionManager = createPermissionManager();
		permissionManager.filterConfiguration = ( configuration ) => {
			snapshotReads += 1;

			return Promise.resolve( accessRevoked ? EMPTY_CONFIGURATION : configuration );
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
			permissionManager,
		);
		const item = getRequiredElement(
			element,
			'.shared-sites tocus-f-protected-site-item',
			ComponentProtectedSiteItem,
		);

		assert.isTrue( item.accessGranted );
		accessRevoked = true;
		await element.refreshAccessState();
		await settleScreen( element );

		assert.equal( snapshotReads, 2 );
		assert.isFalse( item.accessGranted );
		assert.include( item.shadowRoot?.querySelector( '.access-required' )?.textContent, 'Access required' );
	} );

	it( 'ignores a restored-access event for a site that is no longer configured', async () => {
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ),
		);
		const main = getRequiredElement( element, 'main', HTMLElement );

		main.dispatchEvent( new CustomEvent( ProtectedSiteAccessRestoredEventName, {
			bubbles: true,
			composed: true,
			detail: { identityHost: 'removed.test' },
		} ) );
		await element.updateComplete;

		assert.equal( getRequiredElement( element, '.announcement', Element ).textContent.trim(), '' );
	} );

	it( 'keeps a site unsaved when browser access is denied', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		const permissionManager = createPermissionManager();
		permissionManager.request = () => Promise.resolve( { status: SitePermissionRequestStatus.DENIED } );
		const element = await createScreen( storage, permissionManager );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'instagram.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( input.value, 'instagram.com' );
		assert.include( getRequiredElement( element, '.site-input-error', Element ).textContent, 'Browser access' );
		assert.equal( storage.writes, 0 );
	} );

	it( 'renders an active enrollment error from the latest localized copy', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		const permissionManager = createPermissionManager();
		permissionManager.request = () => Promise.resolve( { status: SitePermissionRequestStatus.DENIED } );
		const element = await createScreen( storage, permissionManager );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'instagram.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.protectedSites,
			permissionDeniedError: 'Localized enrollment error.',
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, '.site-input-error', Element ).textContent.trim(),
			'Localized enrollment error.',
		);
	} );

	it( 'keeps a site unsaved when browser access cannot be requested', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		const permissionManager = createPermissionManager();
		permissionManager.request = () => Promise.resolve( { status: SitePermissionRequestStatus.ERROR } );
		const element = await createScreen( storage, permissionManager );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'instagram.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( input.value, 'instagram.com' );
		assert.include( getRequiredElement( element, '.site-input-error', Element ).textContent, 'could not be requested' );
		assert.equal( storage.writes, 0 );
	} );

	it( 'keeps a new host grant when the authoritative configuration still requires it', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION );
		const permissionManager = createPermissionManager();
		permissionManager.request = () => Promise.resolve( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		} );
		let releasedRuleHost = '';
		let hadRemainingSites = false;
		permissionManager.release = ( rule, remainingSites ) => {
			releasedRuleHost = rule.host;
			hadRemainingSites = remainingSites;
			return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
		};
		const element = await createScreen( storage, permissionManager );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'music.youtube.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( releasedRuleHost, '' );
		assert.isFalse( hadRemainingSites );
		assert.include( getRequiredElement( element, '.site-input-error', Element ).textContent, 'already on your list' );
		assert.equal( storage.writes, 0 );
	} );

	it( 'releases a new host grant when the configuration write fails', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const permissionManager = createPermissionManager();
		permissionManager.request = () => Promise.resolve( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		} );
		let releasedRuleHost = '';
		let hadRemainingSites = true;
		permissionManager.release = ( rule, remainingSites ) => {
			releasedRuleHost = rule.host;
			hadRemainingSites = remainingSites;
			return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
		};
		const element = await createScreen( storage, permissionManager );

		getRequiredElement( element, '#site-address', HTMLInputElement ).value = 'www.instagram.com';
		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( releasedRuleHost, 'instagram.com' );
		assert.isFalse( hadRemainingSites );
		assert.include( getRequiredElement( element, '.site-input-error', Element ).textContent, 'could not be saved' );
	} );

	it( 'reports retained browser access when rollback fails after persistence', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const permissionManager = createPermissionManager();
		permissionManager.request = () => Promise.resolve( {
			status: SitePermissionRequestStatus.GRANTED,
			provenance: SitePermissionGrantProvenance.NEW,
		} );
		permissionManager.release = () => Promise.resolve( SitePermissionReleaseStatus.ERROR );
		const element = await createScreen( storage, permissionManager );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'instagram.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( input.value, 'instagram.com' );
		assert.include( getRequiredElement( element, '.site-input-error', Element ).textContent, 'may still be active' );
	} );

	it( 'adds an independent exception from the manual behavior choice', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		const element = await createScreen( storage );

		getRequiredElement( element, '#site-address', HTMLInputElement ).value = 'reddit.com';
		getRequiredElement( element, 'input[value="independent"]', HTMLInputElement ).click();
		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal(
			getRequiredElement( element, '.independent-sites h2', Element ).textContent.trim(),
			'Independent sites',
		);
		assert.equal(
			getRequiredElement(
				element,
				'.independent-sites tocus-f-protected-site-item',
				ComponentProtectedSiteItem,
			)
				.site?.rule.scopeId,
			'scope_independent_a',
		);
	} );

	it( 'keeps one pending add and ignores a duplicate form submission', async () => {
		const storage = new DeferredProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		const element = await createScreen( storage );
		const form = getRequiredElement( element, '.add-site-form', HTMLFormElement );

		getRequiredElement( element, '#site-address', HTMLInputElement ).value = 'instagram.com';
		form.requestSubmit();
		form.requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 1 );
		assert.equal( getRequiredElement( element, '.primary-action', HTMLButtonElement ).textContent.trim(), 'Adding...' );

		storage.completeSave();
		await settleScreen( element );
		assert.equal(
			getSiteListRoot( element ).querySelectorAll( 'tocus-f-protected-site-item' ).length,
			1,
		);
	} );

	for ( const scenario of [
		{
			label: 'invalid input',
			configuration: EMPTY_CONFIGURATION,
			input: 'chrome://settings',
			expectedMessage: 'valid website address',
		},
		{
			label: 'overlapping input',
			configuration: POPULATED_CONFIGURATION,
			input: 'music.youtube.com',
			expectedMessage: 'already on your list',
		},
	] ) {
		it( `keeps ${ scenario.label } in the form with a specific explanation`, async () => {
			const storage = createMemoryProtectedSitesScreenStorage( scenario.configuration );
			const element = await createScreen( storage );
			const input = getRequiredElement( element, '#site-address', HTMLInputElement );
			input.value = scenario.input;

			getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
			await settleScreen( element );

			assert.equal( input.value, scenario.input );
			assert.include(
				getRequiredElement( element, '.site-input-error', Element ).textContent,
				scenario.expectedMessage,
			);
			assert.equal( input.getAttribute( 'aria-invalid' ), 'true' );
			assert.equal( storage.writes, 0 );
			await expect( element ).to.be.accessible();
		} );
	}

	it( 'groups shared and independent sites while sorting readable names', async () => {
		const sortedConfiguration: ProtectionConfigurationDocument = {
			...POPULATED_CONFIGURATION,
			sites: [ YOUTUBE_SITE, X_SITE, INSTAGRAM_SITE ],
		};
		const element = await createScreen( createMemoryProtectedSitesScreenStorage( sortedConfiguration ) );
		const siteListRoot = getSiteListRoot( element );
		const sections = Array.from( siteListRoot.querySelectorAll( '.site-group' ) );
		const items = Array.from(
			siteListRoot.querySelectorAll<ComponentProtectedSiteItem>( 'tocus-f-protected-site-item' ),
		);

		assert.deepEqual( sections.map( ( section ) => section.querySelector( 'h2' )?.textContent.trim() ), [
			'Shared timing',
			'Independent sites',
		] );
		assert.deepEqual( items.map( ( item ) => item.identity?.name ), [ 'Instagram', 'YouTube', 'X' ] );
		assert.equal( items[ 0 ]?.faviconSource, null );
		assert.match( items[ 1 ]?.faviconSource ?? '', /^chrome-extension:/u );
		assert.equal( items[ 2 ]?.faviconSource, null );
		await expect( element ).to.be.accessible();
	} );

	it( 'preserves malformed local data and allows a successful retry', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( null );
		const element = await createScreen( storage );

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'not replaced' );
		assert.equal( getRequiredElement( element, '#site-address', HTMLInputElement ).disabled, true );
		assert.equal( storage.writes, 0 );
		await expect( element ).to.be.accessible();

		storage.configuration = EMPTY_CONFIGURATION;
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.instanceOf( getSiteListRoot( element ).querySelector( '.empty-state' ), HTMLElement );
		assert.equal( getRequiredElement( element, '#site-address', HTMLInputElement ).disabled, false );
		assert.isTrue(
			element.shadowRoot?.activeElement ===
				getRequiredElement( element, '#site-address', HTMLInputElement ),
		);
	} );

	it( 'reports a local read failure and retries without rebuilding the screen', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		storage.rejectLoads = true;
		const element = await createScreen( storage );

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'could not load' );
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );
		assert.isTrue(
			element.shadowRoot?.activeElement ===
				getRequiredElement( element, '.retry-action', HTMLButtonElement ),
		);

		storage.rejectLoads = false;
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.instanceOf( getSiteListRoot( element ).querySelector( '.empty-state' ), HTMLElement );
	} );

	it( 'keeps the entered website when local persistence rejects the add', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
		storage.rejectSaves = true;
		const element = await createScreen( storage );
		const input = getRequiredElement( element, '#site-address', HTMLInputElement );
		input.value = 'instagram.com';

		getRequiredElement( element, '.add-site-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( input.value, 'instagram.com' );
		assert.include(
			getRequiredElement( element, '.site-input-error', Element ).textContent,
			'could not be saved',
		);
		assert.equal( storage.configuration, EMPTY_CONFIGURATION );
	} );

	it( 'moves a changed site between groups and announces the persisted update', async () => {
		const element = await createScreen( createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ) );
		const youtubeScopeId = ProtectionScopeIdSchema.parse( 'scope_youtube' );
		const updatedConfiguration: ProtectionConfigurationDocument = {
			...POPULATED_CONFIGURATION,
			sites: POPULATED_CONFIGURATION.sites.map( ( site ) => site.identityHost === 'youtube.com'
				? {
					...site,
					rule: { ...site.rule, scopeId: youtubeScopeId },
				}
				: site ),
			schedulesByScope: {
				...POPULATED_CONFIGURATION.schedulesByScope,
				[ youtubeScopeId ]: DefaultProtectionSchedule,
			},
			measurementRevisionsByScope: {
				...POPULATED_CONFIGURATION.measurementRevisionsByScope,
				[ DefaultProtectionScopeId ]: ProtectionMeasurementRevisionSchema.parse(
					'revision_default_without_youtube',
				),
				[ youtubeScopeId ]: ProtectionMeasurementRevisionSchema.parse( 'revision_youtube' ),
			},
		};

		getRequiredElement( element, 'tocus-f-protected-site-item', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail: {
					kind: ProtectedSiteConfigurationChangeKind.UPDATED,
					identityHost: 'youtube.com',
					configuration: updatedConfiguration,
				},
			},
		) );
		await element.updateComplete;

		assert.equal( getSiteListRoot( element ).querySelector( '.shared-sites' ), null );
		assert.equal( getSiteListRoot( element ).querySelectorAll( '.independent-sites li' ).length, 2 );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'YouTube' );
	} );

	it( 'replaces live-region content when the same update announcement repeats', async () => {
		const element = await createScreen( createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ) );
		const announcement = getRequiredElement( element, '.announcement', Element );
		const eventDetail = {
			kind: ProtectedSiteConfigurationChangeKind.UPDATED,
			identityHost: YOUTUBE_SITE.identityHost,
			configuration: POPULATED_CONFIGURATION,
		};

		getRequiredElement( element, 'main', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{ bubbles: true, composed: true, detail: eventDetail },
		) );
		await settleScreen( element );

		const mutations: MutationRecord[] = [];
		const observer = new MutationObserver( ( records ) => mutations.push( ...records ) );
		observer.observe( announcement, { childList: true, subtree: true } );

		getRequiredElement( element, 'main', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{ bubbles: true, composed: true, detail: eventDetail },
		) );
		await settleScreen( element );
		observer.disconnect();

		assert.include( announcement.textContent, 'YouTube was updated' );
		assert.isAbove( mutations.length, 0 );
	} );

	it( 'recovers focus when a stale item update arrives during a load failure', async () => {
		const storage = createMemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION );
		storage.rejectLoads = true;
		const element = await createScreen( storage );

		getRequiredElement( element, 'main', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail: {
					kind: ProtectedSiteConfigurationChangeKind.UPDATED,
					identityHost: YOUTUBE_SITE.identityHost,
					configuration: POPULATED_CONFIGURATION,
				},
			},
		) );
		await settleScreen( element );

		assert.equal( element.shadowRoot?.querySelector( 'tocus-f-protected-site-item' ), null );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'YouTube' );
		assert.isTrue(
			element.shadowRoot?.activeElement ===
				getRequiredElement( element, '.retry-action', HTMLButtonElement ),
		);
	} );

	it( 'focuses manual entry after the final site is removed', async () => {
		const onlySiteConfiguration: ProtectionConfigurationDocument = {
			...TestEmptyProtectionConfiguration,
			sites: [ YOUTUBE_SITE ],
		};
		const element = await createScreen( createMemoryProtectedSitesScreenStorage( onlySiteConfiguration ) );
		getRequiredElement( element, 'tocus-f-protected-site-item', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail: {
					kind: ProtectedSiteConfigurationChangeKind.REMOVED,
					identityHost: onlySiteConfiguration.sites[ 0 ]?.identityHost,
					configuration: EMPTY_CONFIGURATION,
					permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
					site: YOUTUBE_SITE,
				},
			},
		) );
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '#site-address', HTMLInputElement ),
		);
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'removed' );
	} );

	it( 'does not repeat browser access cleanup after a protected site is removed', async () => {
		const permissionManager = createPermissionManager();
		let releasedRuleHost = '';
		let hadRemainingSites = true;
		permissionManager.release = ( rule, remainingSites ) => {
			releasedRuleHost = rule.host;
			hadRemainingSites = remainingSites;
			return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
		};
		const onlySiteConfiguration: ProtectionConfigurationDocument = {
			...TestEmptyProtectionConfiguration,
			sites: [ YOUTUBE_SITE ],
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( onlySiteConfiguration ),
			permissionManager,
		);

		getRequiredElement( element, 'tocus-f-protected-site-item', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail: {
					kind: ProtectedSiteConfigurationChangeKind.REMOVED,
					identityHost: YOUTUBE_SITE.identityHost,
					configuration: EMPTY_CONFIGURATION,
					permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
					site: YOUTUBE_SITE,
				},
			},
		) );
		await settleScreen( element );

		assert.equal( releasedRuleHost, '' );
		assert.isTrue( hadRemainingSites );
	} );

	it( 'announces retained browser access after a protected site is removed', async () => {
		const permissionManager = createPermissionManager();
		permissionManager.release = () => Promise.resolve( SitePermissionReleaseStatus.RETAINED );
		const onlySiteConfiguration: ProtectionConfigurationDocument = {
			...TestEmptyProtectionConfiguration,
			sites: [ YOUTUBE_SITE ],
		};
		const element = await createScreen(
			createMemoryProtectedSitesScreenStorage( onlySiteConfiguration ),
			permissionManager,
		);

		getRequiredElement( element, 'tocus-f-protected-site-item', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail: {
					kind: ProtectedSiteConfigurationChangeKind.REMOVED,
					identityHost: YOUTUBE_SITE.identityHost,
					configuration: EMPTY_CONFIGURATION,
					permissionReleaseStatus: SitePermissionReleaseStatus.RETAINED,
					site: YOUTUBE_SITE,
				},
			},
		) );
		await settleScreen( element );

		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'could not be removed' );
	} );

	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentProtectedSitesScreen>( html`<tocus-f-protected-sites-screen></tocus-f-protected-sites-screen>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
