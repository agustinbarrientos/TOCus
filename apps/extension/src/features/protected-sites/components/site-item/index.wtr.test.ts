import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
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
import {
	createProtectedSiteEnrollmentService,
	type ProtectedSiteEnrollmentService,
} from '../../services/protected-site-enrollment';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../services/site-permission-manager';
import { ComponentProtectedSiteItem } from './index';
import {
	ProtectedSiteAccessRestoredEventName,
	ProtectedSiteConfigurationChangedEventName,
	ProtectedSiteConfigurationChangeKind,
	type ProtectedSiteConfigurationChangedEventDetail,
} from './types';

/**
 * Shared Instagram site used by protected-site item fixtures.
 * @since 0.1.0 Initial implementation.
 */
const SITE = {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
/**
 * Display identity shown by the protected-site item fixtures.
 * @since 0.1.0 Initial implementation.
 */
const IDENTITY = {
	name: 'Instagram',
	monogram: 'I',
	colorIndex: 2,
};
/**
 * Complete configuration containing the shared Instagram fixture.
 * @since 0.1.0 Initial implementation.
 */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ SITE ],
};
/**
 * Independent Instagram configuration used by deletion-choice fixtures.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SITE: ProtectedSiteConfiguration = {
	...SITE,
	rule: {
		...SITE.rule,
		scopeId: ProtectionScopeIdSchema.parse( 'scope_instagram' ),
	},
};

/**
 * Complete configuration containing the independent deletion-choice fixture.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ INDEPENDENT_SITE ],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		scope_instagram: DefaultProtectionSchedule,
	},
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		scope_instagram: ProtectionMeasurementRevisionSchema.parse( 'revision_instagram' ),
	},
};

/**
 * In-memory editor storage with an optional write failure.
 * @since 0.1.0 Initial implementation.
 */
class MemorySiteItemStorage implements ProtectionConfigurationStorageService {
	configuration: ProtectionConfigurationDocument = CONFIGURATION;

	/**
	 * Creates storage that either accepts or rejects writes.
	 * @param rejectWrites - Whether persistence must reject.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly rejectWrites = false ) {}

	/**
	 * Loads the latest in-memory configuration.
	 * @return Current configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores a validated editor result or rejects when requested by the fixture.
	 * @param input - Configuration to persist.
	 * @return Promise resolved or rejected after the attempted write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.rejectWrites ) {
			return Promise.reject( new Error( 'Local storage unavailable.' ) );
		}

		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * In-memory storage whose write completes only when the test releases it.
 * @since 0.1.0 Initial implementation.
 */
class DeferredSiteItemStorage extends MemorySiteItemStorage {
	saveCalls = 0;

	private pendingInput: ProtectionConfigurationDocument | null = null;

	private resolvePendingSave: ( () => void ) | null = null;

	/**
	 * Captures one pending write without completing it.
	 * @param input - Configuration waiting to be persisted.
	 * @return Promise resolved after completeSave is called.
	 * @since 0.1.0 Initial implementation.
	 */
	override save( input: unknown ): Promise<void> {
		this.saveCalls += 1;
		this.pendingInput = input as ProtectionConfigurationDocument;

		return new Promise( ( resolve ) => {
			this.resolvePendingSave = resolve;
		} );
	}

	/**
	 * Completes the captured write.
	 * @since 0.1.0 Initial implementation.
	 */
	completeSave(): void {
		if ( this.pendingInput === null || this.resolvePendingSave === null ) {
			throw new Error( 'Expected one pending site-item write.' );
		}

		this.configuration = this.pendingInput;
		this.resolvePendingSave();
		this.pendingInput = null;
		this.resolvePendingSave = null;
	}
}

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Returns one required element from a protected-site item shadow tree.
 * @param element - Rendered protected-site item.
 * @param selector - Required selector.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement( element: ComponentProtectedSiteItem, selector: string ): Element;

/**
 * Returns one required element after validating its runtime constructor.
 * @param element - Rendered protected-site item.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching typed element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<T extends Element>(
	element: ComponentProtectedSiteItem,
	selector: string,
	expectedType: ElementConstructor<T>,
): T;

/**
 * Returns one required element after validating its runtime constructor.
 * @param element - Rendered protected-site item.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement(
	element: ComponentProtectedSiteItem,
	selector: string,
	expectedType: ElementConstructor<Element> = Element,
): Element {
	const match = element.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the protected-site item to render ${ selector }.` );
	}

	return match;
}

/**
 * Creates a real editor backed by observable local memory.
 * @param storage - In-memory persistence dependency.
 * @return Protected-site configuration editor.
 * @since 0.1.0 Initial implementation.
 */
function createEditor( storage: MemorySiteItemStorage ): ProtectionConfigurationEditor {
	let measurementRevisionSequence = 0;

	/**
	 * Creates one deterministic revision that remains unique within this editor.
	 * @return Fresh measurement revision.
	 * @since 0.1.0 Initial implementation.
	 */
	function createMeasurementRevision(): string {
		measurementRevisionSequence += 1;

		return `revision_site_item_${ String( measurementRevisionSequence ) }`;
	}

	return createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		createMeasurementRevision,
		coordinateMutation: coordinateMutationDirectly,
	} );
}

