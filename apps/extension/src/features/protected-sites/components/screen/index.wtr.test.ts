import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../../../domains/protection/types/protection-schedule';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../services/site-favicon-provider';
import { ComponentProtectedSiteItem } from '../site-item';
import {
	ProtectedSiteConfigurationChangedEventName,
	ProtectedSiteConfigurationChangeKind,
} from '../site-item/types';
import { ComponentProtectedSitesScreen } from './index';

const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };
const YOUTUBE_SITE: ProtectedSiteConfiguration = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
const X_SITE: ProtectedSiteConfiguration = {
	identityHost: 'x.com',
	rule: {
		host: 'x.com',
		includeSubdomains: true,
		scopeId: ProtectionScopeIdSchema.parse( 'scope_x' ),
	},
};
const INSTAGRAM_SITE: ProtectedSiteConfiguration = {
	identityHost: 'instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ YOUTUBE_SITE, X_SITE ],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ X_SITE.rule.scopeId ]: DefaultProtectionSchedule,
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

const FAVICON_PROVIDER: SiteFaviconProvider = { getSource: getFaviconSource };

/**
 * In-memory protected-site storage used by the settings-screen fixtures.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectedSitesScreenStorage implements ProtectionConfigurationStorageService {
	rejectLoads = false;

	rejectSaves = false;

	writes = 0;

	/**
	 * Creates storage with one initial configuration result.
	 * @param configuration - Configuration returned by the next load.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public configuration: ProtectionConfigurationDocument | null ) {}

	/**
	 * Loads the current in-memory configuration.
	 * @return Current configuration or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		if ( this.rejectLoads ) {
			return Promise.reject( new Error( 'Local read unavailable.' ) );
		}

		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores one complete configuration.
	 * @param input - Configuration to persist.
	 * @return Promise resolved after the write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		this.writes += 1;
		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * In-memory storage that keeps one screen write pending until the test releases it.
 * @since 0.1.0 Initial implementation.
 */
class DeferredProtectedSitesScreenStorage extends MemoryProtectedSitesScreenStorage {
	private resolvePendingSave: ( () => void ) | null = null;

	/**
	 * Keeps one complete configuration write pending.
	 * @param input - Configuration waiting to be persisted.
	 * @return Promise resolved after the fixture releases the write.
	 * @since 0.1.0 Initial implementation.
	 */
	override save( input: unknown ): Promise<void> {
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
 * Runs one component-test mutation immediately inside the current browser context.
 * @param mutation - Deferred protected-site configuration mutation.
 * @return Exact mutation result.
 * @since 0.1.0 Initial implementation.
 */
function coordinateMutationDirectly(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return mutation();
}

/**
 * Creates one real editor backed by the supplied screen storage.
 * @param storage - In-memory local configuration storage.
 * @return Protected-site configuration editor.
 * @since 0.1.0 Initial implementation.
 */
function createEditor( storage: MemoryProtectedSitesScreenStorage ): ProtectionConfigurationEditor {
	return createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		coordinateMutation: coordinateMutationDirectly,
	} );
}

/**
 * Creates one deterministic independent scope for screen fixtures.
 * @return Stable independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_independent_a';
}

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Returns one required element from the Protected Sites shadow tree.
 * @param element - Rendered Protected Sites screen.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<T extends Element>(
	element: ComponentProtectedSitesScreen,
	selector: string,
	expectedType: ElementConstructor<T>,
): T {
	const match = element.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the Protected Sites screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Creates one connected Protected Sites screen with local dependencies.
 * @param storage - In-memory local configuration storage.
 * @return Connected screen fixture.
 * @since 0.1.0 Initial implementation.
 */
async function createScreen(
	storage: MemoryProtectedSitesScreenStorage,
): Promise<ComponentProtectedSitesScreen> {
	const element = await fixture<ComponentProtectedSitesScreen>( html`
		<tocus-f-protected-sites-screen
			.editor=${ createEditor( storage ) }
			.faviconProvider=${ FAVICON_PROVIDER }
		></tocus-f-protected-sites-screen>
	` );
	await settleScreen( element );

	return element;
}

/**
 * Waits for queued loading and Lit rendering.
 * @param element - Protected Sites screen expected to update.
 * @return Promise resolved after the next task and component update.
 * @since 0.1.0 Initial implementation.
 */
async function settleScreen( element: ComponentProtectedSitesScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

describe( 'tocus-f-protected-sites-screen', () => {
	it( 'reports an unavailable editor dependency without leaving the screen busy', async () => {
		const element = await fixture<ComponentProtectedSitesScreen>( html`
			<tocus-f-protected-sites-screen></tocus-f-protected-sites-screen>
		` );
		await settleScreen( element );

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'could not load' );
		assert.equal( element.shadowRoot?.querySelector( '[aria-busy="true"]' ), null );
	} );

	it( 'loads an empty local configuration into the manual add experience', async () => {
		assert.equal( customElements.get( 'tocus-f-protected-sites-screen' ), ComponentProtectedSitesScreen );

		const element = await createScreen( new MemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION ) );

		const shadowRoot = element.shadowRoot;
		assert.instanceOf( shadowRoot, ShadowRoot );
		assert.equal( shadowRoot.querySelector( 'h1' )?.textContent.trim(), 'Protected sites' );
		assert.equal( shadowRoot.querySelector( 'label[for="site-address"]' )?.textContent.trim(), 'Website address' );
		assert.instanceOf( shadowRoot.querySelector( '#site-address' ), HTMLInputElement );
		assert.equal( shadowRoot.querySelector( '.empty-state h2' )?.textContent.trim(), 'No protected sites yet' );
		assert.equal( shadowRoot.querySelector( '[aria-busy="true"]' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'renders the selected add behavior without relational-selector support', async () => {
		const element = await createScreen( new MemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION ) );
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
		const storage = new MemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
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

	it( 'adds an independent exception from the manual behavior choice', async () => {
		const storage = new MemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
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
		assert.equal( element.shadowRoot?.querySelectorAll( 'tocus-f-protected-site-item' ).length, 1 );
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
			expectedMessage: 'already protected',
		},
	] ) {
		it( `keeps ${ scenario.label } in the form with a specific explanation`, async () => {
			const storage = new MemoryProtectedSitesScreenStorage( scenario.configuration );
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
		const element = await createScreen( new MemoryProtectedSitesScreenStorage( sortedConfiguration ) );
		const sections = Array.from( element.shadowRoot?.querySelectorAll( '.site-group' ) ?? [] );
		const items = Array.from(
			element.shadowRoot?.querySelectorAll<ComponentProtectedSiteItem>( 'tocus-f-protected-site-item' ) ?? [],
		);

		assert.deepEqual( sections.map( ( section ) => section.querySelector( 'h2' )?.textContent.trim() ), [
			'Shared protection',
			'Independent sites',
		] );
		assert.deepEqual( items.map( ( item ) => item.identity?.name ), [ 'Instagram', 'YouTube', 'X' ] );
		assert.equal( items[ 0 ]?.faviconSource, null );
		assert.match( items[ 1 ]?.faviconSource ?? '', /^chrome-extension:/u );
		assert.equal( items[ 2 ]?.faviconSource, null );
		await expect( element ).to.be.accessible();
	} );

	it( 'preserves malformed local data and allows a successful retry', async () => {
		const storage = new MemoryProtectedSitesScreenStorage( null );
		const element = await createScreen( storage );

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'not replaced' );
		assert.equal( getRequiredElement( element, '#site-address', HTMLInputElement ).disabled, true );
		assert.equal( storage.writes, 0 );
		await expect( element ).to.be.accessible();

		storage.configuration = EMPTY_CONFIGURATION;
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.instanceOf( element.shadowRoot?.querySelector( '.empty-state' ), HTMLElement );
		assert.equal( getRequiredElement( element, '#site-address', HTMLInputElement ).disabled, false );
		assert.isTrue(
			element.shadowRoot.activeElement ===
				getRequiredElement( element, '#site-address', HTMLInputElement ),
		);
	} );

	it( 'reports a local read failure and retries without rebuilding the screen', async () => {
		const storage = new MemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
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

		assert.instanceOf( element.shadowRoot?.querySelector( '.empty-state' ), HTMLElement );
	} );

	it( 'keeps the entered website when local persistence rejects the add', async () => {
		const storage = new MemoryProtectedSitesScreenStorage( EMPTY_CONFIGURATION );
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
		const element = await createScreen( new MemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ) );
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

		assert.equal( element.shadowRoot?.querySelector( '.shared-sites' ), null );
		assert.equal( element.shadowRoot?.querySelectorAll( '.independent-sites li' ).length, 2 );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'YouTube' );
	} );

	it( 'replaces live-region content when the same update announcement repeats', async () => {
		const element = await createScreen( new MemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION ) );
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
		const storage = new MemoryProtectedSitesScreenStorage( POPULATED_CONFIGURATION );
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
	} );

	it( 'focuses manual entry after the final site is removed', async () => {
		const onlySiteConfiguration: ProtectionConfigurationDocument = {
			...TestEmptyProtectionConfiguration,
			sites: [ YOUTUBE_SITE ],
		};
		const element = await createScreen( new MemoryProtectedSitesScreenStorage( onlySiteConfiguration ) );
		getRequiredElement( element, 'tocus-f-protected-site-item', Element ).dispatchEvent( new CustomEvent(
			ProtectedSiteConfigurationChangedEventName,
			{
				bubbles: true,
				composed: true,
				detail: {
					kind: ProtectedSiteConfigurationChangeKind.REMOVED,
					identityHost: onlySiteConfiguration.sites[ 0 ]?.identityHost,
					configuration: EMPTY_CONFIGURATION,
				},
			},
		) );
		await element.updateComplete;

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '#site-address', HTMLInputElement ),
		);
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'removed' );
	} );
} );
