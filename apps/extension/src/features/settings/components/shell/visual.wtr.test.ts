import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../../../domains/protection/types/protection-value';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import { ComponentProtectedSitesScreen } from '../../../protected-sites/components/screen';
import { ComponentProtectedSiteItem } from '../../../protected-sites/components/site-item';
import './index';
import { type ComponentSettingsShell } from './index';
import { SettingsPlatform } from './types';

const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { schemaVersion: 1, sites: [] };
const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	schemaVersion: 1,
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
				scopeId: ProtectionScopeIdSchema.parse( 'scope_visual_chatgpt' ),
			},
		},
	],
};
const SETTINGS_VISUAL_STATES = [
	'empty',
	'populated',
	'editing',
	'removal-confirmation',
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
} );
