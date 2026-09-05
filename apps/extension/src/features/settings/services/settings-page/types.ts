import {
	type BrowserPreferencesMutationLock,
} from '../../../../domains/preferences/services/browser-preferences-editor';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import { type PreferencesStorageArea } from '../../../../domains/preferences/services/preferences-storage';
import { type Language } from '../../../../domains/preferences/types';
import {
	type BrowserProtectionConfigurationMutationLock,
	type BrowserProtectionCryptography,
} from '../../../../domains/protection/services/browser-protection-configuration-editor';
import { type ProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageArea } from '../../../../domains/protection/services/protection-configuration-storage';
import { type LocalizationBundle } from '../../../../localization';
import {
	type PreferencesAppearanceTarget,
	type PreferencesStorageChangeSource,
	type PreferencesSystemMotionPreference,
} from '../../../preferences/services/preferences-controller';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import {
	type SitePermissionApi,
	type SitePermissionManager,
} from '../../../protected-sites/services/site-permission-manager';
import {
	type StatisticsClientRuntime,
	type StatisticsStorageChangeSource,
} from '../../../statistics/services/statistics-client';
import { type StatisticsSource } from '../../../statistics/components/settings-screen/types';
import {
	type AppearanceScreenCopy,
	type PreferencesPreview,
	type PreferencesSource,
} from '../../components/appearance-screen/types';
import { type LanguageScreenCopy } from '../../components/language-screen/types';
import { type ScheduleScreenCopy } from '../../components/schedule-screen/types';
import {
	type SettingsPlatform,
	type SettingsShellCopy,
} from '../../components/shell/types';
import { type TimingScreenCopy } from '../../components/timing-screen/types';
import { type ProtectedSiteItemCopy } from '../../../protected-sites/components/site-item/types';
import { type ProtectedSitesScreenCopy } from '../../../protected-sites/components/screen/types';
import { type StatisticsSettingsScreenCopy } from '../../../statistics/components/settings-screen/types';

/**
 * Browser permission change relevant to settings access refresh.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPermissionChange {
	/** Named browser permissions that changed. */
	permissions?: readonly string[];
	/** Host origins that changed. */
	origins?: readonly string[];
}

/**
 * Receives one browser permission change.
 * @since 0.1.0 Initial implementation.
 */
export type SettingsPermissionChangeListener = ( change: SettingsPermissionChange ) => void;

/**
 * Browser permission event that accepts settings listeners.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPermissionChangeEvent {
	/**
	 * Registers one permission-change listener.
	 * @param listener - Listener to register.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: SettingsPermissionChangeListener ): void;
	/**
	 * Removes one permission-change listener.
	 * @param listener - Listener to remove.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: SettingsPermissionChangeListener ): void;
}

/**
 * Permission operations and events required by the settings page.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPermissionApi extends SitePermissionApi {
	/** Newly granted permissions. */
	onAdded: SettingsPermissionChangeEvent;
	/** Removed permissions. */
	onRemoved: SettingsPermissionChangeEvent;
}

/**
 * Protected-sites destination capable of refreshing browser access state.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesAccessRefresher {
	/**
	 * Refreshes visible access from current browser permission grants.
	 * @return Current access values or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshAccessState(): Promise<ReadonlyMap<string, boolean> | null>;
}

/**
 * Minimal shadow root used to locate the active Protected Sites destination.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPageShadowRoot {
	/**
	 * Finds one rendered settings descendant.
	 * @param selectors - CSS selector to match.
	 * @return Matching value or null.
	 * @since 0.1.0 Initial implementation.
	 */
	querySelector( selectors: string ): unknown;
}

