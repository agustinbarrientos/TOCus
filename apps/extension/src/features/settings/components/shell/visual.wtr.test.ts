import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	DefaultProtectionSchedule,
	ScheduleMode,
	Weekday,
} from '../../../../domains/protection/types/protection-schedule';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../../protected-sites/services/site-permission-manager';
import { ComponentProtectedSitesScreen } from '../../../protected-sites/components/screen';
import { ComponentProtectedSiteItem } from '../../../protected-sites/components/site-item';
import { ComponentScheduleScreen } from '../schedule-screen';
import { ComponentTimingScreen } from '../timing-screen';
import './index';
import { type ComponentSettingsShell } from './index';
import {
	SettingsDestination,
	SettingsPlatform,
	type SettingsDestination as SettingsDestinationValue,
} from './types';

const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };
const VISUAL_CHATGPT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_visual_chatgpt' );
const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [
		{
			identityHost: 'instagram.com',
			displayNameOverride: 'Instagram',
			rule: {
				host: 'instagram.com',
				includeSubdomains: true,
				scopeId: DefaultProtectionScopeId,
			},
		},
		{
			identityHost: 'chatgpt.com',
			displayNameOverride: 'ChatGPT',
			rule: {
				host: 'chatgpt.com',
				includeSubdomains: true,
				scopeId: VISUAL_CHATGPT_SCOPE_ID,
			},
		},
	],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ VISUAL_CHATGPT_SCOPE_ID ]: DefaultProtectionSchedule,
	},
};
const SCHEDULE_CONFIGURATION: ProtectionConfigurationDocument = {
	...POPULATED_CONFIGURATION,
	schedulesByScope: {
		...POPULATED_CONFIGURATION.schedulesByScope,
		[ DefaultProtectionScopeId ]: {
			mode: ScheduleMode.CUSTOM,
			windows: [
				{
					weekday: Weekday.MONDAY,
					startMinute: 540,
					endMinute: 1_020,
				},
				{
					weekday: Weekday.FRIDAY,
					startMinute: 1_080,
					endMinute: 1_320,
				},
			],
		},
	},
};
const SETTINGS_VISUAL_STATES = [
	'empty',
	'populated',
	'editing',
	'removal-confirmation',
] as const;
const SETTINGS_VISUAL_DESTINATIONS = [
	SettingsDestination.SCHEDULE,
	SettingsDestination.TIMING,
] as const;
const SETTINGS_VISUAL_THEMES = [ 'light', 'dark' ] as const;
const ORIGINAL_BODY_MARGIN = document.body.style.margin;

/**
 * Protected Sites state rendered by one settings screenshot.
 * @since 0.1.0 Initial implementation.
 */
type SettingsVisualState = typeof SETTINGS_VISUAL_STATES[ number ];

/**
 * Explicit appearance rendered by one settings screenshot.
 * @since 0.1.0 Initial implementation.
 */
type SettingsVisualTheme = typeof SETTINGS_VISUAL_THEMES[ number ];

/**
 * In-memory configuration storage used by deterministic visual fixtures.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsVisualStorage implements ProtectionConfigurationStorageService {
	/**
	 * Creates storage with one complete local configuration.
	 * @param configuration - Configuration returned by the first load.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private configuration: ProtectionConfigurationDocument ) {}

	/**
	 * Loads the current in-memory configuration.
	 * @return Current protected-site configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores one validated configuration for subsequent visual-fixture reads.
	 * @param input - Complete protected-site configuration candidate.
	 * @return Promise resolved after the in-memory write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		this.configuration = ProtectionConfigurationDocumentSchema.parse( input );

		return Promise.resolve();
	}
}

/**
 * Creates one deterministic independent scope for visual fixtures.
 * @return Stable independent protection scope identifier.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_visual_independent';
}

/**
 * Runs one visual-fixture mutation immediately inside the current browser context.
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
 * Returns the deterministic monogram fallback for every visual site.
 * @return Null cached-favicon source.
 * @since 0.1.0 Initial implementation.
 */
function getFaviconSource(): null {
	return null;
}

const FAVICON_PROVIDER: SiteFaviconProvider = { getSource: getFaviconSource };

