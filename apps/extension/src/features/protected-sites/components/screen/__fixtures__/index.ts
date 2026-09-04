import { assert, fixture, html } from '@open-wc/testing';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../../domains/protection/services/protection-configuration-storage';
import {
	TestEmptyProtectionConfiguration,
	createTestProtectionMeasurementRevision,
} from '../../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../../../../domains/protection/types/protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../../services/site-favicon-provider';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../../services/site-permission-manager';
import { ComponentProtectedSiteList } from '../../site-list';
import '../index';
import { type ComponentProtectedSitesScreen } from '../index';

/**
 * Empty protection configuration shared by screen component fixtures.
 * @since 0.1.0 Initial implementation.
 */
export const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
};

/**
 * Shared YouTube site rendered by screen component fixtures.
 * @since 0.1.0 Initial implementation.
 */
export const YOUTUBE_SITE: ProtectedSiteConfiguration = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};

/**
 * Independent X site rendered by screen component fixtures.
 * @since 0.1.0 Initial implementation.
 */
export const X_SITE: ProtectedSiteConfiguration = {
	identityHost: 'x.com',
	rule: {
		host: 'x.com',
		includeSubdomains: true,
		scopeId: ProtectionScopeIdSchema.parse( 'scope_x' ),
	},
};

/**
 * Configuration containing one shared and one independent site.
 * @since 0.1.0 Initial implementation.
 */
export const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ YOUTUBE_SITE, X_SITE ],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ X_SITE.rule.scopeId ]: DefaultProtectionSchedule,
	},
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		[ X_SITE.rule.scopeId ]: ProtectionMeasurementRevisionSchema.parse( 'revision_x' ),
	},
};

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
export interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Optional dependencies supplied to one connected screen fixture.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesScreenFixtureOptions {
	storage: ProtectionConfigurationStorageService;
	faviconProvider?: SiteFaviconProvider | null;
	permissionManager?: SitePermissionManager | null;
}

/**
 * Controllable in-memory storage shared by screen component fixtures.
 * @since 0.1.0 Initial implementation.
 */
export interface MemoryProtectedSitesScreenStorage extends ProtectionConfigurationStorageService {
	/**
	 * Current local configuration or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	configuration: ProtectionConfigurationDocument | null;

	/**
	 * Whether the next and later reads reject.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectLoads: boolean;

	/**
	 * Whether the next and later writes reject.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectSaves: boolean;

	/**
	 * Number of successful writes completed by this fixture.
	 * @since 0.1.0 Initial implementation.
	 */
	writes: number;
}

/**
 * Implements controllable in-memory storage for screen component fixtures.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectedSitesScreenStorageFixture implements MemoryProtectedSitesScreenStorage {
	/**
	 * Whether the next and later reads reject.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectLoads = false;

	/**
	 * Whether the next and later writes reject.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectSaves = false;

	/**
	 * Number of successful writes completed by this fixture.
	 * @since 0.1.0 Initial implementation.
	 */
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
		this.configuration = ProtectionConfigurationDocumentSchema.parse( input );

		return Promise.resolve();
	}
}

/**
 * Creates controllable in-memory storage for one screen fixture.
 * @param configuration - Configuration returned by the next load.
 * @return Controllable in-memory storage.
 * @since 0.1.0 Initial implementation.
 */
export function createMemoryProtectedSitesScreenStorage(
	configuration: ProtectionConfigurationDocument | null,
): MemoryProtectedSitesScreenStorage {
	return new MemoryProtectedSitesScreenStorageFixture( configuration );
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
 * Creates one deterministic independent scope for screen fixtures.
 * @return Stable independent protection scope.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_independent_a';
}

/**
 * Grants one configured site in component fixtures.
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
 * Releases one configured site in component fixtures.
 * @return Successful permission-release result.
 * @since 0.1.0 Initial implementation.
 */
function releaseSitePermission(): ReturnType<SitePermissionManager[ 'release' ]> {
	return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
}

/**
 * Returns the supplied configuration unchanged in screen fixtures.
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
 * Reports complete browser access in default screen fixtures.
 * @return True for the default granted-access fixture.
 * @since 0.1.0 Initial implementation.
 */
function hasSiteAccess(): Promise<boolean> {
	return Promise.resolve( true );
}

/**
 * Creates a permission manager that grants configured test sites.
 * @return Controllable permission manager test double.
 * @since 0.1.0 Initial implementation.
 */
export function createPermissionManager(): SitePermissionManager {
	return {
		filterConfiguration: filterPermissionConfiguration,
		hasAccess: hasSiteAccess,
		request: requestSitePermission,
		release: releaseSitePermission,
	};
}

/**
 * Creates one connected Protected Sites screen with supplied boundary dependencies.
 * @param options - Storage and optional browser or statistics dependencies.
 * @return Connected screen fixture.
 * @since 0.1.0 Initial implementation.
 */
export async function createProtectedSitesScreenFixture(
	options: ProtectedSitesScreenFixtureOptions,
): Promise<ComponentProtectedSitesScreen> {
	const {
		storage,
		faviconProvider = null,
		permissionManager = createPermissionManager(),
	} = options;
	const editor = createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		createMeasurementRevision: createTestProtectionMeasurementRevision,
		coordinateMutation: coordinateMutationDirectly,
	} );
	const element = await fixture<ComponentProtectedSitesScreen>( html`
		<tocus-f-protected-sites-screen
			.editor=${ editor }
			.faviconProvider=${ faviconProvider }
			.permissionManager=${ permissionManager }
		></tocus-f-protected-sites-screen>
	` );
	await settleScreen( element );

	return element;
}

/**
 * Returns one required element from the Protected Sites shadow tree.
 * @param element - Rendered Protected Sites screen.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
export function getRequiredElement<T extends Element>(
	element: ComponentProtectedSitesScreen,
	selector: string,
	expectedType: ElementConstructor<T>,
): T {
	const siteList = element.shadowRoot?.querySelector<ComponentProtectedSiteList>(
		'tocus-f-protected-site-list',
	);
	const match = element.shadowRoot?.querySelector( selector ) ??
		siteList?.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the Protected Sites screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Returns the required grouped-list shadow root from one ready screen.
 * @param element - Rendered Protected Sites screen.
 * @return Grouped-list shadow root.
 * @since 0.1.0 Initial implementation.
 */
export function getSiteListRoot( element: ComponentProtectedSitesScreen ): ShadowRoot {
	const siteList = element.shadowRoot?.querySelector( 'tocus-f-protected-site-list' );

	assert.instanceOf( siteList, ComponentProtectedSiteList );
	if ( ! ( siteList instanceof ComponentProtectedSiteList ) || siteList.shadowRoot === null ) {
		throw new TypeError( 'Expected the Protected Sites screen to render its grouped list.' );
	}

	return siteList.shadowRoot;
}

/**
 * Waits for queued loading and Lit rendering.
 * @param element - Protected Sites screen expected to update.
 * @return Promise resolved after the next task and component update.
 * @since 0.1.0 Initial implementation.
 */
export async function settleScreen( element: ComponentProtectedSitesScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}
