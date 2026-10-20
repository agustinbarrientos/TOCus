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
import { createBackupFixture } from '../../../../domains/local-data/services/local-data-backup/__fixtures__';
import { LocalDataGenerationStorageKey, readLocalDataGeneration } from '../../../../domains/local-data/services/local-data-generation';
import * as LocalDataGeneration from '../../../../domains/local-data/services/local-data-generation';
import { BackupImportJournalKey } from '../../../../domains/local-data/types/backup-storage-key';
import type { PrivacyDataRuntime } from '../../../settings/services/privacy-data-actions/types';
import { bootstrapOnboardingPage, startOnboardingPage } from './index';
import type {
	OnboardingPageOptions,
	OnboardingPageShell,
} from './types';

/**
 * Mutable storage-change source used by onboarding startup tests.
 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
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
	 * Emits arbitrary replacement metadata and documents from local storage.
	 * @param changes - Browser storage changes.
	 * @since 1.1.0
	 */
	emit( changes: Readonly<Record<string, { readonly newValue?: unknown }>> ): void {
		for ( const listener of this.listeners ) {
			listener( changes, 'local' );
		}
	}

	/**
	 * Emits one preferences storage update.
	 * @param preferences - Complete preferences delivered by the browser.
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
	 */
	emitProtection( configuration: unknown, areaName = 'local' ): void {
		for ( const listener of this.listeners ) {
			listener( { [ ProtectionConfigurationStorageKey.CONFIGURATION ]: { newValue: configuration } }, areaName );
		}
	}
}

/**
 * Mutable operating-system motion preference used by page tests.
 * @since 1.0.0 Initial implementation.
 */
class MemoryMotionPreference extends EventTarget {
	/** Whether reduced motion is currently requested. */
	matches = false;
}

/**
 * Executes every browser mutation immediately for page-service tests.
 * @since 1.0.0 Initial implementation.
 */
class ImmediateMutationLock {
	/**
	 * Executes one mutation without introducing test concurrency.
	 * @template Result Exact mutation result.
	 * @param _name - Stable lock name.
	 * @param mutation - Deferred browser mutation.
	 * @return Exact mutation result.
	 * @since 1.0.0 Initial implementation.
	 */
	request<Result>( _name: string, mutation: () => Promise<Result> ): Promise<Result> {
		return mutation();
	}
}

/**
 * Observable onboarding shell used by page-service tests.
 * @since 1.0.0 Initial implementation.
 */
class MemoryOnboardingShell extends EventTarget implements OnboardingPageShell {
	backupActions: Exclude<OnboardingPageShell[ 'backupActions' ], undefined> = null;

	copy: OnboardingPageShell[ 'copy' ];

	notificationCopy: OnboardingPageShell[ 'notificationCopy' ];

	resetComplete = false;

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
 * Connects onboarding to real local backup persistence and observable browser updates.
 * @return Service options, import authority and controllable storage events.
 * @since 1.1.0
 */
function createRestoreFixture() {
	const fixture = createBackupFixture();
	fixture.values[ PreferencesStorageKey.PREFERENCES ] = DefaultPreferencesDocument;
	fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] = TestEmptyProtectionConfiguration;
	const storageChanges = new MemoryStorageChanges();
	const shell = new MemoryOnboardingShell();
	const runtime = { sendMessage: vi.fn<PrivacyDataRuntime[ 'sendMessage' ]>( async ( request ) => {
		if ( request.type === 'read-local-backup-state' ) {
			const marker = await readLocalDataGeneration( fixture.area );
			return { status: 'ready', generation: marker?.generation ?? null };
		}
		const result = await fixture.backup.import( request );
		storageChanges.emit( {
			[ LocalDataGenerationStorageKey ]: { newValue: fixture.values[ LocalDataGenerationStorageKey ] },
		} );
		return result;
	} ) };
	const options = createOptions( { shell, storageArea: fixture.area, storageChanges, runtime,
		loadLocalization: loadLocalizationBundle } );
	return { ...fixture, options, shell, storageChanges, runtime };
}

