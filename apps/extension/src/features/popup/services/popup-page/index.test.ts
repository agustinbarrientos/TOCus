import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Language } from '../../../../domains/preferences/types';
import { type PreferencesLanguageChangeListener } from '../../../preferences/services/preferences-controller/types';

const pageMocks = vi.hoisted( () => {
	/**
	 * Minimal popup shell used to observe localized copy.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestPopupShell {
		copy: unknown;
	}

	const initialLocalization = {
		document: { popupTitle: 'Localized popup title' },
		languageTag: 'fr',
		popup: { status: 'Localized popup copy' },
	};
	const liveLocalization = {
		document: { popupTitle: 'Live popup title' },
		languageTag: 'ja',
		popup: { status: 'Live popup copy' },
	};
	const languageChangeListener: { value: PreferencesLanguageChangeListener | null } = {
		value: null,
	};
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
	const removeDocumentVisibility = vi.fn();
	const storageArea = {};
	const storageChanges = {};

	return {
		ComponentPopupShell: TestPopupShell,
		loadLocalizationBundle: vi.fn<( language: string ) => Promise<unknown>>( ( language ) =>
			Promise.resolve( language === 'ja' ? liveLocalization : initialLocalization ),
		),
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorage: vi.fn().mockReturnValue( preferencesStorage ),
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		initialLocalization,
		languageChangeListener,
		liveLocalization,
		preferencesController,
		preferencesStorage,
		removeDocumentVisibility,
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		storageArea,
		storageChanges,
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( '../../components/shell', () => ( {
	ComponentPopupShell: pageMocks.ComponentPopupShell,
} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: pageMocks.getUILanguage },
		storage: {
			local: pageMocks.storageArea,
			onChanged: pageMocks.storageChanges,
		},
	},
} ) );
vi.mock( '../../../../domains/preferences/services', () => ( {
	createPreferencesStorageService: pageMocks.createPreferencesStorage,
} ) );
vi.mock( '../../../../domains/preferences/utils', () => ( {
	resolveLanguage: pageMocks.resolveLanguage,
} ) );
vi.mock( '../../../../localization', () => ( {
	loadLocalizationBundle: pageMocks.loadLocalizationBundle,
} ) );
vi.mock( '../../../preferences/services/preferences-controller', () => ( {
	createPreferencesController: pageMocks.createPreferencesController,
} ) );

/**
 * Provides an inert callback before a pending preference start captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignorePreferencesStartResolution(): undefined {
	return undefined;
}

describe( 'popup page service', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		pageMocks.languageChangeListener.value = null;
		pageMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			Promise.resolve( language === 'ja'
				? pageMocks.liveLocalization
				: pageMocks.initialLocalization ),
		);
		pageMocks.preferencesController.language = 'fr';
		pageMocks.preferencesController.start.mockResolvedValue( undefined );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
	} );

	it( 'projects local appearance preferences into the popup document', async () => {
		const popupShell = new pageMocks.ComponentPopupShell();
		const appearanceTarget = {
			style: { removeProperty: pageMocks.removeDocumentVisibility },
		};
		const motionPreference = {};
		const windowTarget = {
			matchMedia: vi.fn().mockReturnValue( motionPreference ),
		};
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;

		pageMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );
		const documentTarget = {
			documentElement: appearanceTarget,
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		const { startPopupPage } = await import( './index' );
		const start = startPopupPage();

		expect( pageMocks.getUILanguage ).toHaveBeenCalledOnce();
		expect( pageMocks.resolveLanguage ).toHaveBeenCalledWith( 'es-AR' );
		expect( pageMocks.createPreferencesStorage ).toHaveBeenCalledWith( {
			area: pageMocks.storageArea,
		} );
		expect( pageMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget,
			browserLanguage: Language.SPANISH_VOS,
			storage: pageMocks.preferencesStorage,
			storageChanges: pageMocks.storageChanges,
			systemMotionPreference: motionPreference,
		} );
		expect( pageMocks.preferencesController.start ).toHaveBeenCalledOnce();
		expect( pageMocks.preferencesController.addLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( pageMocks.loadLocalizationBundle ).not.toHaveBeenCalled();
		expect( pageMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await start;
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( pageMocks.initialLocalization.popup );
			expect( pageMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				1,
				'color-scheme',
			);
			expect( pageMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				2,
				'background',
			);
			expect( pageMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				3,
				'visibility',
			);
		} );
		expect( pageMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		expect( documentTarget.title ).toBe( 'Localized popup title' );
	} );

	it( 'applies live language changes to the popup title and shell', async () => {
		const popupShell = new pageMocks.ComponentPopupShell();
		const documentTarget = {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		const { startPopupPage } = await import( './index' );
		await startPopupPage();
		expect( popupShell.copy ).toBe( pageMocks.initialLocalization.popup );

		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( pageMocks.liveLocalization.popup );
		} );

		expect( pageMocks.loadLocalizationBundle ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( documentTarget.title ).toBe( 'Live popup title' );
	} );

	it( 'keeps the popup hidden until the latest language request is ready', async () => {
		const popupShell = new pageMocks.ComponentPopupShell();
		const frenchLocalization = Promise.withResolvers<unknown>();
		const documentTarget = {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		pageMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			language === Language.FRENCH
				? frenchLocalization.promise
				: Promise.resolve( pageMocks.liveLocalization ),
		);
		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		const { startPopupPage } = await import( './index' );
		const start = startPopupPage();
		await vi.waitFor( () => {
			expect( pageMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		} );

		pageMocks.preferencesController.language = Language.JAPANESE;
		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( pageMocks.liveLocalization.popup );
		} );
		expect( pageMocks.removeDocumentVisibility ).not.toHaveBeenCalled();

		frenchLocalization.resolve( pageMocks.initialLocalization );
		await start;
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
		expect( popupShell.copy ).toBe( pageMocks.liveLocalization.popup );
		expect( documentTarget.title ).toBe( 'Live popup title' );
	} );

	it( 'releases preference observers and reveals the popup when startup fails', async () => {
		const popupShell = new pageMocks.ComponentPopupShell();
		const startupError = new Error( 'Packaged copy unavailable.' );
		const documentTarget = {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		pageMocks.loadLocalizationBundle.mockRejectedValue( startupError );
		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		const { startPopupPage } = await import( './index' );

		await expect( startPopupPage() ).rejects.toBe( startupError );
		expect( pageMocks.preferencesController.removeLanguageChangeListener )
			.toHaveBeenCalledWith( pageMocks.languageChangeListener.value );
		expect( pageMocks.preferencesController.stop ).toHaveBeenCalledOnce();
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
			1,
			'color-scheme',
		);
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
			2,
			'background',
		);
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
			3,
			'visibility',
		);
	} );

	it( 'retains the current popup copy when a live localization request fails', async () => {
		const popupShell = new pageMocks.ComponentPopupShell();
		const documentTarget = {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		const { startPopupPage } = await import( './index' );

		await startPopupPage();
		pageMocks.loadLocalizationBundle.mockRejectedValueOnce(
			new Error( 'Live packaged copy unavailable.' ),
		);
		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( pageMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.JAPANESE );
		} );

		pageMocks.languageChangeListener.value?.( Language.FRENCH );
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( pageMocks.initialLocalization.popup );
		} );
		expect( documentTarget.title ).toBe( 'Localized popup title' );
	} );

	it( 'contains terminal popup startup failures', async () => {
		vi.stubGlobal( 'document', {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( null ),
		} );
		const { bootstrapPopupPage } = await import( './index' );

		await expect( bootstrapPopupPage() ).resolves.toBeUndefined();
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'fails clearly when the popup shell is missing', async () => {
		vi.stubGlobal( 'document', {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( null ),
		} );

		const { startPopupPage } = await import( './index' );

		await expect( startPopupPage() ).rejects.toThrow(
			'Expected the popup page to contain the popup shell.',
		);
		expect( pageMocks.createPreferencesController ).not.toHaveBeenCalled();
	} );
} );
