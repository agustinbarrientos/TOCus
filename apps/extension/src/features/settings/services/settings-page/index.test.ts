import { describe, expect, it, vi } from 'vitest';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
} from '../../../../domains/preferences/types';
import { PreferencesStorageKey } from '../../../../domains/preferences/services/preferences-storage';
import { SettingsPlatform } from '../../components/shell/types';
import { startSettingsPage } from './index';
import {
	type SettingsPageOptions,
	type SettingsPageShell,
	type SettingsPermissionChange,
	type SettingsPermissionChangeListener,
} from './types';

/**
 * Mutable browser permission boundary used by settings page tests.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsPermissions {
	/** Listener for newly granted permissions. */
	addedListener: SettingsPermissionChangeListener | null = null;

	/** Listener for removed permissions. */
	removedListener: SettingsPermissionChangeListener | null = null;

	readonly contains = vi.fn().mockResolvedValue( true );

	readonly getAll = vi.fn().mockResolvedValue( {} );

	readonly remove = vi.fn().mockResolvedValue( true );

	readonly request = vi.fn().mockResolvedValue( true );

	readonly onAdded = {
		/**
		 * Registers the permission-addition listener.
		 * @param listener - Listener to register.
		 * @since 0.1.0 Initial implementation.
		 */
		addListener: ( listener: SettingsPermissionChangeListener ): void => {
			this.addedListener = listener;
		},
		/**
		 * Removes the permission-addition listener.
		 * @param listener - Listener to remove.
		 * @since 0.1.0 Initial implementation.
		 */
		removeListener: ( listener: SettingsPermissionChangeListener ): void => {
			if ( this.addedListener === listener ) {
				this.addedListener = null;
			}
		},
	};

	readonly onRemoved = {
		/**
		 * Registers the permission-removal listener.
		 * @param listener - Listener to register.
		 * @since 0.1.0 Initial implementation.
		 */
		addListener: ( listener: SettingsPermissionChangeListener ): void => {
			this.removedListener = listener;
		},
		/**
		 * Removes the permission-removal listener.
		 * @param listener - Listener to remove.
		 * @since 0.1.0 Initial implementation.
		 */
		removeListener: ( listener: SettingsPermissionChangeListener ): void => {
			if ( this.removedListener === listener ) {
				this.removedListener = null;
			}
		},
	};

	/**
	 * Emits one permission addition.
	 * @param change - Added browser permissions.
	 * @since 0.1.0 Initial implementation.
	 */
	emitAdded( change: SettingsPermissionChange ): void {
		this.addedListener?.( change );
	}

	/**
	 * Emits one permission removal.
	 * @param change - Removed browser permissions.
	 * @since 0.1.0 Initial implementation.
	 */
	emitRemoved( change: SettingsPermissionChange ): void {
		this.removedListener?.( change );
	}
}

/**
 * Mutable browser storage-change source used by settings page tests.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsStorageChanges {
	/** Active local storage listeners. */
	private readonly listeners = new Set<(
		changes: Readonly<Record<string, { readonly newValue?: unknown }>>,
		areaName: string,
	) => void>();

	/**
	 * Reports the number of active local storage listeners.
	 * @return Active local storage listener count.
	 * @since 0.1.0 Initial implementation.
	 */
	get listenerCount(): number {
		return this.listeners.size;
	}

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
	 * Emits one preferences storage change.
	 * @param language - Explicit language stored for settings.
	 * @since 0.1.0 Initial implementation.
	 */
	emitLanguage( language: Language ): void {
		for ( const listener of this.listeners ) {
			listener( {
				[ PreferencesStorageKey.PREFERENCES ]: {
					newValue: { ...DefaultPreferencesDocument, language },
				},
			}, 'local' );
		}
	}
}

/**
 * Mutable operating-system motion preference used by settings tests.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsMotionPreference extends EventTarget {
	/** Whether reduced motion is currently requested. */
	matches = false;
}

/**
 * Executes every browser mutation immediately for page-service tests.
 * @since 0.1.0 Initial implementation.
 */
class ImmediateSettingsMutationLock {
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
 * Observable protected-sites screen used by permission refresh tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectedSitesScreen {
	/** Refreshes current browser access for visible protected sites. */
	readonly refreshAccessState = vi.fn().mockResolvedValue( new Map() );
}

/**
 * Mutable settings shell used by page-service tests.
 * @since 0.1.0 Initial implementation.
 */
class MemorySettingsShell implements SettingsPageShell {
	appearanceCopy = TestEnglishLocalizationBundle.appearance;

	browserLanguage = Language.ENGLISH;

	copy = TestEnglishLocalizationBundle.settingsShell;