describe( 'onboarding backup projection', () => {
	it( 'retries a coherent refresh when another complete generation replaces the imported snapshot', async () => {
		const fixture = createRestoreFixture();
		await startOnboardingPage( fixture.options );
		const actions = fixture.shell.backupActions;
		if ( ! actions ) {
			throw new Error( 'Expected onboarding backup actions.' );
		}
		const preview = await actions.preview( fixture.request.backup );
		const read = LocalDataGeneration.readLocalDataGeneration;
		let replaced = false;
		const generationRead = vi.spyOn( LocalDataGeneration, 'readLocalDataGeneration' )
			.mockImplementation( async ( area ) => {
				const marker = await read( area );
				if ( area !== fixture.area && marker !== null && ! replaced ) {
					replaced = true;
					fixture.values[ LocalDataGenerationStorageKey ] = {
						generation: 'newer-replacement', pending: false, needsOnboarding: false,
					};
					fixture.values[ PreferencesStorageKey.PREFERENCES ] = {
						...DefaultPreferencesDocument, theme: ThemeMode.LIGHT, palette: Palette.PURPLE,
					};
				}
				return marker;
			} );
		try {
			await expect( actions.confirmImport( preview ) ).resolves.toMatchObject( { status: 'completed' } );
			expect( replaced ).toBe( true );
			expect( fixture.shell.theme ).toBe( ThemeMode.LIGHT );
			expect( fixture.shell.palette ).toBe( Palette.PURPLE );
			await expect( fixture.shell.editor?.update( { palette: Palette.GREEN } ) )
				.resolves.toMatchObject( { palette: Palette.GREEN } );
		} finally {
			generationRead.mockRestore();
		}
	} );

	it.each( [ PreferencesStorageKey.PREFERENCES, ProtectionConfigurationStorageKey.CONFIGURATION ] )(
		'keeps restoration recoverable when a completed response has unreadable %s data', async ( key ) => {
			const fixture = createRestoreFixture();
			await startOnboardingPage( fixture.options );
			const actions = fixture.shell.backupActions;
			if ( ! actions ) {
				throw new Error( 'Expected onboarding backup actions.' );
			}
			const preview = await actions.preview( fixture.request.backup );
			fixture.runtime.sendMessage.mockImplementationOnce( async ( request ) => {
				const result = await fixture.backup.import( request );
				fixture.values[ key ] = { malformed: true };
				return result;
			} );
			await expect( actions.confirmImport( preview ) ).resolves.toEqual( { status: 'recovery-pending' } );
			expect( fixture.shell.theme ).toBe( ThemeMode.SYSTEM );
			expect( fixture.shell.language ).toBe( Language.ENGLISH );
			expect( fixture.shell.protectedSites ).toEqual( [] );
		},
	);

	it( 'restores all persisted settings with denied access and replaces stale editors before completion', async () => {
		const fixture = createRestoreFixture();
		await startOnboardingPage( fixture.options );
		const previousEditor = fixture.shell.editor;
		const previousEnrollment = fixture.shell.enrollment;
		const actions = fixture.shell.backupActions;
		expect( actions ).toBeDefined();
		if ( ! actions ) {
			throw new Error( 'Expected onboarding backup actions.' );
		}
		const preview = await actions.preview( fixture.request.backup );
		expect( fixture.writeCount() ).toBe( 0 );
		vi.mocked( fixture.options.permissions.request ).mockResolvedValue( false );
		vi.mocked( fixture.options.permissions.contains ).mockResolvedValue( false );
		const restored = actions.confirmImport( preview );
		expect( fixture.options.permissions.request ).toHaveBeenCalledOnce();
		await expect( restored ).resolves.toMatchObject( { status: 'completed', missingAccess: true } );
		expect( fixture.shell.theme ).toBe( ThemeMode.DARK );
		expect( fixture.shell.palette ).toBe( Palette.GREEN );
		expect( fixture.shell.language ).toBe( Language.SPANISH_VOS );
		expect( fixture.shell.copy?.language.title ).toBe( 'Eleg\u00ed tu idioma' );
		expect( fixture.shell.protectedSites ).toMatchObject( [ { identityHost: 'youtube.com', rule: { host: 'youtube.com' } } ] );
		expect( fixture.shell.editor ).not.toBe( previousEditor );
		expect( fixture.shell.enrollment ).not.toBe( previousEnrollment );
		await expect( previousEditor?.update( { theme: ThemeMode.LIGHT } ) ).rejects.toThrow( 'Local data was reset' );
		await expect( fixture.shell.editor?.update( { theme: ThemeMode.LIGHT } ) )
			.resolves.toMatchObject( { theme: ThemeMode.LIGHT } );
		expect( fixture.values[ LocalDataGenerationStorageKey ] ).toMatchObject( { needsOnboarding: false } );
		await expect( actions.requestAccess() ).resolves.toBe( false );
	} );

	it( 'withholds partial journal preferences and sites until a complete generation rebinds them', async () => {
		const fixture = createRestoreFixture();
		await startOnboardingPage( fixture.options );
		const previousEditor = fixture.shell.editor;
		fixture.values[ BackupImportJournalKey ] = {};
		fixture.values[ PreferencesStorageKey.PREFERENCES ] = {
			...DefaultPreferencesDocument, language: Language.JAPANESE, theme: ThemeMode.DARK,
		};
		fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] = {
			...TestEmptyProtectionConfiguration, sites: fixture.request.backup.settings.sites,
		};
		fixture.storageChanges.emit( {
			[ PreferencesStorageKey.PREFERENCES ]: { newValue: fixture.values[ PreferencesStorageKey.PREFERENCES ] },
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				newValue: fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ],
			},
		} );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( fixture.shell.theme ).toBe( ThemeMode.SYSTEM );
		expect( fixture.shell.language ).toBe( Language.ENGLISH );
		expect( fixture.shell.protectedSites ).toEqual( [] );
		Reflect.deleteProperty( fixture.values, BackupImportJournalKey );
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'external', pending: false };
		fixture.storageChanges.emit( { [ BackupImportJournalKey ]: {} } );
		await vi.waitFor( () => {
			expect( fixture.shell.language ).toBe( Language.JAPANESE );
			expect( fixture.shell.theme ).toBe( ThemeMode.DARK );
			expect( fixture.shell.protectedSites ).toHaveLength( 1 );
		} );
		expect( fixture.shell.editor ).not.toBe( previousEditor );
		await expect( fixture.shell.editor?.update( { palette: Palette.PURPLE } ) )
			.resolves.toMatchObject( { palette: Palette.PURPLE } );
	} );

	it( 'removes the coherent browser subscription and import actions after startup failure', async () => {
		const fixture = createRestoreFixture();
		const remove = vi.spyOn( fixture.storageChanges, 'removeListener' );
		fixture.options.loadLocalization = vi.fn().mockRejectedValue( new Error( 'Catalog failed.' ) );
		await expect( startOnboardingPage( fixture.options ) ).rejects.toThrow( 'Catalog failed.' );
		expect( remove ).toHaveBeenCalledOnce();
		expect( fixture.shell.backupActions ).toBeNull();
	} );
} );

