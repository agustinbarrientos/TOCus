import { describe, expect, it, vi } from 'vitest';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	PauseMode,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesStorageKey,
} from '../../../../domains/preferences/services/preferences-storage';
import {
	ProtectionConfigurationStorageKey,
} from '../../../../domains/protection/services/protection-configuration-storage';
import {
	DefaultProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import {
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import { loadLocalizationBundle } from '../../../../localization';
import {
	OnboardingCompleteEventName,
	OnboardingOpenSettingsEventName,
	OnboardingRetryEventName,
} from '../../components/shell/types';
import { OnboardingLanguageSelectEventName } from '../../components/language-step/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { bootstrapOnboardingPage, startOnboardingPage } from './index';
import {
	type OnboardingPageOptions,
	type OnboardingPageShell,
} from './types';

/**
 * Mutable storage-change source used by onboarding startup tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryStorageChanges {
	/** Active browser storage listeners. */
	private readonly listeners = new Set<(
		changes: Readonly<Record<string, { readonly newValue?: unknown }>>,
		areaName: string,
	) => void>();

	/**
	 * Registers one browser storage listener.
	 * @param listener - Listener to register.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener(
		listener: (
			changes: Readonly<Record<string, { readonly newValue?: unknown }>>,
			areaName: string,
		) => void,
	): void {
		this.listeners.add( listener );
	}

	/**
	 * Removes one browser storage listener.
	 * @param listener - Listener to remove.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener(
		listener: (
			changes: Readonly<Record<string, { readonly newValue?: unknown }>>,
			areaName: string,
		) => void,
	): void {
		this.listeners.delete( listener );
	}

	/**
	 * Emits one preferences storage update.
	 * @param preferences - Complete preferences delivered by the browser.
	 * @since 0.1.0 Initial implementation.
	 */
	emitPreferences( preferences: PreferencesDocument ): void {
		for ( const listener of this.listeners ) {
			listener( {
				[ PreferencesStorageKey.PREFERENCES ]: { newValue: preferences },
			}, 'local' );
		}
	}

	/**
	 * Emits one candidate protection snapshot from an arbitrary storage area.
	 * @param configuration - Raw protection document supplied by storage.
	 * @param areaName - Browser storage area containing the update.
	 * @since 0.1.0 Initial implementation.
	 */
	emitProtection( configuration: unknown, areaName = 'local' ): void {
		for ( const listener of this.listeners ) {
			listener( { [ ProtectionConfigurationStorageKey.CONFIGURATION ]: { newValue: configuration } }, areaName );
		}
	}
}

/**
 * Mutable operating-system motion preference used by page tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryMotionPreference extends EventTarget {
	/** Whether reduced motion is currently requested. */
	matches = false;
}

/**
 * Executes every browser mutation immediately for page-service tests.
 * @since 0.1.0 Initial implementation.
 */
class ImmediateMutationLock {
	/**
	 * Executes one mutation without introducing test concurrency.
	 * @template Result Exact mutation result.
	 * @param _name - Stable lock name.
	 * @param mutation - Deferred browser mutation.
	 * @return Exact mutation result.
	 * @since 0.1.0 Initial implementation.
	 */
	request<Result>( _name: string, mutation: () => Promise<Result> ): Promise<Result> {
		return mutation();
	}
}

/**
 * Observable onboarding shell used by page-service tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryOnboardingShell extends EventTarget implements OnboardingPageShell {
	copy: OnboardingPageShell[ 'copy' ];

	interruptionCopy: OnboardingPageShell[ 'interruptionCopy' ];

	editor: OnboardingPageShell[ 'editor' ] = null;

	enrollment: OnboardingPageShell[ 'enrollment' ] = null;

	language: OnboardingPageShell[ 'language' ] = Language.ENGLISH;

	theme: OnboardingPageShell[ 'theme' ] = ThemeMode.SYSTEM;

	palette: OnboardingPageShell[ 'palette' ] = Palette.BROWN;

	protectedSites: OnboardingPageShell[ 'protectedSites' ] = [];

	reducedMotion = false;

	suggestions: OnboardingPageShell[ 'suggestions' ] = [];

	startupUnavailable = false;

	synchronizeLanguage: OnboardingPageShell[ 'synchronizeLanguage' ] = null;
}

/**
 * Creates complete page dependencies with immediate local defaults.
 * @param overrides - Dependencies replaced for one scenario.
 * @return Complete onboarding page options.
 * @since 0.1.0 Initial implementation.
 */