/**
 * Grants one configured site in visual fixtures.
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
 * Releases one configured site in visual fixtures.
 * @return Successful permission-release result.
 * @since 0.1.0 Initial implementation.
 */
function releaseSitePermission(): ReturnType<SitePermissionManager[ 'release' ]> {
	return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
}

/**
 * Returns the supplied configuration unchanged in visual settings fixtures.
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
 * Reports complete browser access in default visual settings fixtures.
 * @return True for the default granted-access fixture.
 * @since 0.1.0 Initial implementation.
 */
function hasSiteAccess(): Promise<boolean> {
	return Promise.resolve( true );
}

/** Permission manager used by settings-shell visual fixtures. */
const PERMISSION_MANAGER: SitePermissionManager = {
	filterConfiguration: filterPermissionConfiguration,
	hasAccess: hasSiteAccess,
	request: requestSitePermission,
	release: releaseSitePermission,
};

/**
 * Waits for the Protected Sites screen to finish its asynchronous initial read.
 * @param shell - Connected settings shell.
 * @return Ready Protected Sites screen.
 * @since 0.1.0 Initial implementation.
 */
async function settleProtectedSitesScreen(
	shell: ComponentSettingsShell,
): Promise<ComponentProtectedSitesScreen> {
	const screen = shell.shadowRoot?.querySelector( 'tocus-f-protected-sites-screen' );

	assert.instanceOf( screen, ComponentProtectedSitesScreen );
	if ( ! ( screen instanceof ComponentProtectedSitesScreen ) ) {
		throw new TypeError( 'Expected the visual settings shell to render Protected Sites.' );
	}

	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await screen.updateComplete;

	return screen;
}

/**
 * Returns the deterministic Instagram item rendered by a populated fixture.
 * @param screen - Ready populated Protected Sites screen.
 * @return Instagram site item.
 * @since 0.1.0 Initial implementation.
 */
function getInstagramItem( screen: ComponentProtectedSitesScreen ): ComponentProtectedSiteItem {
	const item = Array.from(
		screen.shadowRoot?.querySelectorAll<ComponentProtectedSiteItem>( 'tocus-f-protected-site-item' ) ?? [],
	).find( ( candidate ) => candidate.site?.identityHost === 'instagram.com' );

	assert.instanceOf( item, ComponentProtectedSiteItem );
	if ( ! ( item instanceof ComponentProtectedSiteItem ) ) {
		throw new TypeError( 'Expected the populated visual fixture to render Instagram.' );
	}

	return item;
}

/**
 * Clicks one required site-item action and waits for focus-driven rendering to settle.
 * @param item - Site item containing the required action.
 * @param selector - Required button selector.
 * @return Promise resolved after the item and focus microtask settle.
 * @since 0.1.0 Initial implementation.
 */
async function clickSiteItemAction(
	item: ComponentProtectedSiteItem,
	selector: string,
): Promise<void> {
	const action = item.shadowRoot?.querySelector( selector );

	assert.instanceOf( action, HTMLButtonElement );
	if ( ! ( action instanceof HTMLButtonElement ) ) {
		throw new TypeError( `Expected the visual site item to render ${ selector }.` );
	}

	action.click();
	await item.updateComplete;
	await Promise.resolve();
}

/**
 * Renders one complete settings state with real local editing dependencies.
 * @param state - Approved visual state to present.
 * @return Connected settings shell in the requested state.
 * @since 0.1.0 Initial implementation.
 */
async function renderSettingsState( state: SettingsVisualState ): Promise<ComponentSettingsShell> {
	window.history.replaceState( null, '', window.location.pathname );
	const configuration = state === 'empty' ? EMPTY_CONFIGURATION : POPULATED_CONFIGURATION;
	const storage = new MemorySettingsVisualStorage( configuration );
	const editor = createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		coordinateMutation: coordinateMutationDirectly,
	} );
	const shell = await fixture<ComponentSettingsShell>( html`
		<tocus-f-settings-shell
			.editor=${ editor }
			.faviconProvider=${ FAVICON_PROVIDER }
			.permissionManager=${ PERMISSION_MANAGER }
			.platform=${ SettingsPlatform.CHROME }
		></tocus-f-settings-shell>
	` );
	const screen = await settleProtectedSitesScreen( shell );

	if ( state === 'editing' || state === 'removal-confirmation' ) {
		const item = getInstagramItem( screen );

		await clickSiteItemAction( item, '.edit-action' );

		if ( state === 'removal-confirmation' ) {
			await clickSiteItemAction( item, '.remove-action' );
		}
	}

	return shell;
}