/**
 * Settings shell properties coordinated by the page service.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPageShell {
	/** Localized Appearance destination copy. */
	appearanceCopy: Readonly<AppearanceScreenCopy>;
	/** Supported browser-derived language. */
	browserLanguage: Language;
	/** Localized settings navigation copy. */
	copy: Readonly<SettingsShellCopy>;
	/** Coordinated protection configuration editor. */
	editor: ProtectionConfigurationEditor | null;
	/** Browser-capability-aware favicon provider. */
	faviconProvider: SiteFaviconProvider | null;
	/** Localized Language destination copy. */
	languageCopy: Readonly<LanguageScreenCopy>;
	/** Protected-site browser permission manager. */
	permissionManager: SitePermissionManager | null;
	/** Browser family rendered by the settings shell. */
	platform: SettingsPlatform;
	/** Coordinated preferences editor. */
	preferencesEditor: PreferencesEditor | null;
	/** Live preferences preview. */
	preferencesPreview: PreferencesPreview | null;
	/** Validated preferences source. */
	preferencesSource: PreferencesSource | null;
	/** Localized protected-site item copy. */
	protectedSiteItemCopy: Readonly<ProtectedSiteItemCopy>;
	/** Localized Protected Sites destination copy. */
	protectedSitesCopy: Readonly<ProtectedSitesScreenCopy>;
	/** Localized Schedule destination copy. */
	scheduleCopy: Readonly<ScheduleScreenCopy>;
	/** Rendered settings descendants. */
	readonly shadowRoot: SettingsPageShadowRoot | null;
	/** Localized Statistics destination copy. */
	statisticsCopy: Readonly<StatisticsSettingsScreenCopy>;
	/** Authoritative local statistics source. */
	statisticsSource: StatisticsSource | null;
	/** Localized Timing destination copy. */
	timingCopy: Readonly<TimingScreenCopy>;
}

/**
 * Settings document root that receives appearance state and becomes visible after startup.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPageDocumentElement extends PreferencesAppearanceTarget {
	/** Inline startup styles removed when settings are ready. */
	style: Pick<CSSStyleDeclaration, 'removeProperty'>;
}

/**
 * Browser document surface owned by settings.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPageDocument {
	/** Root element receiving appearance state and startup visibility. */
	documentElement: SettingsPageDocumentElement;
	/** Localized settings browser-tab title. */
	title: string;
}

/**
 * Browser window surface used to observe operating-system preferences.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPageWindow {
	/**
	 * Creates one observable media-query result.
	 * @param query - Media query to evaluate.
	 * @return Observable media-query preference.
	 * @since 0.1.0 Initial implementation.
	 */
	matchMedia( query: string ): PreferencesSystemMotionPreference;
}

/**
 * Loads one complete extension localization bundle for settings.
 * @since 0.1.0 Initial implementation.
 */
export type SettingsLocalizationLoader = (
	language: Language,
) => Promise<Readonly<LocalizationBundle>>;

/**
 * Browser and presentation dependencies required by extension settings.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsPageOptions {
	/** Supported language derived from the browser UI locale. */
	browserLanguage: Language;
	/** Collision-resistant browser identifier source. */
	cryptography: BrowserProtectionCryptography;
	/** Browser document receiving localized settings state. */
	document: SettingsPageDocument;
	/** Root URL used by the cached-favicon provider. */
	extensionRootUrl: string;
	/** Loads packaged copy for one supported language. */
	loadLocalization: SettingsLocalizationLoader;
	/** Coordinates extension-origin preference and protection mutations. */
	locks: BrowserPreferencesMutationLock & BrowserProtectionConfigurationMutationLock;
	/** Browser permission operations and change events. */
	permissions: SettingsPermissionApi;
	/** Browser family represented by this settings page. */
	platform: SettingsPlatform;
	/** Browser window supplying operating-system preferences. */
	pageWindow: SettingsPageWindow;
	/** Local extension messaging used by the statistics client. */
	runtime: StatisticsClientRuntime;
	/** Settings shell receiving page dependencies and localized copy. */
	shell: SettingsPageShell;
	/** Shared extension-local storage area. */
	storageArea: PreferencesStorageArea & ProtectionConfigurationStorageArea;
	/** Browser storage changes used by preferences and statistics. */
	storageChanges: PreferencesStorageChangeSource & StatisticsStorageChangeSource;
	/** Whether cached browser favicons are available. */
	supportsCachedFavicons: boolean;
}
