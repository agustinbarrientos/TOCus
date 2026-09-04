import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	TestEmptyProtectionConfiguration,
	createTestProtectionMeasurementRevision,
} from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import {
	DefaultPreferencesDocument,
	Language,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../../protected-sites/services/site-permission-manager';
import { ComponentProtectedSitesScreen } from '../../../protected-sites/components/screen';
import { ComponentStatisticsSettingsScreen } from '../../../statistics/components/settings-screen';
import { ComponentAppearanceScreen } from '../appearance-screen';
import {
	type AppearancePreferencesChangeListener,
	type PreferencesPreview,
	type PreferencesSource,
} from '../appearance-screen/types';
import { ComponentLanguageScreen } from '../language-screen';
import { ComponentScheduleScreen } from '../schedule-screen';
import { ComponentTimingScreen } from '../timing-screen';
import { ComponentSettingsShell } from './index';
import { SettingsPlatform, type SettingsPlatform as SettingsPlatformValue } from './types';

/**
 * Empty protection configuration rendered by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
const EMPTY_CONFIGURATION: ProtectionConfigurationDocument = { ...TestEmptyProtectionConfiguration };

/**
 * In-memory preferences storage used by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsPreferencesEditor implements PreferencesEditor {
	/**
	 * Loads safe default preferences.
	 * @return Default local preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument> {
		return Promise.resolve( { ...DefaultPreferencesDocument } );
	}

	/**
	 * Returns default preferences for an unused fixture update.
	 * @return Default local preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	update(): Promise<PreferencesDocument> {
		return Promise.resolve( { ...DefaultPreferencesDocument } );
	}

	/**
	 * Returns default preferences for an unused fixture recovery action.
	 * @return Default local preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		return Promise.resolve( { ...DefaultPreferencesDocument } );
	}
}

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

/**
 * Configuration editor shared by settings-shell tests.
 * @since 0.1.0 Initial implementation.
 */
const EDITOR: ProtectionConfigurationEditor = createProtectionConfigurationEditor( {
	storage: new MemorySettingsShellStorage(),
	createIndependentScopeId,
	createMeasurementRevision: createTestProtectionMeasurementRevision,
	coordinateMutation: coordinateMutationDirectly,
} );

/**
 * Cached-favicon provider used by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
const FAVICON_PROVIDER: SiteFaviconProvider = { getSource: getFaviconSource };

/**
 * In-memory preferences editor used by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
const PREFERENCES_EDITOR = new MemorySettingsPreferencesEditor();

/**
 * Accepts one preferences preview in settings-shell fixtures.
 * @return Undefined fixture result.
 * @since 0.1.0 Initial implementation.
 */
function applyPreferencesPreview(): undefined {
	return undefined;
}

/**
 * Live preferences preview used by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
const PREFERENCES_PREVIEW: PreferencesPreview = { apply: applyPreferencesPreview };

/**
 * Accepts an unused settings-shell preference listener.
 * @param listener - Unused complete preferences listener.
 * @since 0.1.0 Initial implementation.
 */
function addPreferencesChangeListener( listener: AppearancePreferencesChangeListener ): void {
	void listener;
}

/**
 * Releases an unused settings-shell preference listener.
 * @param listener - Unused complete preferences listener.
 * @since 0.1.0 Initial implementation.
 */
function removePreferencesChangeListener( listener: AppearancePreferencesChangeListener ): void {
	void listener;
}

/**
 * Preferences listener source used by settings-shell fixtures.
 * @since 0.1.0 Initial implementation.
 */
const PREFERENCES_SOURCE: PreferencesSource = {
	addPreferencesChangeListener,
	removePreferencesChangeListener,
};

/**
 * Grants a site permission in settings-shell fixtures.
 * @return Existing permission grant.
 * @since 0.1.0 Initial implementation.
 */
function requestSitePermission(): ReturnType<SitePermissionManager[ 'request' ]> {
	return Promise.resolve( {
		status: SitePermissionRequestStatus.GRANTED,
		provenance: SitePermissionGrantProvenance.EXISTING,
	} );
}

/**
 * Releases a site permission in settings-shell fixtures.
 * @return Successful release result.
 * @since 0.1.0 Initial implementation.
 */
function releaseSitePermission(): ReturnType<SitePermissionManager[ 'release' ]> {
	return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
}

/**
 * Returns the supplied configuration unchanged in settings-shell fixtures.
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
 * Reports complete browser access in default settings-shell fixtures.
 * @return True for the default granted-access fixture.
 * @since 0.1.0 Initial implementation.
 */
function hasSiteAccess(): Promise<boolean> {
	return Promise.resolve( true );
}

/**
 * Permission manager used by settings-shell behavior fixtures.
 * @since 0.1.0 Initial implementation.
 */
const PERMISSION_MANAGER: SitePermissionManager = {
	filterConfiguration: filterPermissionConfiguration,
	hasAccess: hasSiteAccess,
	request: requestSitePermission,
	release: releaseSitePermission,
};

/**
 * Renders one settings shell with complete screen dependencies.
 * @param platform - Browser family whose native conventions should be reflected.
 * @return Rendered settings shell.
 * @since 0.1.0 Initial implementation.
 */
async function renderShell(
	platform: SettingsPlatformValue = SettingsPlatform.CHROME,
): Promise<ComponentSettingsShell> {
	window.history.replaceState( null, '', window.location.pathname );

	return fixture<ComponentSettingsShell>( html`
		<tocus-f-settings-shell
			.copy=${ TestEnglishLocalizationBundle.settingsShell }
			.appearanceCopy=${ TestEnglishLocalizationBundle.appearance }
			.languageCopy=${ TestEnglishLocalizationBundle.languageScreen }
			.protectedSitesCopy=${ TestEnglishLocalizationBundle.protectedSites }
			.protectedSiteItemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
			.scheduleCopy=${ TestEnglishLocalizationBundle.schedule }
			.statisticsCopy=${ TestEnglishLocalizationBundle.statistics }
			.timingCopy=${ TestEnglishLocalizationBundle.timing }
			.editor=${ EDITOR }
			.faviconProvider=${ FAVICON_PROVIDER }
			.permissionManager=${ PERMISSION_MANAGER }
			.preferencesEditor=${ PREFERENCES_EDITOR }
			.preferencesPreview=${ PREFERENCES_PREVIEW }
			.preferencesSource=${ PREFERENCES_SOURCE }
			.platform=${ platform }
		></tocus-f-settings-shell>
	` );
}

/**
 * Waits for hash navigation and Lit rendering.
 * @param element - Settings shell expected to update.
 * @return Promise resolved after the next task and component update.
 * @since 0.1.0 Initial implementation.
 */
async function settleShell( element: ComponentSettingsShell ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

describe( 'tocus-f-settings-shell', () => {
	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-settings-shell' ), ComponentSettingsShell );
	} );

	it( 'renders TOCus with every implemented settings destination', async () => {
		const element = await renderShell();
		const shadowRoot = element.shadowRoot;

		assert.notEqual( shadowRoot, null );
		if ( shadowRoot === null ) {
			throw new Error( 'Expected the settings shell to render a shadow root.' );
		}

		const brand = shadowRoot.querySelector( '.brand' );
		const destinations = shadowRoot.querySelectorAll<HTMLAnchorElement>( 'nav a' );

		assert.equal( brand?.getAttribute( 'aria-label' ), 'TOCus' );
		assert.equal( brand?.querySelector( 'svg' )?.getAttribute( 'fill' ), 'currentColor' );
		assert.equal( brand?.querySelector( '.wordmark' )?.textContent.trim(), 'TOCus' );
		assert.deepEqual(
			Array.from( destinations ).map( ( destination ) => ( {
				label: destination.textContent.trim(),
				href: destination.getAttribute( 'href' ),
				current: destination.getAttribute( 'aria-current' ),
			} ) ),
			[
				{ label: 'Protected sites', href: '#protected-sites', current: 'page' },
				{ label: 'Schedule', href: '#schedule', current: null },
				{ label: 'Timing', href: '#timing', current: null },
				{ label: 'Appearance', href: '#appearance', current: null },
				{ label: 'Language', href: '#language', current: null },
				{ label: 'Statistics', href: '#statistics', current: null },
			],
		);
	} );

	it( 'renders navigation through a complete localizable copy contract', async () => {
		const element = await renderShell();
		element.copy = {
			navigationLabel: 'Localized settings',
			protectedSites: 'Localized protected sites',
			schedule: 'Localized schedule',
			timing: 'Localized timing',
			appearance: 'Localized appearance',
			language: 'Localized language',
			statistics: 'Localized statistics',
		};
		await element.updateComplete;
		const navigation = element.shadowRoot?.querySelector( 'nav' );

		assert.equal( navigation?.getAttribute( 'aria-label' ), 'Localized settings' );
		assert.deepEqual(
			Array.from( navigation?.querySelectorAll( 'a' ) ?? [] ).map( ( destination ) =>
				destination.textContent.trim(),
			),
			[
				'Localized protected sites',
				'Localized schedule',
				'Localized timing',
				'Localized appearance',
				'Localized language',
				'Localized statistics',
			],
		);
	} );

	it( 'forwards local configuration dependencies to the Protected sites screen', async () => {
		const element = await renderShell( SettingsPlatform.FIREFOX );
		const protectedSitesCopy = { ...TestEnglishLocalizationBundle.protectedSites, title: 'Localized sites' };
		const protectedSiteItemCopy = { ...TestEnglishLocalizationBundle.protectedSiteItem, edit: 'Localized edit' };

		element.protectedSitesCopy = protectedSitesCopy;
		element.protectedSiteItemCopy = protectedSiteItemCopy;
		await element.updateComplete;
		const screen = element.shadowRoot?.querySelector( 'tocus-f-protected-sites-screen' );

		assert.instanceOf( screen, ComponentProtectedSitesScreen );
		if ( ! ( screen instanceof ComponentProtectedSitesScreen ) ) {
			throw new Error( 'Expected the Protected sites screen to render.' );
		}

		assert.equal( screen.editor, EDITOR );
		assert.equal( screen.faviconProvider, FAVICON_PROVIDER );
		assert.equal( screen.permissionManager, PERMISSION_MANAGER );
		assert.equal( screen.copy, protectedSitesCopy );
		assert.equal( screen.siteItemCopy, protectedSiteItemCopy );
		assert.equal( element.getAttribute( 'platform' ), SettingsPlatform.FIREFOX );
	} );

	it( 'navigates between Schedule, Timing, Appearance, and Language with their dependencies', async () => {
		const element = await renderShell();
		const scheduleCopy = { ...TestEnglishLocalizationBundle.schedule, title: 'Localized schedule' };
		const timingCopy = { ...TestEnglishLocalizationBundle.timing, title: 'Localized timing' };
		const appearanceCopy = { ...TestEnglishLocalizationBundle.appearance, title: 'Localized appearance' };
		const languageCopy = { ...TestEnglishLocalizationBundle.languageScreen, title: 'Localized language' };

		element.scheduleCopy = scheduleCopy;
		element.timingCopy = timingCopy;
		element.appearanceCopy = appearanceCopy;
		element.languageCopy = languageCopy;
		await element.updateComplete;
		const destinations = element.shadowRoot?.querySelectorAll<HTMLAnchorElement>( 'nav a' );
		assert.equal( destinations?.length, 6 );

		destinations?.item( 1 ).click();
		await settleShell( element );
		const scheduleScreen = element.shadowRoot?.querySelector( 'tocus-f-schedule-screen' );
		assert.instanceOf( scheduleScreen, ComponentScheduleScreen );
		if ( ! ( scheduleScreen instanceof ComponentScheduleScreen ) ) {
			throw new Error( 'Expected the Schedule screen to render.' );
		}
		assert.equal( scheduleScreen.editor, EDITOR );
		assert.equal( scheduleScreen.copy, scheduleCopy );
		assert.equal( destinations?.item( 1 ).getAttribute( 'aria-current' ), 'page' );

		destinations?.item( 2 ).click();
		await settleShell( element );
		const timingScreen = element.shadowRoot?.querySelector( 'tocus-f-timing-screen' );
		assert.instanceOf( timingScreen, ComponentTimingScreen );
		if ( ! ( timingScreen instanceof ComponentTimingScreen ) ) {
			throw new Error( 'Expected the Timing screen to render.' );
		}
		assert.equal( timingScreen.editor, EDITOR );
		assert.equal( timingScreen.copy, timingCopy );
		assert.equal( destinations?.item( 2 ).getAttribute( 'aria-current' ), 'page' );

		destinations?.item( 3 ).click();
		await settleShell( element );
		const appearanceScreen = element.shadowRoot?.querySelector( 'tocus-f-appearance-screen' );
		assert.instanceOf( appearanceScreen, ComponentAppearanceScreen );
		if ( ! ( appearanceScreen instanceof ComponentAppearanceScreen ) ) {
			throw new Error( 'Expected the Appearance screen to render.' );
		}
		assert.equal( appearanceScreen.editor, PREFERENCES_EDITOR );
		assert.equal( appearanceScreen.preview, PREFERENCES_PREVIEW );
		assert.equal( appearanceScreen.source, PREFERENCES_SOURCE );
		assert.equal( appearanceScreen.copy, appearanceCopy );
		assert.equal( destinations?.item( 3 ).getAttribute( 'aria-current' ), 'page' );

		destinations?.item( 4 ).click();
		await settleShell( element );
		const languageScreen = element.shadowRoot?.querySelector( 'tocus-f-language-screen' );
		assert.instanceOf( languageScreen, ComponentLanguageScreen );
		if ( ! ( languageScreen instanceof ComponentLanguageScreen ) ) {
			throw new Error( 'Expected the Language screen to render.' );
		}
		assert.equal( languageScreen.editor, PREFERENCES_EDITOR );
		assert.equal( languageScreen.preview, PREFERENCES_PREVIEW );
		assert.equal( languageScreen.source, PREFERENCES_SOURCE );
		assert.equal( languageScreen.browserLanguage, Language.ENGLISH );
		assert.equal( languageScreen.copy, languageCopy );
		assert.equal( destinations?.item( 4 ).getAttribute( 'aria-current' ), 'page' );
	} );

	it( 'opens Statistics directly and forwards its source', async () => {
		const projection = {
			status: 'available' as const,
			estimatedReclaimedMilliseconds: 3_600_000,
			focusedPauseMilliseconds: 900_000,
			reconsideredVisitCount: 4,
			completedWaitCount: 7,
			allowanceGrantedCount: 3,
		};
		const statisticsSource = {
			/**
			 * Accepts one statistics-change listener in the shell fixture.
			 * @param listener - Unused fixture listener.
			 * @since 0.1.0 Initial implementation.
			 */
			addStatisticsChangeListener( listener: () => void ): void {
				void listener;
			},
			/**
			 * Reads the Statistics projection forwarded by the shell fixture.
			 * @return Available fixture projection.
			 * @since 0.1.0 Initial implementation.
			 */
			readStatistics(): Promise<typeof projection> {
				return Promise.resolve( projection );
			},
			/**
			 * Returns the authoritative projection after the shell fixture reset.
			 * @return Available fixture projection.
			 * @since 0.1.0 Initial implementation.
			 */
			resetStatistics(): Promise<typeof projection> {
				return Promise.resolve( projection );
			},
			/**
			 * Removes one statistics-change listener from the shell fixture.
			 * @param listener - Unused fixture listener.
			 * @since 0.1.0 Initial implementation.
			 */
			removeStatisticsChangeListener( listener: () => void ): void {
				void listener;
			},
		};
		const statisticsCopy = { ...TestEnglishLocalizationBundle.statistics, title: 'Localized statistics' };
		window.history.replaceState( null, '', `${ window.location.pathname }#statistics` );
		const element = await fixture<ComponentSettingsShell>( html`
			<tocus-f-settings-shell
			.copy=${ TestEnglishLocalizationBundle.settingsShell }
			.appearanceCopy=${ TestEnglishLocalizationBundle.appearance }
			.languageCopy=${ TestEnglishLocalizationBundle.languageScreen }
			.protectedSitesCopy=${ TestEnglishLocalizationBundle.protectedSites }
			.protectedSiteItemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
			.scheduleCopy=${ TestEnglishLocalizationBundle.schedule }
			.statisticsCopy=${ TestEnglishLocalizationBundle.statistics }
			.timingCopy=${ TestEnglishLocalizationBundle.timing }></tocus-f-settings-shell>
		` );

		( element as ComponentSettingsShell & { statisticsSource: typeof statisticsSource } ).statisticsSource =
			statisticsSource;
		element.statisticsCopy = statisticsCopy;
		await element.updateComplete;

		const screen = element.shadowRoot?.querySelector(
			'tocus-f-statistics-settings-screen',
		);
		assert.instanceOf( screen, ComponentStatisticsSettingsScreen );
		if ( ! ( screen instanceof ComponentStatisticsSettingsScreen ) ) {
			throw new TypeError( 'Expected the Statistics settings screen to render.' );
		}
		assert.equal( screen.source, statisticsSource );
		assert.equal( screen.copy, statisticsCopy );
		assert.equal(
			element.shadowRoot?.querySelector( 'a[href="#statistics"]' )?.getAttribute( 'aria-current' ),
			'page',
		);
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

	it( 'contains all six destinations in a reachable narrow navigation scroller', async () => {
		await setViewport( { height: 700, width: 420 } );

		try {
			const element = await renderShell( SettingsPlatform.SAFARI );
			const layout = element.shadowRoot?.querySelector<HTMLElement>( '.settings-layout' );
			const navigation = element.shadowRoot?.querySelector<HTMLElement>( 'nav' );
			const statistics = element.shadowRoot?.querySelector<HTMLAnchorElement>( 'a[href="#statistics"]' );

			assert.instanceOf( layout, HTMLElement );
			assert.instanceOf( navigation, HTMLElement );
			assert.instanceOf( statistics, HTMLAnchorElement );
			if (
				! ( layout instanceof HTMLElement ) ||
				! ( navigation instanceof HTMLElement ) ||
				! ( statistics instanceof HTMLAnchorElement )
			) {
				throw new TypeError( 'Expected the complete narrow Statistics navigation.' );
			}

			assert.isAtMost( layout.scrollWidth, layout.clientWidth );
			assert.isAbove( navigation.scrollWidth, navigation.clientWidth );
			navigation.scrollLeft = navigation.scrollWidth;
			statistics.focus();
			assert.equal( element.shadowRoot?.activeElement, statistics );
		} finally {
			await setViewport( { height: 600, width: 800 } );
		}
	} );

	it( 'has no automatically detectable accessibility violations', async () => {
		await setViewport( { height: 700, width: 1_000 } );
		const element = await renderShell();

		await expect( element ).to.be.accessible();
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentSettingsShell>( html`<tocus-f-settings-shell></tocus-f-settings-shell>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
