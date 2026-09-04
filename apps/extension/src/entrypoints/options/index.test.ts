import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type PreferencesEditorOptions,
	type PreferencesMutation,
} from '../../domains/preferences/services/preferences-editor';
import {
	type ProtectionConfigurationEditorOptions,
	type ProtectionConfigurationMutation,
} from '../../domains/protection/services/protection-configuration-editor';
import { Language } from '../../domains/preferences/types';
import { type PreferencesLanguageChangeListener } from '../../features/preferences/services/preferences-controller/types';

/**
 * Browser permission change consumed by the options entrypoint fixture.
 * @since 0.1.0 Initial implementation.
 */
interface TestPermissionChange {
	permissions?: string[];
	origins?: string[];
}

/**
 * Browser permission-change listener captured by the options entrypoint fixture.
 * @param change - Browser permission change delivered to the listener.
 * @return No return value.
 * @since 0.1.0 Initial implementation.
 */
type TestPermissionChangeListener = ( change: TestPermissionChange ) => void;

/**
 * Hoisted entrypoint dependencies used by options composition tests.
 * @since 0.1.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal Protected Sites screen used to observe access refreshes.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestProtectedSitesScreen {
		/**
		 * Refreshes rendered access from the current permission snapshot.
		 * @since 0.1.0 Initial implementation.
		 */
		readonly refreshAccessState = vi.fn<() => Promise<ReadonlyMap<string, boolean> | null>>();
	}

	/**
	 * Minimal settings shell used to expose the rendered Protected Sites screen.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestSettingsShell {
		/** Localized Appearance screen copy. */
		appearanceCopy: unknown;

		/** Browser-derived language shown by Language settings. */
		browserLanguage: unknown;

		/** Localized navigation copy. */
		copy: unknown;

		/**
		 * Protection configuration editor forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		editor: unknown;

		/**
		 * Favicon provider forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		faviconProvider: unknown;

		/** Localized Language screen copy. */
		languageCopy: unknown;

		/**
		 * Permission manager forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		permissionManager: unknown;

		/**
		 * Preferences editor forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		preferencesEditor: unknown;

		/**
		 * Live preferences preview forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		preferencesPreview: unknown;

		/**
		 * Preferences listener source forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		preferencesSource: unknown;

		/** Localized Protected Site item copy. */
		protectedSiteItemCopy: unknown;

		/** Localized Protected Sites screen copy. */
		protectedSitesCopy: unknown;

		/** Localized Schedule screen copy. */
		scheduleCopy: unknown;

		/** Localized Statistics screen copy. */
		statisticsCopy: unknown;

		/**
		 * Statistics source forwarded to the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		statisticsSource: unknown;

		/** Localized Timing screen copy. */
		timingCopy: unknown;

		/**
		 * Browser family rendered by the settings shell.
		 * @since 0.1.0 Initial implementation.
		 */
		platform = '';

		/**
		 * Minimal shadow-root contract exposed by the fixture shell.
		 * @since 0.1.0 Initial implementation.
		 */
		readonly shadowRoot: {
			/**
			 * Returns the rendered Protected Sites screen.
			 * @return Protected Sites screen owned by the fixture shell.
			 * @since 0.1.0 Initial implementation.
			 */
			querySelector: () => TestProtectedSitesScreen;
		};

		/**
		 * Creates a settings shell around one rendered Protected Sites screen.
		 * @param protectedSitesScreen - Screen returned from the shell shadow root.
		 * @since 0.1.0 Initial implementation.
		 */
		constructor( protectedSitesScreen: TestProtectedSitesScreen ) {
			this.shadowRoot = {
				/**
				 * Returns the rendered Protected Sites screen.
				 * @return Protected Sites screen owned by the fixture shell.
				 * @since 0.1.0 Initial implementation.
				 */
				querySelector: () => protectedSitesScreen,
			};
		}
	}

	const permissionAddition: { listener: TestPermissionChangeListener | null } = { listener: null };
	const permissionRemoval: { listener: TestPermissionChangeListener | null } = { listener: null };
	const initialLocalization = {
		appearance: { value: 'Localized appearance copy' },
		document: { settingsTitle: 'Localized settings title' },
		languageTag: 'fr',
		languageScreen: { value: 'Localized language copy' },
		protectedSiteItem: { value: 'Localized protected-site item copy' },
		protectedSites: { value: 'Localized protected-sites copy' },
		schedule: { value: 'Localized schedule copy' },
		settingsShell: { value: 'Localized navigation copy' },
		statistics: { value: 'Localized statistics copy' },
		timing: { value: 'Localized timing copy' },
	};
	const liveLocalization = {
		appearance: { value: 'Live appearance copy' },
		document: { settingsTitle: 'Live settings title' },
		languageTag: 'ja',
		languageScreen: { value: 'Live language copy' },
		protectedSiteItem: { value: 'Live protected-site item copy' },
		protectedSites: { value: 'Live protected-sites copy' },
		schedule: { value: 'Live schedule copy' },
		settingsShell: { value: 'Live navigation copy' },
		statistics: { value: 'Live statistics copy' },
		timing: { value: 'Live timing copy' },
	};
	const languageChangeListener: { value: PreferencesLanguageChangeListener | null } = {
		value: null,
	};
	const removeDocumentVisibility = vi.fn();
	const preferencesController = {
		addLanguageChangeListener: vi.fn<( listener: PreferencesLanguageChangeListener ) => void>(
			( listener ) => {
				languageChangeListener.value = listener;
			},
		),
		apply: vi.fn(),
		language: 'fr',
		removeLanguageChangeListener: vi.fn(),
		start: vi.fn().mockResolvedValue( undefined ),
		stop: vi.fn(),
	};
	const preferencesStorage = {};
	const preferencesEditor = {};
	const statisticsClient = {};
	const storageArea = {};
	const storageChanges = {};
	const runtimeApi = {
		getURL: vi.fn().mockReturnValue( 'chrome-extension://extension-id/' ),
		sendMessage: vi.fn(),
	};

	return {
		ComponentProtectedSitesScreen: TestProtectedSitesScreen,
		ComponentSettingsShell: TestSettingsShell,
		addPermissionAdditionListener: vi.fn<( listener: TestPermissionChangeListener ) => void>( ( listener ) => {
			permissionAddition.listener = listener;
		} ),
		addPermissionRemovalListener: vi.fn<( listener: TestPermissionChangeListener ) => void>( ( listener ) => {
			permissionRemoval.listener = listener;
		} ),
		createEditor: vi.fn<( options: ProtectionConfigurationEditorOptions ) => unknown>()
			.mockReturnValue( {} ),
		createFaviconProvider: vi.fn().mockReturnValue( {} ),
		loadLocalizationBundle: vi.fn<( language: string ) => Promise<unknown>>( ( language ) =>
			Promise.resolve( language === 'ja' ? liveLocalization : initialLocalization ),
		),
		createPermissionManager: vi.fn().mockReturnValue( {} ),
		createPreferencesEditor: vi.fn<( options: PreferencesEditorOptions ) => unknown>()
			.mockReturnValue( preferencesEditor ),
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorage: vi.fn().mockReturnValue( preferencesStorage ),
		createStorage: vi.fn().mockReturnValue( {} ),
		createStatisticsClient: vi.fn().mockReturnValue( statisticsClient ),
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		initialLocalization,
		languageChangeListener,
		liveLocalization,
		permissionAddition,
		permissionRemoval,
		preferencesController,
		preferencesEditor,
		preferencesStorage,
		removeDocumentVisibility,
		requestPreferenceLock: vi.fn<(
			name: string,
			mutation: PreferencesMutation<unknown>,
		) => Promise<unknown>>( ( _name, mutation ) => mutation() ),
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		storageArea,
		storageChanges,
		statisticsClient,
		runtimeApi,
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: entrypointMocks.getUILanguage },
		permissions: {
			onAdded: { addListener: entrypointMocks.addPermissionAdditionListener },
			onRemoved: { addListener: entrypointMocks.addPermissionRemovalListener },
		},
		runtime: entrypointMocks.runtimeApi,
		storage: { local: entrypointMocks.storageArea, onChanged: entrypointMocks.storageChanges },
	},
} ) );
vi.mock( '../../domains/protection/services', () => ( {
	ProtectionConfigurationStorageKey: { CONFIGURATION: 'tocus.protection.configuration.v1' },
	createProtectionConfigurationEditor: entrypointMocks.createEditor,
	createProtectionConfigurationStorageService: entrypointMocks.createStorage,
} ) );
vi.mock( '../../domains/preferences/services', () => ( {
	PreferencesStorageKey: { PREFERENCES: 'tocus.preferences.v1' },
	createPreferencesEditor: entrypointMocks.createPreferencesEditor,
	createPreferencesStorageService: entrypointMocks.createPreferencesStorage,
} ) );
vi.mock( '../../domains/preferences/utils', () => ( {
	resolveLanguage: entrypointMocks.resolveLanguage,
} ) );
vi.mock( '../../localization', () => ( {
	loadLocalizationBundle: entrypointMocks.loadLocalizationBundle,
} ) );
vi.mock( '../../features/preferences/services/preferences-controller', () => ( {
	createPreferencesController: entrypointMocks.createPreferencesController,
} ) );
vi.mock( '../../features/protected-sites/components/screen', () => ( {
	ComponentProtectedSitesScreen: entrypointMocks.ComponentProtectedSitesScreen,
} ) );
vi.mock( '../../features/protected-sites/services/site-favicon-provider', () => ( {
	createSiteFaviconProvider: entrypointMocks.createFaviconProvider,
} ) );
vi.mock( '../../features/protected-sites/services/site-permission-manager', () => ( {
	createSitePermissionManager: entrypointMocks.createPermissionManager,
} ) );
vi.mock( '../../features/settings/components/shell', () => ( {
	ComponentSettingsShell: entrypointMocks.ComponentSettingsShell,
} ) );
vi.mock( '../../features/statistics/services/statistics-client', () => ( {
	createStatisticsClient: entrypointMocks.createStatisticsClient,
} ) );

