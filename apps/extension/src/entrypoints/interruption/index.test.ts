import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	InterruptionPageRequestType,
	type InterruptionPageRequest,
} from '../../features/protection-runtime/types/runtime-message';
import { InterruptionScreenState } from '../../features/interruption/components/screen/types';
import {
	type InterruptionPageController,
	type InterruptionPageControllerOptions,
} from '../../features/interruption/services/interruption-page-controller/types';
import { Language } from '../../domains/preferences/types';
import {
	type PreferencesChangeListener,
	type PreferencesLanguageChangeListener,
} from '../../features/preferences/services/preferences-controller/types';

/**
 * Hoisted entrypoint dependencies used by interruption composition tests.
 * @since 0.1.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal interruption screen used to verify entrypoint composition.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestInterruptionScreen extends EventTarget {
		copy: unknown;

		wellbeingSummary = 'Default footer';
	}

	const initialLocalization = {
		document: { interruptionTitle: 'Localized interruption title' },
		interruption: { value: 'Localized interruption copy' },
		languageTag: 'fr',
		wellbeing: { neutral: 'Localized neutral footer' },
	};
	const liveLocalization = {
		document: { interruptionTitle: 'Live interruption title' },
		interruption: { value: 'Live interruption copy' },
		languageTag: 'ja',
		wellbeing: { neutral: 'Live neutral footer' },
	};
	const languageChangeListener: { value: PreferencesLanguageChangeListener | null } = {
		value: null,
	};

	const preferencesController = Object.assign( new EventTarget(), {
		addLanguageChangeListener: vi.fn<( listener: PreferencesLanguageChangeListener ) => void>(
			( listener ) => {
				languageChangeListener.value = listener;
			},
		),
		addPreferencesChangeListener: vi.fn<( listener: PreferencesChangeListener ) => void>(),
		apply: vi.fn(),
		language: 'fr',
		matches: false,
		removeLanguageChangeListener: vi.fn(),
		removePreferencesChangeListener: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	} );
	const preferencesStorage = {};
	const removeDocumentVisibility = vi.fn();
	const storageChanges = {};
	const statisticsClient = {};
	const wellbeingSummaryController = {
		refresh: vi.fn(),
		setCopy: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	};

	return {
		ComponentInterruptionScreen: TestInterruptionScreen,
		createInterruptionPageController: vi.fn<(
			options: InterruptionPageControllerOptions,
		) => InterruptionPageController>(),
		loadLocalizationBundle: vi.fn<( language: string ) => Promise<unknown>>( ( language ) =>
			Promise.resolve( language === 'ja' ? liveLocalization : initialLocalization ),
		),
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorage: vi.fn().mockReturnValue( preferencesStorage ),
		createStatisticsClient: vi.fn().mockReturnValue( statisticsClient ),
		createWellbeingSummaryController: vi.fn().mockReturnValue( wellbeingSummaryController ),
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		initialLocalization,
		languageChangeListener,
		liveLocalization,
		preferencesController,
		preferencesStorage,
		removeDocumentVisibility,
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		sendMessage: vi.fn<( request: InterruptionPageRequest ) => Promise<unknown>>(),
		start: vi.fn(),
		storageChanges,
		statisticsClient,
		wellbeingSummaryController,
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: entrypointMocks.getUILanguage },
		runtime: { sendMessage: entrypointMocks.sendMessage },
		storage: { local: {}, onChanged: entrypointMocks.storageChanges },
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
vi.mock( '../../features/interruption/components/screen', () => ( {
	ComponentInterruptionScreen: entrypointMocks.ComponentInterruptionScreen,
} ) );
vi.mock( '../../features/interruption/services/interruption-page-controller', () => ( {
	createInterruptionPageController: entrypointMocks.createInterruptionPageController,
} ) );
vi.mock( '../../features/statistics/services/statistics-client', () => ( {
	createStatisticsClient: entrypointMocks.createStatisticsClient,
} ) );
vi.mock( '../../features/statistics/services/wellbeing-summary-controller', () => ( {
	createWellbeingSummaryController: entrypointMocks.createWellbeingSummaryController,
} ) );

/**
 * Provides an inert initial callback before a pending preference start captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignorePreferencesStartResolution(): undefined {
	return undefined;
}

/**
 * Reports one authoritative Waiting state while leaving footer refresh work pending.
 * @return Immediately resolved interruption-controller startup.
 * @since 0.1.0 Initial implementation.
 */
