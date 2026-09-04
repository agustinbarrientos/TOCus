import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Language } from '../../domains/preferences/types';
import { type PreferencesLanguageChangeListener } from '../../features/preferences/services/preferences-controller/types';

const entrypointMocks = vi.hoisted( () => {
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
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( '../../features/popup/components/shell', () => ( {
	ComponentPopupShell: entrypointMocks.ComponentPopupShell,
} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: entrypointMocks.getUILanguage },
		storage: {
			local: entrypointMocks.storageArea,
			onChanged: entrypointMocks.storageChanges,
		},
	},
} ) );
vi.mock( '../../domains/preferences/services', () => ( {
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

/**
 * Provides an inert callback before a pending preference start captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignorePreferencesStartResolution(): undefined {
	return undefined;
}

describe( 'popup entrypoint', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		entrypointMocks.languageChangeListener.value = null;
		entrypointMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			Promise.resolve( language === 'ja'
				? entrypointMocks.liveLocalization
				: entrypointMocks.initialLocalization ),
		);
		entrypointMocks.preferencesController.language = 'fr';
		entrypointMocks.preferencesController.start.mockResolvedValue( undefined );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
	} );

	it( 'projects local appearance preferences into the popup document', async () => {
		const popupShell = new entrypointMocks.ComponentPopupShell();
		const appearanceTarget = {
			style: { removeProperty: entrypointMocks.removeDocumentVisibility },
		};
		const motionPreference = {};
		const windowTarget = {
			matchMedia: vi.fn().mockReturnValue( motionPreference ),
		};
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;

		entrypointMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );
		const documentTarget = {
			documentElement: appearanceTarget,
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
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
		expect( entrypointMocks.preferencesController.start ).toHaveBeenCalledOnce();
		expect( entrypointMocks.preferencesController.addLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( entrypointMocks.loadLocalizationBundle ).not.toHaveBeenCalled();
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( entrypointMocks.initialLocalization.popup );
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
		expect( documentTarget.title ).toBe( 'Localized popup title' );
	} );

	it( 'applies live language changes to the popup title and shell', async () => {
		const popupShell = new entrypointMocks.ComponentPopupShell();
		const documentTarget = {
			documentElement: {
				style: { removeProperty: entrypointMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		await import( './index' );
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( entrypointMocks.initialLocalization.popup );
		} );

		entrypointMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( entrypointMocks.liveLocalization.popup );
		} );

		expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( documentTarget.title ).toBe( 'Live popup title' );
	} );

	it( 'keeps the popup hidden until the latest language request is ready', async () => {
		const popupShell = new entrypointMocks.ComponentPopupShell();
		const frenchLocalization = Promise.withResolvers<unknown>();
		const documentTarget = {
			documentElement: {
				style: { removeProperty: entrypointMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( popupShell ),
			title: 'Original popup title',
		};

		entrypointMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			language === Language.FRENCH
				? frenchLocalization.promise
				: Promise.resolve( entrypointMocks.liveLocalization ),
		);
		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', { matchMedia: vi.fn().mockReturnValue( {} ) } );
		await import( './index' );
		await vi.waitFor( () => {
			expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		} );

		entrypointMocks.preferencesController.language = Language.JAPANESE;
		entrypointMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( popupShell.copy ).toBe( entrypointMocks.liveLocalization.popup );
		} );
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();

		frenchLocalization.resolve( entrypointMocks.initialLocalization );
		await vi.waitFor( () => {
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
		} );
		expect( popupShell.copy ).toBe( entrypointMocks.liveLocalization.popup );
		expect( documentTarget.title ).toBe( 'Live popup title' );
	} );

	it( 'fails clearly when the popup shell is missing', async () => {
		vi.stubGlobal( 'document', {
			querySelector: vi.fn().mockReturnValue( null ),
		} );

		await expect( import( './index' ) ).rejects.toThrow(
			'Expected the popup page to contain the popup shell.',
		);
		expect( entrypointMocks.createPreferencesController ).not.toHaveBeenCalled();
	} );
} );