/**
 * Grants one configured site in site-item fixtures.
 * @return Successful existing-permission result.
 * @since 0.1.0 Initial implementation.
 */
function requestSitePermission(): ReturnType<SitePermissionManager[ 'request' ]> {
	return Promise.resolve( {
		status: SitePermissionRequestStatus.GRANTED,
		provenance: SitePermissionGrantProvenance.EXISTING,
	} );
}

/**
 * Releases one configured site in site-item fixtures.
 * @return Successful permission-release result.
 * @since 0.1.0 Initial implementation.
 */
function releaseSitePermission(): ReturnType<SitePermissionManager[ 'release' ]> {
	return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
}

/**
 * Returns the supplied configuration unchanged in site-item fixtures.
 * @param configuration - Validated persisted configuration.
 * @return Unchanged configuration.
 * @since 0.1.0 Initial implementation.
 */
function filterPermissionConfiguration(
	configuration: ProtectionConfigurationDocument,
): Promise<ProtectionConfigurationDocument> {
	return Promise.resolve( configuration );
}

/**
 * Reports complete browser access in default site-item fixtures.
 * @return True for the default granted-access fixture.
 * @since 0.1.0 Initial implementation.
 */
function hasSiteAccess(): Promise<boolean> {
	return Promise.resolve( true );
}

/**
 * Creates a site-item permission manager with one configurable request operation.
 * @param request - Browser permission request behavior.
 * @return Complete permission manager fixture.
 * @since 0.1.0 Initial implementation.
 */
function createPermissionManager(
	request: SitePermissionManager[ 'request' ] = requestSitePermission,
): SitePermissionManager {
	return {
		filterConfiguration: filterPermissionConfiguration,
		hasAccess: hasSiteAccess,
		request,
		release: releaseSitePermission,
	};
}

/**
 * Creates protected-site enrollment backed by the supplied storage.
 * @param storage - In-memory persistence dependency.
 * @return Coordinated enrollment and removal service.
 * @since 0.1.0 Initial implementation.
 */
function createEnrollmentService( storage: MemorySiteItemStorage ): ProtectedSiteEnrollmentService {
	return createProtectedSiteEnrollmentService( {
		editor: createEditor( storage ),
		permissionManager: createPermissionManager(),
	} );
}

/**
 * Creates one deterministic independent scope for site-item fixtures.
 * @return Stable independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_instagram';
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
 * Waits for queued promise handlers and Lit updates.
 * @param element - Component expected to update.
 * @return Promise resolved after the next task and component update.
 * @since 0.1.0 Initial implementation.
 */