function startControllerAndReportWaiting(): Promise<void> {
	const options = entrypointMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

	if ( options === undefined ) {
		throw new TypeError( 'Expected interruption page controller options.' );
	}

	options.onPresentationStateChange?.( InterruptionScreenState.WAITING );

	return Promise.resolve();
}

describe( 'interruption page entrypoint', () => {
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
		vi.spyOn( Date, 'now' ).mockReturnValue( 100_000 );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	} );

	it( 'loads preferences before connecting runtime timing and motion', async () => {
		const interruptionScreen = new entrypointMocks.ComponentInterruptionScreen();
		const motionPreference = Object.assign( new EventTarget(), { matches: true } );
		const matchMedia = vi.fn().mockReturnValue( motionPreference );
		const appearanceTarget = {
			style: { removeProperty: entrypointMocks.removeDocumentVisibility },
		};
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia,
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: appearanceTarget,
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( interruptionScreen ),
			title: 'Original interruption title',
			visibilityState: 'visible',
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: entrypointMocks.start,
			stop: vi.fn(),
		} );
		entrypointMocks.start.mockImplementation( startControllerAndReportWaiting );
		entrypointMocks.wellbeingSummaryController.refresh.mockReturnValue(
			new Promise<void>( ignorePreferencesStartResolution ),
		);
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;
		entrypointMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );
		entrypointMocks.sendMessage.mockResolvedValue( { state: 'unavailable' } );

		await import( './index' );

		expect( matchMedia ).toHaveBeenCalledWith( '(prefers-reduced-motion: reduce)' );
		expect( entrypointMocks.getUILanguage ).toHaveBeenCalledOnce();
		expect( entrypointMocks.resolveLanguage ).toHaveBeenCalledWith( 'es-AR' );
		expect( entrypointMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget,
			browserLanguage: Language.SPANISH_VOS,
			presentation: interruptionScreen,
			storage: entrypointMocks.preferencesStorage,
			storageChanges: entrypointMocks.storageChanges,
			systemMotionPreference: motionPreference,
		} );
		expect( entrypointMocks.createStatisticsClient ).toHaveBeenCalledWith( {
			runtime: { sendMessage: entrypointMocks.sendMessage },
			storageChanges: entrypointMocks.storageChanges,
		} );
		expect( entrypointMocks.createWellbeingSummaryController ).toHaveBeenCalledWith( {
			source: entrypointMocks.statisticsClient,
			target: interruptionScreen,
		} );
		expect( entrypointMocks.createInterruptionPageController ).not.toHaveBeenCalled();
		expect( entrypointMocks.loadLocalizationBundle ).not.toHaveBeenCalled();
		expect( entrypointMocks.wellbeingSummaryController.setCopy ).not.toHaveBeenCalled();
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await vi.waitFor( () => {
			expect( entrypointMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		} );
		expect( entrypointMocks.preferencesController.addPreferencesChangeListener )
			.not.toHaveBeenCalled();
		expect( entrypointMocks.preferencesController.addLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		expect( documentTarget.title ).toBe( 'Localized interruption title' );
		expect( interruptionScreen.copy ).toBe( entrypointMocks.initialLocalization.interruption );
		expect( interruptionScreen.wellbeingSummary )
			.toBe( entrypointMocks.initialLocalization.wellbeing.neutral );
		expect( entrypointMocks.wellbeingSummaryController.setCopy )
			.toHaveBeenCalledWith( entrypointMocks.initialLocalization.wellbeing );
		expect( entrypointMocks.wellbeingSummaryController.setCopy.mock.invocationCallOrder[ 0 ] )
			.toBeLessThan( entrypointMocks.removeDocumentVisibility.mock.invocationCallOrder[ 2 ] ?? 0 );
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
		expect( entrypointMocks.wellbeingSummaryController.refresh ).toHaveBeenCalledOnce();
		expect( entrypointMocks.wellbeingSummaryController.start ).toHaveBeenCalledOnce();
		expect( entrypointMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		const options = entrypointMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

		if ( options === undefined ) {
			throw new TypeError( 'Expected interruption page controller options.' );
		}

		expect( options.documentTarget ).toBe( documentTarget );
		expect( options.motionPreference ).toBe( entrypointMocks.preferencesController );
		expect( options.scheduler ).toBe( windowTarget );
		expect( options.screen ).toBe( interruptionScreen );
		expect( options.windowTarget ).toBe( windowTarget );
		expect( options.clock.now() ).toBe( 100_000 );
		expect( options.visibility.isDocumentVisible() ).toBe( true );
		expect( options.visibility.isWindowFocused() ).toBe( true );
		await expect( options.runtime.sendMessage( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		} ) ).resolves.toEqual( { state: 'unavailable' } );
		expect( entrypointMocks.sendMessage ).toHaveBeenCalledWith( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		} );
		expect( entrypointMocks.start ).toHaveBeenCalledOnce();
	} );

	it( 'applies live language changes to interruption copy and wellbeing grammar', async () => {
		const interruptionScreen = new entrypointMocks.ComponentInterruptionScreen();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: entrypointMocks.removeDocumentVisibility },
			},
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( interruptionScreen ),
			title: 'Original interruption title',
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn().mockResolvedValue( undefined ),
			stop: vi.fn(),
		} );
		entrypointMocks.preferencesController.start.mockResolvedValue( undefined );
		await import( './index' );
		await vi.waitFor( () => {
			expect( interruptionScreen.copy ).toBe( entrypointMocks.initialLocalization.interruption );
		} );

		entrypointMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( interruptionScreen.copy ).toBe( entrypointMocks.liveLocalization.interruption );
		} );

		expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( documentTarget.title ).toBe( 'Live interruption title' );
		expect( interruptionScreen.wellbeingSummary )
			.toBe( entrypointMocks.liveLocalization.wellbeing.neutral );
		expect( entrypointMocks.wellbeingSummaryController.setCopy )
			.toHaveBeenLastCalledWith( entrypointMocks.liveLocalization.wellbeing );
	} );

	it( 'waits for the latest language before revealing and connecting interruption timing', async () => {
		const interruptionScreen = new entrypointMocks.ComponentInterruptionScreen();
		const frenchLocalization = Promise.withResolvers<unknown>();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: entrypointMocks.removeDocumentVisibility },
			},
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( interruptionScreen ),
			title: 'Original interruption title',
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
		} );

		entrypointMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			language === Language.FRENCH
				? frenchLocalization.promise
				: Promise.resolve( entrypointMocks.liveLocalization ),
		);
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn().mockResolvedValue( undefined ),
			stop: vi.fn(),
		} );
		entrypointMocks.preferencesController.start.mockResolvedValue( undefined );
		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		await import( './index' );
		await vi.waitFor( () => {
			expect( entrypointMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		} );

		entrypointMocks.preferencesController.language = Language.JAPANESE;
		entrypointMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( interruptionScreen.copy ).toBe( entrypointMocks.liveLocalization.interruption );
		} );
		expect( entrypointMocks.createInterruptionPageController ).not.toHaveBeenCalled();
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();

		frenchLocalization.resolve( entrypointMocks.initialLocalization );
		await vi.waitFor( () => {
			expect( entrypointMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		} );
		expect( interruptionScreen.copy ).toBe( entrypointMocks.liveLocalization.interruption );
		expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'fails clearly when the interruption screen is missing', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			querySelector: vi.fn().mockReturnValue( null ),
			visibilityState: 'visible',
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', new EventTarget() );

		await expect( import( './index' ) ).rejects.toThrow(
			'Expected the interruption page to contain the interruption screen.',
		);
		expect( entrypointMocks.createInterruptionPageController ).not.toHaveBeenCalled();
	} );
} );
