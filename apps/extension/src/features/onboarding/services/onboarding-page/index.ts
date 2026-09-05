import {
	createBrowserPreferencesEditor,
} from '../../../../domains/preferences/services/browser-preferences-editor';
import {
	DefaultPreferencesDocument,
	LanguageSchema,
	type Language as LanguageValue,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	createBrowserProtectionConfigurationEditor,
} from '../../../../domains/protection/services/browser-protection-configuration-editor';
import { ProtectionConfigurationDocumentSchema, type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	createEnglishLocalizationBundle,
	type LocalizationBundle,
} from '../../../../localization';
import { createPreferencesController } from '../../../preferences/services/preferences-controller';
import { type PreferencesStorageChanges } from '../../../preferences/services/preferences-controller/types';
import { createProtectedSiteEnrollmentService } from '../../../protected-sites/services/protected-site-enrollment';
import { createSitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import { OnboardingLanguageSelectEventName } from '../../components/language-step/types';
import {
	OnboardingCompleteEventName,
	OnboardingOpenSettingsEventName,
	OnboardingRetryEventName,
} from '../../components/shell/types';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import { createOnboardingLocalizationCoordinator } from '../localization-coordinator';
import { type OnboardingPageOptions } from './types';

/**
 * Reveals onboarding after either successful startup or terminal recovery.
 * @param options - Onboarding page dependencies containing the owned document.
 * @since 0.1.0 Initial implementation.
 */
function revealOnboardingPage( options: OnboardingPageOptions ): void {
	options.document.documentElement.style.removeProperty( 'color-scheme' );
	options.document.documentElement.style.removeProperty( 'background' );
	options.document.documentElement.style.removeProperty( 'visibility' );
}

/**
 * Projects one complete onboarding localization snapshot.
 * @param options - Onboarding page dependencies receiving the projection.
 * @param localization - Validated packaged localization bundle.
 * @since 0.1.0 Initial implementation.
 */
function applyOnboardingLocalization(
	options: OnboardingPageOptions,
	localization: Readonly<LocalizationBundle>,
): void {
	options.document.documentElement.setAttribute( 'lang', localization.languageTag );
	options.document.title = localization.document.onboardingTitle;
	options.shell.language = localization.language;
	options.shell.copy = localization.onboarding;
	options.shell.interruptionCopy = localization.interruption;
}

/**
 * Restores packaged English copy after an exceptional onboarding startup failure.
 * @param options - Onboarding page dependencies receiving the fallback projection.
 * @since 0.1.0 Initial implementation.
 */
function applyEnglishFallbackLocalization( options: OnboardingPageOptions ): void {
	applyOnboardingLocalization( options, createEnglishLocalizationBundle() );
}

/**
 * Starts the complete first-install onboarding page.
 * @param options - Browser, persistence, localization, and presentation dependencies.
 * @return Promise resolved after initial state and copy settle and the page is revealed.
 * @since 0.1.0 Initial implementation.
 */
export async function startOnboardingPage( options: OnboardingPageOptions ): Promise<void> {
	const preferences = createBrowserPreferencesEditor( {
		area: options.storageArea,
		locks: options.locks,
	} );
	const protection = createBrowserProtectionConfigurationEditor( {
		area: options.storageArea,
		cryptography: options.cryptography,
		locks: options.locks,
	} );
	const preferencesController = createPreferencesController( {
		appearanceTarget: options.document.documentElement,
		browserLanguage: options.browserLanguage,
		storage: preferences.storage,
		storageChanges: options.storageChanges,
		systemMotionPreference: options.pageWindow.matchMedia( '(prefers-reduced-motion: reduce)' ),
	} );
	const enrollment = createProtectedSiteEnrollmentService( {
		editor: protection.editor,
		permissionManager: createSitePermissionManager( { permissions: options.permissions } ),
	} );
	let localizationLanguage = options.browserLanguage;
	const protectionProjection = { changedDuringStartup: false };

	/**
	 * Projects one complete onboarding localization snapshot.
	 * @param localization - Validated packaged localization bundle.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyLocalizationSnapshot( localization: Readonly<LocalizationBundle> ): void {
		localizationLanguage = localization.language;
		applyOnboardingLocalization( options, localization );
	}

	const localizationCoordinator = createOnboardingLocalizationCoordinator( {
		apply: applyLocalizationSnapshot,
		load: options.loadLocalization,
	} );

	/**
	 * Synchronizes the selected onboarding language before navigation proceeds.
	 * @param language - Language selected in the onboarding form.
	 * @return Whether the selected language remains current and is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	function synchronizeLanguage( language: LanguageValue ): Promise<boolean> {
		return localizationCoordinator.synchronize( language );
	}

	options.shell.editor = preferences.editor;
	options.shell.enrollment = enrollment;
	options.shell.suggestions = OnboardingSiteSuggestions;
	options.shell.synchronizeLanguage = synchronizeLanguage;

	/**
	 * Projects one validated preference snapshot into onboarding controls.
	 * @param nextPreferences - Validated preferences or a malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyPreferences( nextPreferences: PreferencesDocument | null ): void {
		const projectedPreferences = nextPreferences ?? DefaultPreferencesDocument;

		options.shell.language = preferencesController.language;
		options.shell.theme = projectedPreferences.theme;
		options.shell.palette = projectedPreferences.palette;
	}

	/**
	 * Projects the current effective reduced-motion state into onboarding previews.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyReducedMotion(): void {
		options.shell.reducedMotion = preferencesController.matches;
	}

	/**
	 * Projects persisted protected-site rules into the onboarding final step.
	 * @param configuration - Validated configuration or a malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyProtectedSites(
		configuration: ProtectionConfigurationDocument | null,
	): void {
		options.shell.protectedSites = configuration?.sites ?? [];
	}

	/**
	 * Projects validated local protection updates without accepting malformed state.
	 * @param changes - Browser storage changes indexed by key.
	 * @param areaName - Storage area containing the change.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleProtectionChange( changes: PreferencesStorageChanges, areaName: string ): void {
		const change = changes[ ProtectionConfigurationStorageKey.CONFIGURATION ];
		if ( areaName !== 'local' || change === undefined ) {
			return;
		}
		const configuration = ProtectionConfigurationDocumentSchema.safeParse( change.newValue );
		if ( configuration.success ) {
			protectionProjection.changedDuringStartup = true;
			applyProtectedSites( configuration.data );
		}
	}

	/**
	 * Starts one non-blocking localization projection after a live language change.
	 * @param language - Newly effective preference language.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleLanguageChange( language: LanguageValue ): void {
		localizationLanguage = language;
		void requestLocalization( language );
	}

	/**
	 * Requests one packaged localization while retaining the last valid copy on failure.
	 * @param language - Exact supported language to request.
	 * @return Promise resolved after the request settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function requestLocalization( language: LanguageValue ): Promise<void> {
		try {
			await localizationCoordinator.request( language );
		} catch {
			return;
		}
	}

	/**
	 * Reads a supported language from one onboarding selection event.
	 * @param event - Native event emitted by the onboarding shell.
	 * @return Supported language or null for another event shape.
	 * @since 0.1.0 Initial implementation.
	 */
	function getSelectedLanguage( event: Event ): LanguageValue | null {
		if ( ! ( event instanceof CustomEvent ) ) {
			return null;
		}

		const detail: unknown = event.detail;

		if ( typeof detail !== 'object' || detail === null || ! ( 'language' in detail ) ) {
			return null;
		}

		const language = LanguageSchema.safeParse( detail.language );

		return language.success ? language.data : null;
	}

	/**
	 * Applies selected onboarding language copy while the shell persists the choice.
	 * @param event - Candidate language-selection event.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleOnboardingLanguageSelection( event: Event ): void {
		const language = getSelectedLanguage( event );

		if ( language !== null ) {
			localizationLanguage = language;
			void requestLocalization( language );
		}
	}

	/**
	 * Closes the onboarding page after the final step completes.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleOnboardingComplete(): void {
		options.pageWindow.close();
	}

	/**
	 * Opens Settings from the completion fallback while containing browser rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleOpenSettings(): void {
		void openSettings();
	}

	/**
	 * Opens browser Settings while retaining the completion fallback on failure.
	 * @return Promise resolved after the Settings request settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function openSettings(): Promise<void> {
		try {
			await options.openSettings();
		} catch {
			return;
		}
	}

	/**
	 * Waits until the most recently requested localization is projected.
	 * @return Promise resolved when no newer language request is pending.
	 * @since 0.1.0 Initial implementation.
	 */
	async function synchronizeLocalization(): Promise<void> {
		let synchronized = false;

		while ( ! synchronized ) {
			synchronized = await localizationCoordinator.synchronize( localizationLanguage );
		}
	}

	/**
	 * Reads local protection configuration while retaining an empty site list on failure.
	 * @return Validated configuration or null when local state is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	async function loadProtectionConfiguration(): Promise<ProtectionConfigurationDocument | null> {
		try {
			return await protection.editor.load();
		} catch {
			return null;
		}
	}

	try {
		options.storageChanges.addListener( handleProtectionChange );
		preferencesController.addLanguageChangeListener( handleLanguageChange );
		preferencesController.addPreferencesChangeListener( applyPreferences );
		preferencesController.addEventListener( 'change', applyReducedMotion );
		options.shell.addEventListener(
			OnboardingLanguageSelectEventName,
			handleOnboardingLanguageSelection,
		);
		options.shell.addEventListener( OnboardingCompleteEventName, handleOnboardingComplete );
		options.shell.addEventListener( OnboardingOpenSettingsEventName, handleOpenSettings );

		const [ , protectionConfiguration ] = await Promise.all( [
			preferencesController.start(),
			loadProtectionConfiguration(),
		] );

		applyReducedMotion();
		if ( ! protectionProjection.changedDuringStartup ) {
			applyProtectedSites( protectionConfiguration );
		}
		await synchronizeLocalization();
		options.shell.startupUnavailable = false;
		revealOnboardingPage( options );
	} catch ( error ) {
		options.storageChanges.removeListener( handleProtectionChange );
		preferencesController.removeLanguageChangeListener( handleLanguageChange );
		preferencesController.removePreferencesChangeListener( applyPreferences );
		preferencesController.removeEventListener( 'change', applyReducedMotion );
		preferencesController.stop();
		options.shell.removeEventListener(
			OnboardingLanguageSelectEventName,
			handleOnboardingLanguageSelection,
		);
		options.shell.removeEventListener( OnboardingCompleteEventName, handleOnboardingComplete );
		options.shell.removeEventListener( OnboardingOpenSettingsEventName, handleOpenSettings );
		options.shell.synchronizeLanguage = null;
		throw error;
	}
}

/**
 * Starts onboarding while containing terminal bootstrap failures.
 * @param options - Browser, persistence, localization, and presentation dependencies.
 * @return Promise resolved after startup succeeds or recovery reveals onboarding.
 * @since 0.1.0 Initial implementation.
 */
export async function bootstrapOnboardingPage( options: OnboardingPageOptions ): Promise<void> {
	try {
		await startOnboardingPage( options );
	} catch {
		applyEnglishFallbackLocalization( options );
		options.shell.startupUnavailable = true;

		/**
		 * Removes the temporary startup-recovery event listeners.
		 * @since 0.1.0 Initial implementation.
		 */
		function removeRecoveryListeners(): void {
			options.shell.removeEventListener( OnboardingRetryEventName, handleRecoveryRetry );
			options.shell.removeEventListener(
				OnboardingOpenSettingsEventName,
				handleRecoveryOpenSettings,
			);
		}

		/**
		 * Rebuilds onboarding from clean dependencies after the user requests a retry.
		 * @since 0.1.0 Initial implementation.
		 */
		function handleRecoveryRetry(): void {
			removeRecoveryListeners();
			void bootstrapOnboardingPage( options );
		}

		/**
		 * Opens Settings from startup recovery while containing browser rejection.
		 * @since 0.1.0 Initial implementation.
		 */
		function handleRecoveryOpenSettings(): void {
			void openRecoverySettings();
		}

		/**
		 * Opens browser Settings without removing the available recovery actions.
		 * @return Promise resolved after the Settings request settles.
		 * @since 0.1.0 Initial implementation.
		 */
		async function openRecoverySettings(): Promise<void> {
			try {
				await options.openSettings();
			} catch {
				return;
			}
		}

		options.shell.addEventListener( OnboardingRetryEventName, handleRecoveryRetry );
		options.shell.addEventListener(
			OnboardingOpenSettingsEventName,
			handleRecoveryOpenSettings,
		);
		revealOnboardingPage( options );
	}
}

export * from './types';