	editor: SettingsPageShell[ 'editor' ] = null;

	faviconProvider: SettingsPageShell[ 'faviconProvider' ] = null;

	languageCopy = TestEnglishLocalizationBundle.languageScreen;

	permissionManager: SettingsPageShell[ 'permissionManager' ] = null;

	platform: SettingsPageShell[ 'platform' ] = SettingsPlatform.CHROME;

	preferencesEditor: SettingsPageShell[ 'preferencesEditor' ] = null;

	preferencesPreview: SettingsPageShell[ 'preferencesPreview' ] = null;

	preferencesSource: SettingsPageShell[ 'preferencesSource' ] = null;

	protectedSiteItemCopy = TestEnglishLocalizationBundle.protectedSiteItem;

	protectedSitesCopy = TestEnglishLocalizationBundle.protectedSites;

	scheduleCopy = TestEnglishLocalizationBundle.schedule;

	statisticsCopy = TestEnglishLocalizationBundle.statistics;

	statisticsSource: SettingsPageShell[ 'statisticsSource' ] = null;

	timingCopy = TestEnglishLocalizationBundle.timing;

	/** Rendered protected-sites destination exposed through the shell root. */
	readonly protectedSitesScreen = new MemoryProtectedSitesScreen();

	/** Minimal shadow-root query boundary used by permission refresh. */
	readonly shadowRoot = {
		/**
		 * Returns the rendered Protected Sites screen.
		 * @return Observable Protected Sites screen.
		 * @since 0.1.0 Initial implementation.
		 */
		querySelector: (): unknown => this.protectedSitesScreen,
	};
}

/**
 * Creates complete settings page dependencies with local defaults.
 * @param overrides - Dependencies replaced for one scenario.
 * @return Complete settings page options.
 * @since 0.1.0 Initial implementation.
 */
function createOptions( overrides: Partial<SettingsPageOptions> = {} ): SettingsPageOptions {
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
		extensionRootUrl: 'chrome-extension://extension-id/',
		loadLocalization: vi.fn().mockResolvedValue( TestEnglishLocalizationBundle ),
		locks: new ImmediateSettingsMutationLock(),
		pageWindow: {
			matchMedia: vi.fn().mockReturnValue( new MemorySettingsMotionPreference() ),
		},
		permissions: new MemorySettingsPermissions(),
		platform: SettingsPlatform.CHROME,
		runtime: { sendMessage: vi.fn() },
		shell: new MemorySettingsShell(),
		storageArea: {
			get: vi.fn().mockResolvedValue( {} ),
			set: vi.fn().mockResolvedValue( undefined ),
		},
		storageChanges: new MemorySettingsStorageChanges(),
		supportsCachedFavicons: true,
		...overrides,
	};
}