/**
 * Provides an inert callback before a pending preference start captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignorePreferencesStartResolution(): undefined {
	return undefined;
}

describe( 'options entrypoint permission refresh', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		entrypointMocks.permissionAddition.listener = null;
		entrypointMocks.permissionRemoval.listener = null;
		entrypointMocks.languageChangeListener.value = null;
		entrypointMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			Promise.resolve( language === 'ja'
				? entrypointMocks.liveLocalization
				: entrypointMocks.initialLocalization ),
		);
		entrypointMocks.preferencesController.language = 'fr';
		entrypointMocks.preferencesController.start.mockResolvedValue( undefined );
		vi.stubGlobal( 'window', {
			matchMedia: vi.fn().mockReturnValue( {} ),
		} );
		vi.stubGlobal( 'crypto', {
			randomUUID: vi.fn().mockReturnValue( 'fixture-id' ),
		} );
		vi.stubGlobal( 'navigator', {
			locks: { request: entrypointMocks.requestPreferenceLock },
		} );
	} );

	afterEach( () => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	} );

	it( 'ignores removal events unrelated to protected-site access', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );

		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: entrypointMocks.removeDocumentVisibility } },
			querySelector: vi.fn().mockReturnValue( settingsShell ),
		} );
		await import( './index' );

		entrypointMocks.permissionRemoval.listener?.( { permissions: [ 'notifications' ] } );
		entrypointMocks.permissionRemoval.listener?.( { origins: [] } );

		expect( protectedSitesScreen.refreshAccessState ).not.toHaveBeenCalled();
	} );

	it( 'projects local preferences and exposes them to the Appearance screen', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );
		const appearanceTarget = {
			style: { removeProperty: entrypointMocks.removeDocumentVisibility },
		};
		const motionPreference = {};
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;

		entrypointMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );

		vi.stubGlobal( 'window', {
			matchMedia: vi.fn().mockReturnValue( motionPreference ),
		} );
		const documentTarget = {
			documentElement: appearanceTarget,
			querySelector: vi.fn().mockReturnValue( settingsShell ),
			title: 'Original settings title',
		};

		vi.stubGlobal( 'document', documentTarget );
		await import( './index' );

		expect( entrypointMocks.getUILanguage ).toHaveBeenCalledOnce();
		expect( entrypointMocks.resolveLanguage ).toHaveBeenCalledWith( 'es-AR' );
		expect( entrypointMocks.createPreferencesStorage ).toHaveBeenCalledWith( {
			area: entrypointMocks.storageArea,
		} );
		expect( entrypointMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget,
			browserLanguage: Language.SPANISH_VOS,
			storage: entrypointMocks.preferencesStorage,
			storageChanges: entrypointMocks.storageChanges,
			systemMotionPreference: motionPreference,
		} );
		const editorOptions = entrypointMocks.createPreferencesEditor.mock.calls[ 0 ]?.[ 0 ];
		const protectionEditorOptions = entrypointMocks.createEditor.mock.calls[ 0 ]?.[ 0 ];

		if ( editorOptions === undefined || protectionEditorOptions === undefined ) {
			throw new TypeError( 'Expected local editor options.' );
		}
		expect( editorOptions.storage ).toBe( entrypointMocks.preferencesStorage );
		expect( protectionEditorOptions.createIndependentScopeId() ).toBe( 'scope_fixture-id' );
		expect( protectionEditorOptions.createMeasurementRevision() ).toBe( 'revision_fixture-id' );

		const mutation = vi.fn<PreferencesMutation<string>>().mockResolvedValue( 'updated' );
		const protectionMutation = vi.fn<ProtectionConfigurationMutation>().mockRejectedValue(
			new Error( 'Mutation stopped.' ),
		);

		await expect( editorOptions.coordinateMutation( mutation ) ).resolves.toBe( 'updated' );
		expect( entrypointMocks.requestPreferenceLock ).toHaveBeenCalledWith(
			'tocus.preferences.v1',
			mutation,
		);
		await expect(
			protectionEditorOptions.coordinateMutation( protectionMutation ),
		).rejects.toThrow( 'Mutation stopped.' );
		expect( entrypointMocks.requestPreferenceLock ).toHaveBeenCalledWith(
			'tocus.protection.configuration.v1',
			protectionMutation,
		);
		expect( entrypointMocks.preferencesController.start ).toHaveBeenCalledOnce();
		expect( entrypointMocks.preferencesController.addLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( entrypointMocks.loadLocalizationBundle ).not.toHaveBeenCalled();
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await vi.waitFor( () => {
			expect( settingsShell.copy ).toBe( entrypointMocks.initialLocalization.settingsShell );
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				1,
				'color-scheme',
			);
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				2,
				'background',
			);
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				3,
				'visibility',
			);
		} );
		expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		expect( documentTarget.title ).toBe( 'Localized settings title' );
		expect( settingsShell.appearanceCopy ).toBe( entrypointMocks.initialLocalization.appearance );
		expect( settingsShell.browserLanguage ).toBe( Language.SPANISH_VOS );
		expect( settingsShell.languageCopy ).toBe( entrypointMocks.initialLocalization.languageScreen );
		expect( settingsShell.protectedSitesCopy ).toBe( entrypointMocks.initialLocalization.protectedSites );
		expect( settingsShell.protectedSiteItemCopy )
			.toBe( entrypointMocks.initialLocalization.protectedSiteItem );
		expect( settingsShell.scheduleCopy ).toBe( entrypointMocks.initialLocalization.schedule );
		expect( settingsShell.statisticsCopy ).toBe( entrypointMocks.initialLocalization.statistics );
		expect( settingsShell.timingCopy ).toBe( entrypointMocks.initialLocalization.timing );
		expect( settingsShell.preferencesEditor ).toBe( entrypointMocks.preferencesEditor );
		expect( settingsShell.preferencesPreview ).toBe( entrypointMocks.preferencesController );
		expect( settingsShell.preferencesSource ).toBe( entrypointMocks.preferencesController );
		expect( entrypointMocks.createStatisticsClient ).toHaveBeenCalledWith( {
			runtime: entrypointMocks.runtimeApi,
			storageChanges: entrypointMocks.storageChanges,
		} );
		expect( settingsShell.statisticsSource ).toBe( entrypointMocks.statisticsClient );
	} );

	it( 'applies live language changes to every localized settings surface', async () => {
		const settingsShell = new entrypointMocks.ComponentSettingsShell(
			new entrypointMocks.ComponentProtectedSitesScreen(),
		);
		const documentTarget = {
			documentElement: {
				style: { removeProperty: entrypointMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( settingsShell ),
			title: 'Original settings title',
		};

		vi.stubGlobal( 'document', documentTarget );
		await import( './index' );
		await vi.waitFor( () => {
			expect( settingsShell.copy ).toBe( entrypointMocks.initialLocalization.settingsShell );
		} );

		entrypointMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( settingsShell.copy ).toBe( entrypointMocks.liveLocalization.settingsShell );
		} );

		expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( documentTarget.title ).toBe( 'Live settings title' );
		expect( settingsShell.appearanceCopy ).toBe( entrypointMocks.liveLocalization.appearance );
		expect( settingsShell.languageCopy ).toBe( entrypointMocks.liveLocalization.languageScreen );
		expect( settingsShell.protectedSitesCopy ).toBe( entrypointMocks.liveLocalization.protectedSites );
		expect( settingsShell.protectedSiteItemCopy ).toBe( entrypointMocks.liveLocalization.protectedSiteItem );
		expect( settingsShell.scheduleCopy ).toBe( entrypointMocks.liveLocalization.schedule );
		expect( settingsShell.statisticsCopy ).toBe( entrypointMocks.liveLocalization.statistics );
		expect( settingsShell.timingCopy ).toBe( entrypointMocks.liveLocalization.timing );
	} );

	it( 'keeps settings hidden until the latest requested language is projected', async () => {
		const settingsShell = new entrypointMocks.ComponentSettingsShell(
			new entrypointMocks.ComponentProtectedSitesScreen(),
		);
		const frenchLocalization = Promise.withResolvers<unknown>();
		const documentTarget = {
			documentElement: {
				style: { removeProperty: entrypointMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( settingsShell ),
			title: 'Original settings title',
		};

		entrypointMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			language === Language.FRENCH
				? frenchLocalization.promise
				: Promise.resolve( entrypointMocks.liveLocalization ),
		);
		vi.stubGlobal( 'document', documentTarget );
		await import( './index' );
		await vi.waitFor( () => {
			expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		} );

		entrypointMocks.preferencesController.language = Language.JAPANESE;
		entrypointMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( settingsShell.copy ).toBe( entrypointMocks.liveLocalization.settingsShell );
		} );
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();

		frenchLocalization.resolve( entrypointMocks.initialLocalization );
		await vi.waitFor( () => {
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
		} );
		expect( settingsShell.copy ).toBe( entrypointMocks.liveLocalization.settingsShell );
		expect( documentTarget.title ).toBe( 'Live settings title' );
	} );

	it( 'refreshes access after navigation or host permission removal', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );

		protectedSitesScreen.refreshAccessState.mockResolvedValue( new Map() );
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: entrypointMocks.removeDocumentVisibility } },
			querySelector: vi.fn().mockReturnValue( settingsShell ),
		} );
		await import( './index' );

		entrypointMocks.permissionRemoval.listener?.( { permissions: [ 'webNavigation' ] } );
		entrypointMocks.permissionRemoval.listener?.( { origins: [ '*://*.example.com/*' ] } );

		expect( protectedSitesScreen.refreshAccessState ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'refreshes access after navigation or host permission addition', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );

		protectedSitesScreen.refreshAccessState.mockResolvedValue( new Map() );
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: entrypointMocks.removeDocumentVisibility } },
			querySelector: vi.fn().mockReturnValue( settingsShell ),
		} );
		await import( './index' );

		entrypointMocks.permissionAddition.listener?.( { permissions: [ 'webNavigation' ] } );
		entrypointMocks.permissionAddition.listener?.( { origins: [ '*://*.example.com/*' ] } );

		expect( protectedSitesScreen.refreshAccessState ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'identifies the Safari settings surface', async () => {
		const settingsShell = new entrypointMocks.ComponentSettingsShell(
			new entrypointMocks.ComponentProtectedSitesScreen(),
		);

		vi.stubEnv( 'SAFARI', 'true' );
		vi.stubEnv( 'FIREFOX', '' );
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: entrypointMocks.removeDocumentVisibility } },
			querySelector: vi.fn().mockReturnValue( settingsShell ),
		} );
		await import( './index' );

		expect( settingsShell.platform ).toBe( 'safari' );
	} );

	it( 'identifies the Firefox settings surface', async () => {
		const settingsShell = new entrypointMocks.ComponentSettingsShell(
			new entrypointMocks.ComponentProtectedSitesScreen(),
		);

		vi.stubEnv( 'SAFARI', '' );
		vi.stubEnv( 'FIREFOX', 'true' );
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: entrypointMocks.removeDocumentVisibility } },
			querySelector: vi.fn().mockReturnValue( settingsShell ),
		} );
		await import( './index' );

		expect( settingsShell.platform ).toBe( 'firefox' );
	} );

	it( 'fails clearly when the settings shell is missing', async () => {
		vi.stubGlobal( 'document', {
			querySelector: vi.fn().mockReturnValue( null ),
		} );

		await expect( import( './index' ) ).rejects.toThrow(
			'Expected the options page to contain the settings shell.',
		);
	} );
} );
