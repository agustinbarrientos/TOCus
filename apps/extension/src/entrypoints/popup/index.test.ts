import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const entrypointMocks = vi.hoisted( () => {
	/**
	 * Popup shell constructor used by the entrypoint boundary test.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestPopupShell {
		readonly testMarker = true;
	}

	const shell = new TestPopupShell();
	const preferencesStorage = {};
	const preferencesController = {};
	const protectionEditor = {};
	const enrollment = {};
	const enrollmentClient = {};
	const faviconProvider = {};
	const currentTabReader = {};
	const statusClient = {};
	const storageArea = {};
	const storageChanges = {};
	const permissions = {};
	const runtime = {
		getURL: vi.fn( ( path: string ) => `chrome-extension://extension-id${ path }` ),
	};
	const tabs = {};
	const browser = {
		i18n: { getUILanguage: vi.fn().mockReturnValue( 'es-AR' ) },
		permissions,
		runtime,
		storage: { local: storageArea, onChanged: storageChanges },
		tabs,
	};

	return {
		bootstrapPopupPage: vi.fn().mockResolvedValue( undefined ),
		browser,
		createBrowserProtectionConfigurationEditor: vi.fn().mockReturnValue( {
			editor: protectionEditor,
		} ),
		createCurrentTabReader: vi.fn().mockReturnValue( currentTabReader ),
		createEnglishLocalizationBundle: vi.fn().mockReturnValue( { language: 'en' } ),
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorageService: vi.fn().mockReturnValue( preferencesStorage ),
		createProtectedSiteEnrollmentService: vi.fn().mockReturnValue( enrollment ),
		createPopupEnrollmentClient: vi.fn().mockReturnValue( enrollmentClient ),
		createSiteFaviconProvider: vi.fn().mockReturnValue( faviconProvider ),
		createSitePermissionManager: vi.fn().mockReturnValue( { permissions: true } ),
		createPopupStatusClient: vi.fn().mockReturnValue( statusClient ),
		currentTabReader,
		document: { querySelector: vi.fn().mockReturnValue( shell ) },
		enrollment,
		enrollmentClient,
		faviconProvider,
		loadLocalizationBundle: vi.fn(),
		preferencesController,
		preferencesStorage,
		protectionEditor,
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		shell,
		statusClient,
		TestPopupShell,
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( { browser: entrypointMocks.browser } ) );
vi.mock( '../../domains/preferences/services/preferences-storage', () => ( {
	createPreferencesStorageService: entrypointMocks.createPreferencesStorageService,
} ) );
vi.mock( '../../domains/preferences/utils', () => ( {
	resolveLanguage: entrypointMocks.resolveLanguage,
} ) );
vi.mock( '../../domains/protection/services/browser-protection-configuration-editor', () => ( {
	createBrowserProtectionConfigurationEditor:
		entrypointMocks.createBrowserProtectionConfigurationEditor,
} ) );
vi.mock( '../../features/preferences/services/preferences-controller', () => ( {
	createPreferencesController: entrypointMocks.createPreferencesController,
} ) );
vi.mock( '../../features/protected-sites/services/protected-site-enrollment', () => ( {
	createProtectedSiteEnrollmentService: entrypointMocks.createProtectedSiteEnrollmentService,
} ) );
vi.mock( '../../features/protected-sites/services/site-favicon-provider', () => ( {
	createSiteFaviconProvider: entrypointMocks.createSiteFaviconProvider,
} ) );
vi.mock( '../../features/protected-sites/services/site-permission-manager', () => ( {
	createSitePermissionManager: entrypointMocks.createSitePermissionManager,
} ) );
vi.mock( '../../features/popup/components/shell', () => ( {
	ComponentPopupShell: entrypointMocks.TestPopupShell,
} ) );
vi.mock( '../../features/popup/services/current-tab-reader', () => ( {
	createCurrentTabReader: entrypointMocks.createCurrentTabReader,
} ) );
vi.mock( '../../features/popup/services/popup-enrollment-client', () => ( {
	createPopupEnrollmentClient: entrypointMocks.createPopupEnrollmentClient,
} ) );
vi.mock( '../../features/popup/services/popup-page', () => ( {
	bootstrapPopupPage: entrypointMocks.bootstrapPopupPage,
} ) );
vi.mock( '../../features/popup/services/popup-status-client', () => ( {
	createPopupStatusClient: entrypointMocks.createPopupStatusClient,
} ) );
vi.mock( '../../localization', () => ( {
	createEnglishLocalizationBundle: entrypointMocks.createEnglishLocalizationBundle,
	loadLocalizationBundle: entrypointMocks.loadLocalizationBundle,
} ) );

describe( 'popup entrypoint', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.stubEnv( 'CHROME', '' );
		entrypointMocks.document.querySelector.mockReturnValue( entrypointMocks.shell );
	} );

	afterEach( () => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	} );

	it.each( [ 'FIREFOX', 'SAFARI' ] )( 'preserves direct popup permission enrollment on %s', async ( browserTarget ) => {
		vi.stubEnv( browserTarget, 'true' );
		vi.stubGlobal( 'document', entrypointMocks.document );
		vi.stubGlobal( 'window', {
			addEventListener: vi.fn(),
			clearInterval: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( {} ),
			removeEventListener: vi.fn(),
			setInterval: vi.fn(),
		} );
		vi.stubGlobal( 'navigator', { locks: {} } );
		vi.stubGlobal( 'crypto', {} );

		await import( './index' );

		expect( entrypointMocks.createCurrentTabReader ).toHaveBeenCalledWith( {
			tabs: entrypointMocks.browser.tabs,
		} );
		expect( entrypointMocks.createPopupStatusClient ).toHaveBeenCalledWith( {
			runtime: entrypointMocks.browser.runtime,
		} );
		expect( entrypointMocks.createProtectedSiteEnrollmentService ).toHaveBeenCalledWith( {
			editor: entrypointMocks.protectionEditor,
			permissionManager: { permissions: true },
		} );
		expect( entrypointMocks.createSitePermissionManager ).toHaveBeenCalledWith( {
			permissions: entrypointMocks.browser.permissions,
		} );
		expect( entrypointMocks.createPopupEnrollmentClient ).not.toHaveBeenCalled();
		expect( entrypointMocks.bootstrapPopupPage ).toHaveBeenCalledWith( expect.objectContaining( {
			currentTabReader: entrypointMocks.currentTabReader,
			enrollment: entrypointMocks.enrollment,
			faviconProvider: entrypointMocks.faviconProvider,
			preferencesController: entrypointMocks.preferencesController,
			settingsPageUrl: 'chrome-extension://extension-id/options.html#protected-sites',
			shell: entrypointMocks.shell,
			statisticsPageUrl: 'chrome-extension://extension-id/options.html#statistics',
			statusClient: entrypointMocks.statusClient,
		} ) );
	} );

	it( 'does not construct a popup-local configuration editor or permission flow on Chrome', async () => {
		vi.stubEnv( 'CHROME', 'true' );
		vi.stubGlobal( 'document', entrypointMocks.document );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		vi.stubGlobal( 'navigator', { locks: {} } );
		vi.stubGlobal( 'crypto', {} );

		await import( './index' );

		expect( entrypointMocks.createBrowserProtectionConfigurationEditor ).not.toHaveBeenCalled();
		expect( entrypointMocks.createProtectedSiteEnrollmentService ).not.toHaveBeenCalled();
		expect( entrypointMocks.createSitePermissionManager ).not.toHaveBeenCalled();
		expect( entrypointMocks.createPopupEnrollmentClient ).toHaveBeenCalledExactlyOnceWith( {
			runtime: entrypointMocks.browser.runtime,
		} );
		expect( entrypointMocks.bootstrapPopupPage ).toHaveBeenCalledWith( expect.objectContaining( {
			enrollment: entrypointMocks.enrollmentClient,
		} ) );
	} );

	it( 'fails clearly when the popup shell is missing', async () => {
		entrypointMocks.document.querySelector.mockReturnValueOnce( null );
		vi.stubGlobal( 'document', entrypointMocks.document );

		await expect( import( './index' ) ).rejects.toThrow(
			'Expected the popup page to contain the popup shell.',
		);
		expect( entrypointMocks.bootstrapPopupPage ).not.toHaveBeenCalled();
	} );
} );
