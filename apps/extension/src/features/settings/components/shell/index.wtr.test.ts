import { assert, expect, fixture, html } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import { ComponentProtectedSitesScreen } from '../../../protected-sites/components/screen';
import { ComponentSettingsShell } from './index';
import { SettingsPlatform, type SettingsPlatform as SettingsPlatformValue } from './types';

const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { schemaVersion: 1, sites: [] };

/**
 * In-memory configuration storage used by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsShellStorage implements ProtectionConfigurationStorageService {
	/**
	 * Loads an empty protected-site configuration.
	 * @return Empty local configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument> {
		return Promise.resolve( EMPTY_CONFIGURATION );
	}

	/**
	 * Accepts a complete local configuration write.
	 * @return Promise resolved after the in-memory write.
	 * @since 0.1.0 Initial implementation.
	 */
	save(): Promise<void> {
		return Promise.resolve();
	}
}

/**
 * Creates one deterministic independent protection scope for shell fixtures.
 * @return Stable independent scope identifier.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_settings_shell';
}

/**
 * Runs one shell-test mutation immediately inside the current browser context.
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
 * Returns the monogram fallback for shell fixtures.
 * @return Null cached-favicon source.
 * @since 0.1.0 Initial implementation.
 */
function getFaviconSource(): null {
	return null;
}

const EDITOR: ProtectionConfigurationEditor = createProtectionConfigurationEditor( {
	storage: new MemorySettingsShellStorage(),
	createIndependentScopeId,
	coordinateMutation: coordinateMutationDirectly,
} );
const FAVICON_PROVIDER: SiteFaviconProvider = { getSource: getFaviconSource };

/**
 * Renders one settings shell with complete screen dependencies.
 * @param platform - Browser family whose native conventions should be reflected.
 * @return Rendered settings shell.
 * @since 0.1.0 Initial implementation.
 */
async function renderShell(
	platform: SettingsPlatformValue = SettingsPlatform.CHROME,
): Promise<ComponentSettingsShell> {
	return fixture<ComponentSettingsShell>( html`
		<tocus-f-settings-shell
			.editor=${ EDITOR }
			.faviconProvider=${ FAVICON_PROVIDER }
			.platform=${ platform }
		></tocus-f-settings-shell>
	` );
}

describe( 'tocus-f-settings-shell', () => {
	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-settings-shell' ), ComponentSettingsShell );
	} );

	it( 'renders TOCus with exactly one active Protected sites destination', async () => {
		const element = await renderShell();
		const shadowRoot = element.shadowRoot;

		assert.notEqual( shadowRoot, null );
		if ( shadowRoot === null ) {
			throw new Error( 'Expected the settings shell to render a shadow root.' );
		}

		const brand = shadowRoot.querySelector( '.brand' );
		const destinations = shadowRoot.querySelectorAll<HTMLAnchorElement>( 'nav a' );
		const destination = destinations.item( 0 );

		assert.equal( brand?.getAttribute( 'aria-label' ), 'TOCus' );
		assert.equal( brand?.querySelector( 'svg' )?.getAttribute( 'fill' ), 'currentColor' );
		assert.equal( brand?.querySelector( '.wordmark' )?.textContent.trim(), 'TOCus' );
		assert.equal( destinations.length, 1 );
		assert.instanceOf( destination, HTMLAnchorElement );
		if ( ! ( destination instanceof HTMLAnchorElement ) ) {
			throw new Error( 'Expected one active settings destination.' );
		}

		assert.equal( destination.textContent.trim(), 'Protected sites' );
		assert.equal( destination.getAttribute( 'href' ), '#protected-sites' );
		assert.equal( destination.getAttribute( 'aria-current' ), 'page' );
	} );

	it( 'forwards local configuration dependencies to the Protected sites screen', async () => {
		const element = await renderShell( SettingsPlatform.FIREFOX );
		const screen = element.shadowRoot?.querySelector( 'tocus-f-protected-sites-screen' );

		assert.instanceOf( screen, ComponentProtectedSitesScreen );
		if ( ! ( screen instanceof ComponentProtectedSitesScreen ) ) {
			throw new Error( 'Expected the Protected sites screen to render.' );
		}

		assert.equal( screen.editor, EDITOR );
		assert.equal( screen.faviconProvider, FAVICON_PROVIDER );
		assert.equal( element.getAttribute( 'platform' ), SettingsPlatform.FIREFOX );
	} );

	it( 'uses a sidebar at wide options-page widths', async () => {
		await setViewport( { height: 700, width: 1_000 } );
		const element = await renderShell();
		const shadowRoot = element.shadowRoot;

		assert.notEqual( shadowRoot, null );
		if ( shadowRoot === null ) {
			throw new Error( 'Expected the settings shell to render a shadow root.' );
		}

		const layout = shadowRoot.querySelector<HTMLElement>( '.settings-layout' );
		const navigation = shadowRoot.querySelector<HTMLElement>( '.navigation' );

		assert.notEqual( layout, null );
		assert.notEqual( navigation, null );
		if ( layout === null || navigation === null ) {
			throw new Error( 'Expected the complete settings layout to render.' );
		}

		assert.equal( getComputedStyle( layout ).gridTemplateColumns.split( ' ' ).length, 2 );
		assert.equal( getComputedStyle( navigation ).borderRightWidth, '1px' );
		assert.equal( getComputedStyle( navigation ).borderBottomWidth, '0px' );
	} );

	it( 'moves navigation above the screen at narrow options-page widths', async () => {
		await setViewport( { height: 700, width: 640 } );
		const element = await renderShell( SettingsPlatform.SAFARI );
		const shadowRoot = element.shadowRoot;

		assert.notEqual( shadowRoot, null );
		if ( shadowRoot === null ) {
			throw new Error( 'Expected the settings shell to render a shadow root.' );
		}

		const layout = shadowRoot.querySelector<HTMLElement>( '.settings-layout' );
		const navigation = shadowRoot.querySelector<HTMLElement>( '.navigation' );

		assert.notEqual( layout, null );
		assert.notEqual( navigation, null );
		if ( layout === null || navigation === null ) {
			throw new Error( 'Expected the complete settings layout to render.' );
		}

		assert.equal( getComputedStyle( layout ).gridTemplateColumns.split( ' ' ).length, 1 );
		assert.equal( getComputedStyle( navigation ).borderRightWidth, '0px' );
		assert.equal( getComputedStyle( navigation ).borderBottomWidth, '1px' );
	} );

	it( 'has no automatically detectable accessibility violations', async () => {
		await setViewport( { height: 700, width: 1_000 } );
		const element = await renderShell();

		await expect( element ).to.be.accessible();
	} );
} );