/**
 * Creates complete page dependencies with immediate local defaults.
 * @param overrides - Dependencies replaced for one scenario.
 * @return Complete onboarding page options.
 * @since 1.0.0 Initial implementation.
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
	it( 'projects a completed reset notice only after onboarding localization is ready', async () => {
		const localization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const resetCompletion = Promise.withResolvers<boolean>();
		const options = createOptions( {
			loadLocalization: vi.fn().mockReturnValue( localization.promise ),
			readResetCompletion: vi.fn().mockReturnValue( resetCompletion.promise ),
		} );
		const started = startOnboardingPage( options );
		resetCompletion.resolve( true );
		expect( options.shell.resetComplete ).not.toBe( true );
		localization.resolve( TestEnglishLocalizationBundle );
		await started;
		expect( options.shell.resetComplete ).toBe( true );
		expect( options.shell.notificationCopy ).toEqual( {
			dismissNotification: TestEnglishLocalizationBundle.settingsShell.dismissNotification,
			resetComplete: TestEnglishLocalizationBundle.backupResetCopy.allSuccess,
		} );
	} );

	it( 'opens onboarding normally when completion verification is unavailable', async () => {
		const options = createOptions( { readResetCompletion: vi.fn().mockRejectedValue( new Error( 'unavailable' ) ) } );
		await startOnboardingPage( options );
		expect( options.shell.resetComplete ).toBe( false );
		expect( options.shell.startupUnavailable ).toBe( false );
	} );

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
			expectedIntroduction: 'Haz una pausa antes de visitar sitios web adictivos',
			expectedLanguageTag: 'es',
			expectedPortugueseVariantLegend: '\u00bfQu\u00e9 variante de portugu\u00e9s quieres que use TOCus?',
			expectedPrivacyTitle: '100% privado',
			expectedProgressLabel: 'Progreso de la configuraci\u00f3n',
			expectedSpanishVariantLegend: '\u00bfQu\u00e9 variante de espa\u00f1ol quieres que use TOCus?',
			expectedTitle: 'Elige tu idioma',
			language: Language.SPANISH_TU,
		},
		{
			expectedIntroduction: 'Fa\u00e7a uma pausa antes de visitar sites viciantes',
			expectedLanguageTag: 'pt-BR',
			expectedPortugueseVariantLegend: 'Qual variante do portugu\u00eas o TOCus deve usar?',
			expectedPrivacyTitle: '100% privado',
			expectedProgressLabel: 'Progresso da configura\u00e7\u00e3o',
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
			languageTag: Language.JAPANESE,
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
			languageTag: Language.JAPANESE,
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
		expect( shell.copy?.startupErrorTitle ).toBe( "TOCus couldn't finish opening" );
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
		expect( shell.copy?.startupErrorTitle ).toBe( "TOCus couldn't finish opening" );
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