async function settleAsyncAction( element: ComponentProtectedSiteItem ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

describe( 'tocus-f-protected-site-item', () => {
	it( 'renders no partial item before complete site identity inputs exist', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }></tocus-f-protected-site-item>
		` );

		assert.equal( element.shadowRoot?.textContent.trim(), '' );
	} );

	it( 'keeps the access-required state when browser access is denied', async () => {
		const permissionManager = createPermissionManager(
			() => Promise.resolve( { status: SitePermissionRequestStatus.DENIED } ),
		);
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.accessGranted=${ false }
				.permissionManager=${ permissionManager }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.restore-access-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		assert.instanceOf( element.shadowRoot?.querySelector( '.access-required' ), HTMLElement );
		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'still required' );
	} );

	it( 'renders an active access error from the latest localized copy', async () => {
		const permissionManager = createPermissionManager(
			() => Promise.resolve( { status: SitePermissionRequestStatus.DENIED } ),
		);
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.accessGranted=${ false }
				.permissionManager=${ permissionManager }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.restore-access-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );
		element.copy = {
			...TestEnglishLocalizationBundle.protectedSiteItem,
			accessRequestError: 'Localized access error.',
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, '.operation-error' ).textContent.trim(),
			'Localized access error.',
		);
	} );

	it( 'keeps the access-required state when the browser permission request rejects', async () => {
		const permissionManager = createPermissionManager(
			() => Promise.reject( new Error( 'Unavailable.' ) ),
		);
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.accessGranted=${ false }
				.permissionManager=${ permissionManager }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.restore-access-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		assert.instanceOf( element.shadowRoot?.querySelector( '.access-required' ), HTMLElement );
		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'still required' );
	} );

	it( 'emits one recovery request without asserting access before the owner refreshes it', async () => {
		let completeRequest: ( () => void ) | null = null;
		let requestCount = 0;
		let restoredEventCount = 0;

		/**
		 * Returns the request completion captured inside the permission callback.
		 * @return Current request completion or null before capture.
		 * @since 0.1.0 Initial implementation.
		 */
		function getCompleteRequest(): ( () => void ) | null {
			return completeRequest;
		}

		const permissionManager = createPermissionManager( () => {
			requestCount += 1;
			return new Promise( ( resolve ) => {
				completeRequest = () => {
					resolve( {
						status: SitePermissionRequestStatus.GRANTED,
						provenance: SitePermissionGrantProvenance.NEW,
					} );
				};
			} );
		} );
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.accessGranted=${ false }
				.permissionManager=${ permissionManager }
			></tocus-f-protected-site-item>
		` );
		const restoreAction = getRequiredElement(
			element,
			'.restore-access-action',
			HTMLButtonElement,
		);
		element.addEventListener( ProtectedSiteAccessRestoredEventName, () => {
			restoredEventCount += 1;
		} );

		restoreAction.click();
		restoreAction.click();
		assert.equal( requestCount, 1 );
		const finishRequest = getCompleteRequest();
		if ( finishRequest === null ) {
			throw new Error( 'Expected one pending access request.' );
		}
		finishRequest();
		await settleAsyncAction( element );

		assert.isFalse( element.accessGranted );
		assert.instanceOf( element.shadowRoot?.querySelector( '.access-required' ), HTMLElement );
		assert.equal( restoredEventCount, 1 );
	} );

	it( 'renders a readable local identity and whole-domain shared behavior', async () => {
		assert.equal( customElements.get( 'tocus-f-protected-site-item' ), ComponentProtectedSiteItem );

		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
			></tocus-f-protected-site-item>
		` );
		const shadowRoot = element.shadowRoot;

		assert.instanceOf( shadowRoot, ShadowRoot );
		assert.equal( shadowRoot.querySelector( 'h3' )?.textContent.trim(), 'Instagram' );
		assert.equal( shadowRoot.querySelector( '.domain' )?.textContent.trim(), 'instagram.com' );
		assert.equal( shadowRoot.querySelector( '.monogram' )?.textContent.trim(), 'I' );
		assert.include( shadowRoot.querySelector( '.boundary' )?.textContent, 'subdomains' );
		assert.equal( shadowRoot.querySelector( '.scope-label' )?.textContent.trim(), 'Shared' );
		assert.equal( shadowRoot.querySelector( 'button' )?.textContent.trim(), 'Manage this website' );
		await expect( element ).to.be.accessible();
	} );

	it( 'labels independent exact-host behavior without implying broader coverage', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ {
					identityHost: 'localhost',
					rule: {
						host: 'localhost',
						includeSubdomains: false,
						scopeId: 'scope_localhost',
					},
				} }
				.identity=${ {
					name: 'Localhost',
					monogram: 'L',
					colorIndex: 1,
				} }
			></tocus-f-protected-site-item>
		` );

		assert.equal( element.shadowRoot?.querySelector( '.scope-label' )?.textContent.trim(), 'Independent' );
		assert.equal( element.shadowRoot?.querySelector( '.boundary' )?.textContent.trim(), 'Includes only localhost' );
	} );

	it( 'uses a decorative cached favicon and silently returns to the monogram after image failure', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.faviconSource=${ 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fwww.instagram.com%2F&size=32' }
			></tocus-f-protected-site-item>
		` );
		const image = getRequiredElement( element, 'img', HTMLImageElement );

		assert.equal( image.alt, '' );
		assert.equal( element.shadowRoot?.querySelector( '.monogram' ), null );

		image.dispatchEvent( new Event( 'error' ) );
		await element.updateComplete;

		assert.equal( element.shadowRoot?.querySelector( 'img' ), null );
		assert.equal( getRequiredElement( element, '.monogram' ).textContent.trim(), 'I' );
	} );

	it( 'renders the selected edit behavior without relational-selector support', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		const independentInput = getRequiredElement(
			element,
			'input[value="independent"]',
			HTMLInputElement,
		);
		independentInput.click();

		const selection = independentInput.nextElementSibling;
		assert.instanceOf( selection, HTMLSpanElement );
		assert.isTrue( selection.classList.contains( 'behavior-selection' ) );
		assert.notEqual( getComputedStyle( selection ).backgroundColor, 'rgba(0, 0, 0, 0)' );
		await expect( element ).to.be.accessible();
	} );

	it( 'updates the editable name and scope atomically before returning focus to Edit', async () => {
		const storage = new MemorySiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;

		const form = getRequiredElement( element, 'form', HTMLFormElement );
		const nameInput = getRequiredElement( element, '#display-name', HTMLInputElement );
		const independentInput = getRequiredElement( element, 'input[value="independent"]', HTMLInputElement );

		assert.equal( nameInput.value, 'Instagram' );
		nameInput.value = 'Social pause';
		independentInput.click();

		const changedDetails: ProtectedSiteConfigurationChangedEventDetail[] = [];
		element.addEventListener( ProtectedSiteConfigurationChangedEventName, ( event ) => {
			changedDetails.push( ( event as CustomEvent<ProtectedSiteConfigurationChangedEventDetail> ).detail );
		} );
		form.requestSubmit();
		await settleAsyncAction( element );

		assert.deepEqual( changedDetails, [ {
			kind: ProtectedSiteConfigurationChangeKind.UPDATED,
			identityHost: 'www.instagram.com',
			configuration: storage.configuration,
		} ] );
		assert.equal( storage.configuration.sites[ 0 ]?.displayNameOverride, 'Social pause' );
		assert.equal( storage.configuration.sites[ 0 ]?.rule.scopeId, 'scope_instagram' );
		assert.equal( element.shadowRoot?.querySelector( 'form' ), null );
		assert.equal( element.shadowRoot?.activeElement, getRequiredElement( element, '.edit-action' ) );
	} );

	it( 'keeps the inline editor and entered values when local persistence fails', async () => {
		const storage = new MemorySiteItemStorage( true );
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;

		const nameInput = getRequiredElement( element, '#display-name', HTMLInputElement );
		nameInput.value = 'Keep this draft';
		getRequiredElement( element, 'form', HTMLFormElement ).requestSubmit();
		await settleAsyncAction( element );

		assert.equal( getRequiredElement( element, '#display-name', HTMLInputElement ).value, 'Keep this draft' );
		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'could not be saved' );
		assert.equal( storage.configuration, CONFIGURATION );
		await expect( element ).to.be.accessible();
	} );

	it( 'shows one pending save and ignores a duplicate form submission', async () => {
		const storage = new DeferredSiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		const form = getRequiredElement( element, 'form', HTMLFormElement );
		form.requestSubmit();
		form.requestSubmit();
		await settleAsyncAction( element );

		assert.equal(
			getRequiredElement( element, '.primary-action', HTMLButtonElement ).textContent.trim(),
			'Saving...',
		);
		assert.equal( storage.saveCalls, 1 );

		storage.completeSave();
		await settleAsyncAction( element );
		assert.equal( element.shadowRoot?.querySelector( 'form' ), null );
	} );

	it( 'restores automatic naming and cancels without persisting the draft', async () => {
		const storage = new MemorySiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.name-control button', HTMLButtonElement ).click();
		await element.updateComplete;

		const input = getRequiredElement( element, '#display-name', HTMLInputElement );
		assert.equal( input.value, '' );
		assert.equal( element.shadowRoot?.activeElement, input );

		getRequiredElement( element, '.editor-actions button', HTMLButtonElement ).click();
		await element.updateComplete;

		assert.equal( element.shadowRoot?.querySelector( 'form' ), null );
		assert.equal( element.shadowRoot?.activeElement, getRequiredElement( element, '.edit-action' ) );
		assert.equal( storage.configuration, CONFIGURATION );
	} );

	it( 'keeps a stale inline edit open with a clear reload message', async () => {
		const storage = new MemorySiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		storage.configuration = { ...TestEmptyProtectionConfiguration };
		getRequiredElement( element, 'form', HTMLFormElement ).requestSubmit();
		await settleAsyncAction( element );

		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'changed elsewhere' );
		assert.instanceOf( element.shadowRoot?.querySelector( 'form' ), HTMLFormElement );
	} );

	it( 'reports a missing editor dependency without discarding the open form', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, 'form', HTMLFormElement ).requestSubmit();
		await settleAsyncAction( element );

		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'could not be saved' );
	} );

	it( 'removes a site only after inline confirmation', async () => {
		const storage = new MemorySiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
				.enrollmentService=${ createEnrollmentService( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;

		assert.include( getRequiredElement( element, '.remove-confirmation' ).textContent, 'Remove Instagram?' );
		assert.equal( element.shadowRoot?.querySelector( 'input[name="delete-statistics"]' ), null );
		assert.equal( storage.configuration.sites.length, 1 );
		await expect( element ).to.be.accessible();
		getRequiredElement( element, '.remove-confirmation button', HTMLButtonElement ).click();
		await element.updateComplete;
		assert.equal( element.shadowRoot?.querySelector( '.remove-confirmation' ), null );
		assert.equal( element.shadowRoot?.activeElement, getRequiredElement( element, '.remove-action' ) );

		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;

		const changedDetails: ProtectedSiteConfigurationChangedEventDetail[] = [];
		element.addEventListener( ProtectedSiteConfigurationChangedEventName, ( event ) => {
			changedDetails.push( ( event as CustomEvent<ProtectedSiteConfigurationChangedEventDetail> ).detail );
		} );
		getRequiredElement( element, '.confirm-remove-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		const removal = changedDetails.at( 0 );

		assert.equal( removal?.kind, ProtectedSiteConfigurationChangeKind.REMOVED );
		assert.equal( storage.configuration.sites.length, 0 );
	} );

	it( 'removes an independent site without offering to delete its statistics', async () => {
		const storage = new MemorySiteItemStorage();
		storage.configuration = INDEPENDENT_CONFIGURATION;
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ INDEPENDENT_SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
				.enrollmentService=${ createEnrollmentService( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;

		const changedDetails: ProtectedSiteConfigurationChangedEventDetail[] = [];
		element.addEventListener( ProtectedSiteConfigurationChangedEventName, ( event ) => {
			changedDetails.push( ( event as CustomEvent<ProtectedSiteConfigurationChangedEventDetail> ).detail );
		} );

		assert.equal( element.shadowRoot?.querySelector( 'input[name="delete-statistics"]' ), null );
		assert.notInclude( element.shadowRoot?.textContent ?? '', 'Delete this site\'s statistics too' );
		await expect( element ).to.be.accessible();
		getRequiredElement( element, '.confirm-remove-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		const removal = changedDetails.at( 0 );
		assert.equal( removal?.kind, ProtectedSiteConfigurationChangeKind.REMOVED );
		if ( removal?.kind !== ProtectedSiteConfigurationChangeKind.REMOVED ) {
			throw new TypeError( 'Expected one independent-site removal detail.' );
		}
		assert.deepEqual( removal.site, INDEPENDENT_SITE );
		assert.equal( storage.configuration.sites.length, 0 );
	} );

	it( 'keeps removal confirmation visible when the stored site changed elsewhere', async () => {
		const storage = new MemorySiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
				.enrollmentService=${ createEnrollmentService( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;
		storage.configuration = { ...TestEmptyProtectionConfiguration };
		getRequiredElement( element, '.confirm-remove-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'changed elsewhere' );
		assert.instanceOf( element.shadowRoot?.querySelector( '.remove-confirmation' ), HTMLElement );
	} );

	it( 'keeps removal confirmation visible when local persistence fails', async () => {
		const storage = new MemorySiteItemStorage( true );
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
				.enrollmentService=${ createEnrollmentService( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.confirm-remove-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'could not be saved' );
		assert.equal( storage.configuration.sites.length, 1 );
	} );

	it( 'ignores a duplicate removal while one local write is pending', async () => {
		const storage = new DeferredSiteItemStorage();
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
				.editor=${ createEditor( storage ) }
				.enrollmentService=${ createEnrollmentService( storage ) }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;
		const confirmButton = getRequiredElement( element, '.confirm-remove-action', HTMLButtonElement );
		confirmButton.click();
		confirmButton.click();
		await settleAsyncAction( element );

		assert.equal( storage.saveCalls, 1 );
		assert.equal( getRequiredElement( element, '.confirm-remove-action' ).textContent.trim(), 'Saving...' );

		storage.completeSave();
		await settleAsyncAction( element );
		assert.equal( storage.configuration.sites.length, 0 );
	} );

	it( 'reports a missing editor dependency from removal confirmation', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`
			<tocus-f-protected-site-item
			.copy=${ TestEnglishLocalizationBundle.protectedSiteItem }
				.site=${ SITE }
				.identity=${ IDENTITY }
			></tocus-f-protected-site-item>
		` );

		getRequiredElement( element, '.edit-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.remove-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.confirm-remove-action', HTMLButtonElement ).click();
		await settleAsyncAction( element );

		assert.include( getRequiredElement( element, '.operation-error' ).textContent, 'could not be saved' );
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentProtectedSiteItem>( html`<tocus-f-protected-site-item></tocus-f-protected-site-item>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