/**
 * Waits for one settings destination to finish its asynchronous initial read.
 * @param shell - Connected settings shell.
 * @param destination - Schedule or Timing destination expected to be active.
 * @return Promise resolved after the active screen is ready.
 * @since 0.1.0 Initial implementation.
 */
async function settleSettingsDestination(
	shell: ComponentSettingsShell,
	destination: SettingsDestinationValue,
): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );

	const screen = destination === SettingsDestination.SCHEDULE
		? shell.shadowRoot?.querySelector( 'tocus-f-schedule-screen' )
		: shell.shadowRoot?.querySelector( 'tocus-f-timing-screen' );

	assert.isTrue( screen instanceof ComponentScheduleScreen || screen instanceof ComponentTimingScreen );
	if ( ! ( screen instanceof ComponentScheduleScreen || screen instanceof ComponentTimingScreen ) ) {
		throw new TypeError( `Expected the visual settings shell to render ${ destination }.` );
	}

	await screen.updateComplete;
}

/**
 * Renders one Schedule or Timing destination with representative local settings.
 * @param destination - Settings destination to present.
 * @return Connected settings shell with its active screen ready.
 * @since 0.1.0 Initial implementation.
 */
async function renderSettingsDestination(
	destination: SettingsDestinationValue,
): Promise<ComponentSettingsShell> {
	window.history.replaceState( null, '', `${ window.location.pathname }#${ destination }` );
	const storage = new MemorySettingsVisualStorage(
		destination === SettingsDestination.SCHEDULE ? SCHEDULE_CONFIGURATION : POPULATED_CONFIGURATION,
	);
	const editor = createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		coordinateMutation: coordinateMutationDirectly,
	} );
	const shell = await fixture<ComponentSettingsShell>( html`
		<tocus-f-settings-shell
			.editor=${ editor }
			.faviconProvider=${ FAVICON_PROVIDER }
			.permissionManager=${ PERMISSION_MANAGER }
			.platform=${ SettingsPlatform.CHROME }
		></tocus-f-settings-shell>
	` );

	await settleSettingsDestination( shell, destination );

	return shell;
}

/**
 * Configures one deterministic explicit appearance for a visual case.
 * @param theme - Explicit light or dark appearance.
 * @return Promise resolved after the browser media emulation is applied.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance( theme: SettingsVisualTheme ): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	window.scrollTo( 0, 0 );
	await setViewport( { height: 1_200, width: 1_280 } );
	await emulateMedia( {
		colorScheme: theme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-settings-shell visual', () => {
	before( async () => {
		document.body.style.margin = '0';
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	after( () => {
		document.body.style.margin = ORIGINAL_BODY_MARGIN;
	} );

	afterEach( async () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
		window.history.replaceState( null, '', window.location.pathname );
		window.scrollTo( 0, 0 );
		await emulateMedia( {
			colorScheme: 'light',
			forcedColors: 'none',
			reducedMotion: 'no-preference',
		} );
	} );

	for ( const theme of SETTINGS_VISUAL_THEMES ) {
		for ( const state of SETTINGS_VISUAL_STATES ) {
			it( `matches the ${ state } state in the ${ theme } appearance`, async () => {
				await configureAppearance( theme );
				const shell = await renderSettingsState( state );

				assert.isTrue( shell.isConnected );
				await visualDiff( shell, `settings-protected-sites-${ state }-${ theme }` );
			} );
		}
	}

	for ( const theme of SETTINGS_VISUAL_THEMES ) {
		for ( const destination of SETTINGS_VISUAL_DESTINATIONS ) {
			it( `matches the ${ destination } screen in the ${ theme } appearance`, async () => {
				await configureAppearance( theme );
				const shell = await renderSettingsDestination( destination );

				assert.isTrue( shell.isConnected );
				await visualDiff( shell, `settings-${ destination }-${ theme }` );
			} );
		}
	}
} );
