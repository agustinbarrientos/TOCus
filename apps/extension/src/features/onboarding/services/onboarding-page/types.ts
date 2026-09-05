import {
	type BrowserPreferencesMutationLock,
} from '../../../../domains/preferences/services/browser-preferences-editor';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import { type PreferencesStorageArea } from '../../../../domains/preferences/services/preferences-storage';
import {
	type Language,
	type Palette,
	type ThemeMode,
} from '../../../../domains/preferences/types';
import {
	type BrowserProtectionConfigurationMutationLock,
	type BrowserProtectionCryptography,
} from '../../../../domains/protection/services/browser-protection-configuration-editor';
import { type ProtectionConfigurationStorageArea } from '../../../../domains/protection/services/protection-configuration-storage';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { type InterruptionScreenCopy } from '../../../interruption/components/screen/types';
import {
	type PreferencesAppearanceTarget,
	type PreferencesStorageChangeSource,
	type PreferencesSystemMotionPreference,
} from '../../../preferences/services/preferences-controller';
import { type ProtectedSiteEnrollmentService } from '../../../protected-sites/services/protected-site-enrollment';
import { type SitePermissionApi } from '../../../protected-sites/services/site-permission-manager';
import {
	type OnboardingLanguageSynchronizer,
	type OnboardingShellCopy,
} from '../../components/shell/types';
import { type OnboardingSiteSuggestion } from '../../utils/site-suggestion-catalog';
import { type OnboardingLocalizationLoader } from '../localization-coordinator';

/**
 * Opens the extension Settings surface from onboarding.
 * @since 0.1.0 Initial implementation.
 */
export type OnboardingSettingsOpener = () => Promise<void>;

/**
 * Onboarding shell properties and events coordinated by the page service.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingPageShell extends EventTarget {
	/** Complete localized onboarding copy. */
	copy: Readonly<OnboardingShellCopy> | undefined;
	/** Complete localized copy used by the real interruption preview. */
	interruptionCopy: Readonly<InterruptionScreenCopy> | undefined;
	/** Coordinated local preferences editor. */
	editor: PreferencesEditor | null;
	/** Permission-aware protected-site enrollment. */
	enrollment: ProtectedSiteEnrollmentService | null;
	/** Effective onboarding language. */
	language: Language;
	/** Selected light, dark, or system appearance. */
	theme: ThemeMode;
	/** Selected scene palette. */
	palette: Palette;
	/** Authoritative site configurations already protected. */
	protectedSites: readonly ProtectedSiteConfiguration[];
	/** Whether continuous motion must be reduced. */
	reducedMotion: boolean;
	/** Fixed local protected-site suggestions. */
	suggestions: readonly Readonly<OnboardingSiteSuggestion>[];
	/** Whether onboarding startup recovery replaces the ordinary setup form. */
	startupUnavailable: boolean;
	/** Localization readiness gate required before Language navigation. */
	synchronizeLanguage: OnboardingLanguageSynchronizer | null;
}

/**
 * Onboarding document root that receives appearance state and becomes visible after startup.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingPageDocumentElement extends PreferencesAppearanceTarget {
	/** Inline startup styles removed when onboarding is ready. */
	style: Pick<CSSStyleDeclaration, 'removeProperty'>;
}

/**
 * Browser document surface owned by onboarding.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingPageDocument {
	/** Root element receiving appearance state and startup visibility. */
	documentElement: OnboardingPageDocumentElement;
	/** Localized onboarding browser-tab title. */
	title: string;
}

/**
 * Browser window surface owned by onboarding.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingPageWindow {
	/** Closes the onboarding page after successful completion. */
	close(): void;
	/**
	 * Creates one observable media-query result.
	 * @param query - Media query to evaluate.
	 * @return Observable media-query preference.
	 * @since 0.1.0 Initial implementation.
	 */
	matchMedia( query: string ): PreferencesSystemMotionPreference;
}

/**
 * Browser and presentation dependencies required by first-install onboarding.
 * @since 0.1.0 Initial implementation.
 */
export interface OnboardingPageOptions {
	/** Supported language derived from the browser UI locale. */
	browserLanguage: Language;
	/** Collision-resistant browser identifier source. */
	cryptography: BrowserProtectionCryptography;
	/** Browser document receiving localized onboarding state. */
	document: OnboardingPageDocument;
	/** Loads packaged copy for one supported language. */
	loadLocalization: OnboardingLocalizationLoader;
	/** Coordinates extension-origin preference and protection mutations. */
	locks: BrowserPreferencesMutationLock & BrowserProtectionConfigurationMutationLock;
	/** Opens extension Settings from the completion fallback. */
	openSettings: OnboardingSettingsOpener;
	/** Browser permission operations used by protected-site enrollment. */
	permissions: SitePermissionApi;
	/** Browser window supplying motion preferences and page closure. */
	pageWindow: OnboardingPageWindow;
	/** Onboarding shell receiving page dependencies and projections. */
	shell: OnboardingPageShell;
	/** Shared extension-local storage area. */
	storageArea: PreferencesStorageArea & ProtectionConfigurationStorageArea;
	/** Browser storage changes used by live preferences. */
	storageChanges: PreferencesStorageChangeSource;
}