describe( 'startSettingsPage', () => {
	it( 'wires every settings dependency before revealing localized preferences', async () => {
		const shell = new MemorySettingsShell();
		const removeProperty = vi.fn();
		const localization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const loadLocalization = vi.fn().mockReturnValue( localization.promise );
		const options = createOptions( {
			browserLanguage: Language.SPANISH_VOS,
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization,
			platform: SettingsPlatform.FIREFOX,
			shell,
			storageArea: {
				get: vi.fn().mockResolvedValue( {
					[ PreferencesStorageKey.PREFERENCES ]: {
						...DefaultPreferencesDocument,
						language: Language.FRENCH,
						palette: Palette.PURPLE,
					},
				} ),
				set: vi.fn().mockResolvedValue( undefined ),
			},
		} );
		const start = startSettingsPage( options );

		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledWith( Language.FRENCH );
		} );
		expect( removeProperty ).not.toHaveBeenCalled();
		localization.resolve( TestEnglishLocalizationBundle );
		await start;

		expect( shell.browserLanguage ).toBe( Language.SPANISH_VOS );
		expect( shell.platform ).toBe( SettingsPlatform.FIREFOX );
		expect( shell.editor ).not.toBeNull();
		expect( shell.preferencesEditor ).not.toBeNull();
		expect( shell.preferencesPreview ).toBe( shell.preferencesSource );
		expect( shell.statisticsSource ).not.toBeNull();
		expect( shell.copy ).toBe( TestEnglishLocalizationBundle.settingsShell );
		expect( shell.appearanceCopy ).toBe( TestEnglishLocalizationBundle.appearance );
		expect( shell.languageCopy ).toBe( TestEnglishLocalizationBundle.languageScreen );
		expect( shell.protectedSitesCopy ).toBe( TestEnglishLocalizationBundle.protectedSites );
		expect( shell.protectedSiteItemCopy ).toBe( TestEnglishLocalizationBundle.protectedSiteItem );
		expect( shell.scheduleCopy ).toBe( TestEnglishLocalizationBundle.schedule );
		expect( shell.statisticsCopy ).toBe( TestEnglishLocalizationBundle.statistics );
		expect( shell.timingCopy ).toBe( TestEnglishLocalizationBundle.timing );
		expect( removeProperty ).toHaveBeenNthCalledWith( 1, 'color-scheme' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 2, 'background' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 3, 'visibility' );
	} );

	it( 'applies the latest live language to every localized settings surface', async () => {
		const shell = new MemorySettingsShell();
		const storageChanges = new MemorySettingsStorageChanges();
		const loadLocalization = vi.fn().mockResolvedValue( TestEnglishLocalizationBundle );

		await startSettingsPage( createOptions( { loadLocalization, shell, storageChanges } ) );
		loadLocalization.mockClear();
		storageChanges.emitLanguage( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledWith( Language.JAPANESE );
		} );

		expect( shell.copy ).toBe( TestEnglishLocalizationBundle.settingsShell );
	} );

	it( 'refreshes protected-site access only after relevant permission changes', async () => {
		const permissions = new MemorySettingsPermissions();
		const shell = new MemorySettingsShell();

		await startSettingsPage( createOptions( { permissions, shell } ) );
		permissions.emitAdded( { permissions: [ 'notifications' ] } );
		permissions.emitRemoved( { origins: [] } );
		expect( shell.protectedSitesScreen.refreshAccessState ).not.toHaveBeenCalled();

		permissions.emitAdded( { permissions: [ 'webNavigation' ] } );
		permissions.emitRemoved( { origins: [ '*://*.example.com/*' ] } );
		expect( shell.protectedSitesScreen.refreshAccessState ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'releases page observers and reveals settings when startup fails', async () => {
		const permissions = new MemorySettingsPermissions();
		const storageChanges = new MemorySettingsStorageChanges();
		const removeProperty = vi.fn();
		const startupError = new Error( 'Packaged copy unavailable.' );
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization: vi.fn().mockRejectedValue( startupError ),
			permissions,
			storageChanges,
		} );

		await expect( startSettingsPage( options ) ).rejects.toBe( startupError );
		expect( permissions.addedListener ).toBeNull();
		expect( permissions.removedListener ).toBeNull();
		expect( storageChanges.listenerCount ).toBe( 0 );
		expect( removeProperty ).toHaveBeenNthCalledWith( 1, 'color-scheme' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 2, 'background' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 3, 'visibility' );
	} );

	it( 'reveals settings when construction fails before observers exist', async () => {
		const removeProperty = vi.fn();
		const startupError = new Error( 'Motion preference unavailable.' );
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			pageWindow: {
				matchMedia: vi.fn().mockImplementation( () => {
					throw startupError;
				} ),
			},
		} );

		await expect( startSettingsPage( options ) ).rejects.toBe( startupError );
		expect( removeProperty ).toHaveBeenNthCalledWith( 1, 'color-scheme' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 2, 'background' );
		expect( removeProperty ).toHaveBeenNthCalledWith( 3, 'visibility' );
	} );

	it( 'retains current settings copy when a live localization request fails', async () => {
		const loadLocalization = vi.fn().mockResolvedValue( TestEnglishLocalizationBundle );
		const shell = new MemorySettingsShell();
		const storageChanges = new MemorySettingsStorageChanges();

		await startSettingsPage( createOptions( { loadLocalization, shell, storageChanges } ) );
		loadLocalization.mockRejectedValueOnce( new Error( 'Live packaged copy unavailable.' ) );
		storageChanges.emitLanguage( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledWith( Language.JAPANESE );
		} );

		storageChanges.emitLanguage( Language.FRENCH );
		await vi.waitFor( () => {
			expect( loadLocalization ).toHaveBeenCalledWith( Language.FRENCH );
		} );
		expect( shell.copy ).toBe( TestEnglishLocalizationBundle.settingsShell );
	} );

	it( 'contains terminal settings startup failures', async () => {
		const removeProperty = vi.fn();
		const options = createOptions( {
			document: {
				documentElement: {
					setAttribute: vi.fn(),
					style: { removeProperty },
				},
				title: 'TOCus',
			},
			loadLocalization: vi.fn().mockRejectedValue( new Error( 'Startup failed.' ) ),
		} );
		const { bootstrapSettingsPage } = await import( './index' );

		await expect( bootstrapSettingsPage( options ) ).resolves.toBeUndefined();
		expect( removeProperty ).toHaveBeenCalledWith( 'visibility' );
	} );
} );