function createOptions(
	overrides: Partial<OnboardingPageOptions> = {},
): OnboardingPageOptions {
	const storageChanges = new MemoryStorageChanges();
	const shell = new MemoryOnboardingShell();

	return {
		browserLanguage: Language.ENGLISH,
		cryptography: { randomUUID: vi.fn().mockReturnValue( 'fixture-id' ) },
		document: {
			documentElement: {
				setAttribute: vi.fn(),
				style: { removeProperty: vi.fn() },
			},
			title: 'TOCus',
		},
		loadLocalization: vi.fn().mockResolvedValue( TestEnglishLocalizationBundle ),
		locks: new ImmediateMutationLock(),
		openSettings: vi.fn().mockResolvedValue( undefined ),
		pageWindow: {
			close: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( new MemoryMotionPreference() ),
		},
		permissions: {
			contains: vi.fn().mockResolvedValue( true ),
			getAll: vi.fn().mockResolvedValue( {} ),
			remove: vi.fn().mockResolvedValue( true ),
			request: vi.fn().mockResolvedValue( true ),
		},
		shell,
		storageArea: {
			get: vi.fn().mockResolvedValue( {} ),
			set: vi.fn().mockResolvedValue( undefined ),
		},
		storageChanges,
		...overrides,
	};
}

