import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

	return {
		ComponentProtectedSitesScreen: TestProtectedSitesScreen,
		ComponentSettingsShell: TestSettingsShell,
		addPermissionAdditionListener: vi.fn<( listener: TestPermissionChangeListener ) => void>( ( listener ) => {
			permissionAddition.listener = listener;
		} ),
		addPermissionRemovalListener: vi.fn<( listener: TestPermissionChangeListener ) => void>( ( listener ) => {
			permissionRemoval.listener = listener;
		} ),
		createEditor: vi.fn().mockReturnValue( {} ),
		createFaviconProvider: vi.fn().mockReturnValue( {} ),
		createPermissionManager: vi.fn().mockReturnValue( {} ),
		createStorage: vi.fn().mockReturnValue( {} ),
		permissionAddition,
		permissionRemoval,
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
		storage: { local: {} },
	},
} ) );
vi.mock( '../../domains/protection/services', () => ( {
	ProtectionConfigurationStorageKey: { CONFIGURATION: 'tocus.protection.configuration.v1' },
	createProtectionConfigurationEditor: entrypointMocks.createEditor,
	createProtectionConfigurationStorageService: entrypointMocks.createStorage,
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

describe( 'options entrypoint permission refresh', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		entrypointMocks.permissionAddition.listener = null;
		entrypointMocks.permissionRemoval.listener = null;
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
	} );

	it( 'ignores removal events unrelated to protected-site access', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );

		vi.stubGlobal( 'document', { querySelector: vi.fn().mockReturnValue( settingsShell ) } );
		await import( './index' );

		entrypointMocks.permissionRemoval.listener?.( { permissions: [ 'notifications' ] } );
		entrypointMocks.permissionRemoval.listener?.( { origins: [] } );

		expect( protectedSitesScreen.refreshAccessState ).not.toHaveBeenCalled();
	} );

	it( 'refreshes access after navigation or host permission removal', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );

		protectedSitesScreen.refreshAccessState.mockResolvedValue( new Map() );
		vi.stubGlobal( 'document', { querySelector: vi.fn().mockReturnValue( settingsShell ) } );
		await import( './index' );

		entrypointMocks.permissionRemoval.listener?.( { permissions: [ 'webNavigation' ] } );
		entrypointMocks.permissionRemoval.listener?.( { origins: [ '*://*.example.com/*' ] } );

		expect( protectedSitesScreen.refreshAccessState ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'refreshes access after navigation or host permission addition', async () => {
		const protectedSitesScreen = new entrypointMocks.ComponentProtectedSitesScreen();
		const settingsShell = new entrypointMocks.ComponentSettingsShell( protectedSitesScreen );

		protectedSitesScreen.refreshAccessState.mockResolvedValue( new Map() );
		vi.stubGlobal( 'document', { querySelector: vi.fn().mockReturnValue( settingsShell ) } );
		await import( './index' );

		entrypointMocks.permissionAddition.listener?.( { permissions: [ 'webNavigation' ] } );
		entrypointMocks.permissionAddition.listener?.( { origins: [ '*://*.example.com/*' ] } );

		expect( protectedSitesScreen.refreshAccessState ).toHaveBeenCalledTimes( 2 );
	} );
} );
