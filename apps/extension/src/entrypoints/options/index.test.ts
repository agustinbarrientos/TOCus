import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type PreferencesEditorOptions,
	type PreferencesMutation,
} from '../../domains/preferences/services/preferences-editor';
import {
	type ProtectionConfigurationEditorOptions,
	type ProtectionConfigurationMutation,
} from '../../domains/protection/services/protection-configuration-editor';

/** Browser permission change consumed by the options entrypoint fixture. */
interface TestPermissionChange {
	permissions?: string[];
	origins?: string[];
}

/** Browser permission-change listener captured by the options entrypoint fixture. */
type TestPermissionChangeListener = ( change: TestPermissionChange ) => void;

const entrypointMocks = vi.hoisted( () => {
	/** Minimal Protected Sites screen used to observe access refreshes. */
	class TestProtectedSitesScreen {
		/** Refreshes rendered access from the current permission snapshot. */
		readonly refreshAccessState = vi.fn<() => Promise<ReadonlyMap<string, boolean> | null>>();
	}

	/** Minimal settings shell used to expose the rendered Protected Sites screen. */
	class TestSettingsShell {
		editor: unknown;

		faviconProvider: unknown;

		permissionManager: unknown;

		preferencesEditor: unknown;

		preferencesPreview: unknown;

		preferencesSource: unknown;

		platform = '';

		readonly shadowRoot: { querySelector: () => TestProtectedSitesScreen };

		/**
		 * Creates a settings shell around one rendered Protected Sites screen.
		 * @param protectedSitesScreen - Screen returned from the shell shadow root.
		 */
		constructor( protectedSitesScreen: TestProtectedSitesScreen ) {
			this.shadowRoot = {
				/**
				 * Returns the rendered Protected Sites screen.
				 * @return Protected Sites screen owned by the fixture shell.
				 */
				querySelector: () => protectedSitesScreen,
			};
		}
	}

	const permissionAddition = { listener: null as TestPermissionChangeListener | null };
	const permissionRemoval = { listener: null as TestPermissionChangeListener | null };
	const removeDocumentVisibility = vi.fn();
	const preferencesController = {
		apply: vi.fn(),
		start: vi.fn().mockResolvedValue( undefined ),
		stop: vi.fn(),
	};
	const preferencesStorage = {};
	const preferencesEditor = {};
	const storageArea = {};
	const storageChanges = {};

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
		createPermissionManager: vi.fn().mockReturnValue( {} ),
		createPreferencesEditor: vi.fn<( options: PreferencesEditorOptions ) => unknown>()
			.mockReturnValue( preferencesEditor ),
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorage: vi.fn().mockReturnValue( preferencesStorage ),
		createStorage: vi.fn().mockReturnValue( {} ),
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
		storageArea,
		storageChanges,
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		permissions: {
			onAdded: { addListener: entrypointMocks.addPermissionAdditionListener },
			onRemoved: { addListener: entrypointMocks.addPermissionRemovalListener },
		},
		runtime: { getURL: vi.fn().mockReturnValue( 'chrome-extension://extension-id/' ) },
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
		vi.stubGlobal( 'document', {
			documentElement: appearanceTarget,
			querySelector: vi.fn().mockReturnValue( settingsShell ),
		} );
		await import( './index' );

		expect( entrypointMocks.createPreferencesStorage ).toHaveBeenCalledWith( {
			area: entrypointMocks.storageArea,
		} );
		expect( entrypointMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget,
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
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await vi.waitFor( () => {
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
		expect( settingsShell.preferencesEditor ).toBe( entrypointMocks.preferencesEditor );
		expect( settingsShell.preferencesPreview ).toBe( entrypointMocks.preferencesController );
		expect( settingsShell.preferencesSource ).toBe( entrypointMocks.preferencesController );
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