describe( 'startOnboardingPage', () => {
	it( 'retains a live protection projection when an older startup read resolves later', async () => {
		const read = Promise.withResolvers<Record<string, unknown>>();
		const storageChanges = new MemoryStorageChanges();
		const shell = new MemoryOnboardingShell();
		const start = startOnboardingPage( createOptions( {
			storageChanges,
			shell,
			storageArea: {
				get: vi.fn( ( key: string ) => key === ProtectionConfigurationStorageKey.CONFIGURATION
					? read.promise : Promise.resolve( {} ) ),
				set: vi.fn().mockResolvedValue( undefined ),
			},
		} ) );
		const site = {
			identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
		};
		storageChanges.emitProtection( { ...TestEmptyProtectionConfiguration, sites: [ site ] } );
		read.resolve( { [ ProtectionConfigurationStorageKey.CONFIGURATION ]: TestEmptyProtectionConfiguration } );
		await start;
		expect( shell.protectedSites ).toEqual( [ site ] );
	} );

	it( 'projects external protection additions and removals without discarding sites on malformed updates', async () => {
		const storageChanges = new MemoryStorageChanges();
		const shell = new MemoryOnboardingShell();
		await startOnboardingPage( createOptions( { storageChanges, shell } ) );
		const site = {
			identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
		};
		const configuration = { ...TestEmptyProtectionConfiguration, sites: [ site ] };
		storageChanges.emitProtection( configuration, 'sync' );
		expect( shell.protectedSites ).toEqual( [] );
		storageChanges.emitProtection( configuration );
		expect( shell.protectedSites ).toEqual( [ site ] );
		storageChanges.emitProtection( { sites: [] } );
		expect( shell.protectedSites ).toEqual( [ site ] );
		storageChanges.emitProtection( TestEmptyProtectionConfiguration );
		expect( shell.protectedSites ).toEqual( [] );
	} );

	it( 'keeps onboarding hidden until preferences, protection, and localization settle', async () => {
		const preferences = Promise.withResolvers<Record<string, unknown>>();
		const protection = Promise.withResolvers<Record<string, unknown>>();
		const localization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const shell = new MemoryOnboardingShell();
		const removeProperty = vi.fn();
		const loadLocalization = vi.fn().mockReturnValue( localization.promise );
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization,
			shell,
			storageArea: {
				get: vi.fn( ( key: string ) => key === PreferencesStorageKey.PREFERENCES
					? preferences.promise
					: protection.promise ),
				set: vi.fn().mockResolvedValue( undefined ),
			},
		} );
		const start = startOnboardingPage( options );

		expect( removeProperty ).not.toHaveBeenCalled();
		preferences.resolve( {
			[ PreferencesStorageKey.PREFERENCES ]: {
				...DefaultPreferencesDocument,
				language: Language.SPANISH_VOS,
				theme: ThemeMode.DARK,
				palette: Palette.PURPLE,
				pauseMode: PauseMode.QUIET,
			},
		} );
		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledWith( Language.SPANISH_VOS );
		} );
		expect( removeProperty ).not.toHaveBeenCalled();
		localization.resolve( {
			...TestEnglishLocalizationBundle,
			language: Language.SPANISH_VOS,
			languageTag: 'es-AR',
		} );
		await Promise.resolve();
		expect( removeProperty ).not.toHaveBeenCalled();
		protection.resolve( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...TestEmptyProtectionConfiguration,
				sites: [ {
					identityHost: 'www.instagram.com',
					rule: {
						host: 'instagram.com',
						includeSubdomains: true,
						scopeId: DefaultProtectionScopeId,
					},
				} ],
			},
		} );

		await start;

		expect( shell.language ).toBe( Language.SPANISH_VOS );
		expect( shell.theme ).toBe( ThemeMode.DARK );
		expect( shell.palette ).toBe( Palette.PURPLE );
		expect( shell.interruptionCopy ).toBe( TestEnglishLocalizationBundle.interruption );
		expect( 'pauseMode' in shell ).toBe( false );
		expect( 'previewWellbeingSummary' in shell ).toBe( false );
		expect( shell.protectedSites ).toEqual( [ {
			identityHost: 'www.instagram.com',
			rule: { host: 'instagram.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
		} ] );
		expect( removeProperty ).toHaveBeenNthCalledWith( 1, 'color-scheme' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 2, 'background' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 3, 'visibility' );
	} );

	it( 'keeps a live preference projection when the startup read resolves later', async () => {
		const preferences = Promise.withResolvers<Record<string, unknown>>();
		const storageChanges = new MemoryStorageChanges();
		const shell = new MemoryOnboardingShell();
		const loadLocalization = vi.fn( loadLocalizationBundle );
		const options = createOptions( {
			loadLocalization,
			shell,
			storageArea: {
				get: vi.fn( ( key: string ) => key === PreferencesStorageKey.PREFERENCES
					? preferences.promise
					: Promise.resolve( {} ) ),
				set: vi.fn().mockResolvedValue( undefined ),
			},
			storageChanges,
		} );
		const start = startOnboardingPage( options );
		const livePreferences = {
			...DefaultPreferencesDocument,
			language: Language.JAPANESE,
			theme: ThemeMode.LIGHT,
			palette: Palette.GREEN,
			pauseMode: PauseMode.QUIET,
		};

		storageChanges.emitPreferences( livePreferences );
		preferences.resolve( {
			[ PreferencesStorageKey.PREFERENCES ]: {
				...DefaultPreferencesDocument,
				palette: Palette.ORANGE,
			},
		} );
		await start;

		expect( shell.language ).toBe( Language.JAPANESE );
		expect( shell.theme ).toBe( ThemeMode.LIGHT );
		expect( shell.palette ).toBe( Palette.GREEN );
		expect( 'pauseMode' in shell ).toBe( false );
		expect( loadLocalization ).toHaveBeenLastCalledWith( Language.JAPANESE );
	} );

	it( 'ignores unsupported language-selection event details', async () => {
		const shell = new MemoryOnboardingShell();
		const loadLocalization = vi.fn().mockResolvedValue( TestEnglishLocalizationBundle );
		const options = createOptions( { loadLocalization, shell } );

		await startOnboardingPage( options );
		loadLocalization.mockClear();
		shell.dispatchEvent( new Event( OnboardingLanguageSelectEventName ) );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: null,
		} ) );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: 'en',
		} ) );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: {},
		} ) );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: { language: 'unsupported' },
		} ) );
		await Promise.resolve();

		expect( loadLocalization ).not.toHaveBeenCalled();
	} );

	it.each( [
		{
			expectedIntroduction: 'Crea una pausa amable antes de los sitios web que elijas.',
			expectedLanguageTag: 'es',
			expectedPortugueseVariantLegend: '\u00bfQu\u00e9 variante de portugu\u00e9s quieres que use TOCus?',
			expectedPrivacyTitle: 'Privacidad desde el dise\u00f1o',
			expectedProgressLabel: 'Progreso de la configuraci\u00f3n',
			expectedSettingsNote: 'Puedes cambiar estas opciones y ajustar los tiempos o los horarios cuando quieras en Configuraci\u00f3n.',
			expectedSpanishVariantLegend: '\u00bfQu\u00e9 variante de espa\u00f1ol quieres que use TOCus?',
			expectedTitle: 'Elige tu idioma',
			language: Language.SPANISH_TU,
		},
		{
			expectedIntroduction: 'Crie uma pausa gentil antes dos sites que voc\u00ea escolher.',
			expectedLanguageTag: 'pt-BR',
			expectedPortugueseVariantLegend: 'Qual variante do portugu\u00eas o TOCus deve usar?',
			expectedPrivacyTitle: 'Privacidade desde a concep\u00e7\u00e3o',
			expectedProgressLabel: 'Progresso da configura\u00e7\u00e3o',
			expectedSettingsNote: 'Voc\u00ea pode alterar estas escolhas e ajustar os tempos ou hor\u00e1rios quando quiser nas Configura\u00e7\u00f5es.',
			expectedSpanishVariantLegend: 'Qual variante do espanhol o TOCus deve usar?',
			expectedTitle: 'Escolha seu idioma',
			language: Language.PORTUGUESE_BRAZIL,
		},
	] )( 'applies $language throughout onboarding immediately after selection', async ( {
		expectedIntroduction,
		expectedLanguageTag,
		expectedPortugueseVariantLegend,
		expectedPrivacyTitle,
		expectedProgressLabel,
		expectedSettingsNote,
		expectedSpanishVariantLegend,
		expectedTitle,
		language,
	} ) => {
		const shell = new MemoryOnboardingShell();
		const setAttribute = vi.fn();
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute,
					style: { removeProperty: vi.fn() },
				},
				title: 'TOCus',
			},
			loadLocalization: loadLocalizationBundle,
			shell,
		} );
		const storageSet = vi.spyOn( options.storageArea, 'set' );

		await startOnboardingPage( options );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: { language },
		} ) );
		await vi.waitFor( () => {
			expect( shell.copy?.language.title ).toBe( expectedTitle );
		} );

		expect( shell.copy?.language.spanishVariantLegend ).toBe( expectedSpanishVariantLegend );
		expect( shell.copy?.language.portugueseVariantLegend ).toBe( expectedPortugueseVariantLegend );
		expect( shell.copy?.introduction ).toBe( expectedIntroduction );
		expect( shell.copy?.privacyTitle ).toBe( expectedPrivacyTitle );
		expect( shell.copy?.progressLabel ).toBe( expectedProgressLabel );
		expect( shell.copy?.settingsNote ).toBe( expectedSettingsNote );
		expect( setAttribute ).toHaveBeenLastCalledWith( 'lang', expectedLanguageTag );
		expect( storageSet ).not.toHaveBeenCalled();
	} );

	it( 'restores the language represented by a fallback bundle after a live selection', async () => {
		const shell = new MemoryOnboardingShell();
		const setAttribute = vi.fn();
		const loadLocalization = vi.fn().mockResolvedValue( TestEnglishLocalizationBundle );
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute,
					style: { removeProperty: vi.fn() },
				},
				title: 'TOCus',
			},
			loadLocalization,
			shell,
		} );

		await startOnboardingPage( options );
		shell.language = Language.SPANISH_TU;
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: { language: Language.SPANISH_TU },
		} ) );
		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledTimes( 2 );
		} );

		expect( shell.language ).toBe( Language.ENGLISH );
		expect( shell.copy ).toBe( TestEnglishLocalizationBundle.onboarding );
		expect( setAttribute ).toHaveBeenLastCalledWith( 'lang', 'en' );
	} );

	it( 'retains the current copy when a live language request fails', async () => {
		const shell = new MemoryOnboardingShell();
		const loadLocalization = vi.fn()
			.mockResolvedValueOnce( TestEnglishLocalizationBundle )
			.mockRejectedValueOnce( new Error( 'Catalog unavailable.' ) );
		const options = createOptions( { loadLocalization, shell } );

		await startOnboardingPage( options );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: { language: Language.JAPANESE },
		} ) );
		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledTimes( 2 );
		} );

		expect( shell.copy ).toBe( TestEnglishLocalizationBundle.onboarding );
	} );

	it( 'keeps the latest selected language when an earlier catalog resolves later', async () => {
		const initialLocalization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const shell = new MemoryOnboardingShell();
		const removeProperty = vi.fn();
		const japaneseLocalization = {
			...TestEnglishLocalizationBundle,
			language: Language.JAPANESE,
			languageTag: 'ja',
			onboarding: {
				...TestEnglishLocalizationBundle.onboarding,
				introduction: 'Japanese onboarding',
			},
		};
		const loadLocalization = vi.fn( ( language: Language ) =>
			language === Language.JAPANESE
				? Promise.resolve( japaneseLocalization )
				: initialLocalization.promise,
		);
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization,
			shell,
		} );
		const start = startOnboardingPage( options );

		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledWith( Language.ENGLISH );
		} );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: { language: Language.JAPANESE },
		} ) );
		await vi.waitFor( () => {
			expect( shell.copy?.introduction ).toBe( 'Japanese onboarding' );
		} );
		expect( removeProperty ).not.toHaveBeenCalled();

		initialLocalization.resolve( TestEnglishLocalizationBundle );
		await start;

		expect( shell.copy?.introduction ).toBe( 'Japanese onboarding' );
		expect( loadLocalization ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( removeProperty ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'exposes a gate that settles only after the selected language is applied', async () => {
		const selectedLocalization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const shell = new MemoryOnboardingShell();
		const loadLocalization = vi.fn( ( language: Language ) => language === Language.JAPANESE
			? selectedLocalization.promise
			: Promise.resolve( TestEnglishLocalizationBundle ) );
		const options = createOptions( { loadLocalization, shell } );

		await startOnboardingPage( options );
		shell.dispatchEvent( new CustomEvent( OnboardingLanguageSelectEventName, {
			detail: { language: Language.JAPANESE },
		} ) );
		const synchronizeLanguage = shell.synchronizeLanguage;

		expect( synchronizeLanguage ).not.toBeNull();
		if ( synchronizeLanguage === null ) {
			throw new TypeError( 'Expected onboarding to expose language synchronization.' );
		}

		const synchronization = synchronizeLanguage( Language.JAPANESE );
		let settled = false;

		void synchronization.then( () => {
			settled = true;
		} );
		await Promise.resolve();

		expect( settled ).toBe( false );

		selectedLocalization.resolve( {
			...TestEnglishLocalizationBundle,
			language: Language.JAPANESE,
			languageTag: 'ja',
		} );

		await expect( synchronization ).resolves.toBe( true );
		expect( shell.copy?.language.title ).toBe( TestEnglishLocalizationBundle.onboarding.language.title );
	} );

	it( 'uses safe defaults when stored preferences and protection cannot be read', async () => {
		const shell = new MemoryOnboardingShell();
		const options = createOptions( {
			shell,
			storageArea: {
				get: vi.fn( ( key: string ) => key === PreferencesStorageKey.PREFERENCES
					? Promise.resolve( {
						[ PreferencesStorageKey.PREFERENCES ]: { malformed: true },
					} )
					: Promise.reject( new Error( 'Protection storage unavailable.' ) ) ),
				set: vi.fn().mockResolvedValue( undefined ),
			},
		} );

		await startOnboardingPage( options );

		expect( shell.language ).toBe( Language.ENGLISH );
		expect( shell.theme ).toBe( ThemeMode.SYSTEM );
		expect( shell.palette ).toBe( Palette.BROWN );
		expect( 'pauseMode' in shell ).toBe( false );
		expect( shell.protectedSites ).toEqual( [] );
	} );

	it( 'releases observers and keeps onboarding hidden when startup fails', async () => {
		const storageChanges = new MemoryStorageChanges();
		const motionPreference = new MemoryMotionPreference();
		const shell = new MemoryOnboardingShell();
		const removeProperty = vi.fn();
		const storageListenerRemoval = vi.spyOn( storageChanges, 'removeListener' );
		const motionListenerRemoval = vi.spyOn( motionPreference, 'removeEventListener' );
		const shellListenerRemoval = vi.spyOn( shell, 'removeEventListener' );
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization: vi.fn().mockRejectedValue( new Error( 'Catalog unavailable.' ) ),
			pageWindow: {
				close: vi.fn(),
				matchMedia: vi.fn().mockReturnValue( motionPreference ),
			},
			shell,
			storageChanges,
		} );

		await expect( startOnboardingPage( options ) ).rejects.toThrow( 'Catalog unavailable.' );

		expect( storageListenerRemoval ).toHaveBeenCalledTimes( 2 );
		expect( motionListenerRemoval ).toHaveBeenCalledOnce();
		expect( shellListenerRemoval ).toHaveBeenCalledTimes( 3 );
		expect( removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'reveals localized recovery and restores onboarding after Retry', async () => {
		const shell = new MemoryOnboardingShell();
		const setAttribute = vi.fn();
		const removeProperty = vi.fn();
		const loadLocalization = vi.fn()
			.mockRejectedValueOnce( new Error( 'Catalog unavailable.' ) )
			.mockResolvedValue( TestEnglishLocalizationBundle );
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute,
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization,
			shell,
		} );

		await expect( bootstrapOnboardingPage( options ) ).resolves.toBeUndefined();

		expect( loadLocalization ).toHaveBeenLastCalledWith( Language.ENGLISH );
		expect( setAttribute ).toHaveBeenCalledWith( 'lang', 'en' );
		expect( options.document.title ).toBe( TestEnglishLocalizationBundle.document.onboardingTitle );
		expect( shell.copy?.startupErrorTitle ).toBe( 'TOCus could not finish opening' );
		expect( shell.startupUnavailable ).toBe( true );
		expect( removeProperty ).toHaveBeenCalledWith( 'visibility' );

		shell.dispatchEvent( new Event( OnboardingRetryEventName ) );
		await vi.waitFor( () => {
			expect( shell.startupUnavailable ).toBe( false );
		} );
		expect( loadLocalization ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'opens Settings from startup recovery and contains rejection', async () => {
		const shell = new MemoryOnboardingShell();
		const openSettings = vi.fn().mockRejectedValue( new Error( 'Settings unavailable.' ) );
		const options = createOptions( {
			loadLocalization: vi.fn()
				.mockRejectedValueOnce( new Error( 'Catalog unavailable.' ) )
				.mockResolvedValue( TestEnglishLocalizationBundle ),
			openSettings,
			shell,
		} );

		await bootstrapOnboardingPage( options );
		shell.dispatchEvent( new Event( OnboardingOpenSettingsEventName ) );
		await vi.waitFor( () => {
			expect( openSettings ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'reveals startup recovery when packaged fallback copy is unavailable', async () => {
		const shell = new MemoryOnboardingShell();
		const removeProperty = vi.fn();
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization: vi.fn().mockRejectedValue( new Error( 'Catalog unavailable.' ) ),
			shell,
		} );

		await bootstrapOnboardingPage( options );

		expect( shell.startupUnavailable ).toBe( true );
		expect( shell.copy?.startupErrorTitle ).toBe( 'TOCus could not finish opening' );
		expect( removeProperty ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'closes the page after onboarding completes', async () => {
		const shell = new MemoryOnboardingShell();
		const close = vi.fn();
		const options = createOptions( {
			pageWindow: {
				close,
				matchMedia: vi.fn().mockReturnValue( new MemoryMotionPreference() ),
			},
			shell,
		} );

		await startOnboardingPage( options );
		shell.dispatchEvent( new Event( OnboardingCompleteEventName ) );

		expect( close ).toHaveBeenCalledOnce();
	} );

	it( 'opens Settings from the completion fallback without losing the page on failure', async () => {
		const shell = new MemoryOnboardingShell();
		const openSettings = vi.fn()
			.mockRejectedValueOnce( new Error( 'Settings unavailable.' ) )
			.mockResolvedValueOnce( undefined );
		const options = createOptions( { openSettings, shell } );

		await startOnboardingPage( options );
		shell.dispatchEvent( new Event( OnboardingOpenSettingsEventName ) );
		shell.dispatchEvent( new Event( OnboardingOpenSettingsEventName ) );

		await vi.waitFor( () => {
			expect( openSettings ).toHaveBeenCalledTimes( 2 );
		} );
	} );
} );
