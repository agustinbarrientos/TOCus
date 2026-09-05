import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	InterruptionPageRequestType,
	type InterruptionPageRequest,
} from '../../../protection-runtime/types/runtime-message';
import { InterruptionScreenState } from '../../components/screen/types';
import {
	type InterruptionPageController,
	type InterruptionPageControllerOptions,
} from '../interruption-page-controller/types';
import { Language } from '../../../../domains/preferences/types';
import {
	type PreferencesChangeListener,
	type PreferencesLanguageChangeListener,
} from '../../../preferences/services/preferences-controller/types';

/**
 * Hoisted dependencies used by interruption page tests.
 * @since 0.1.0 Initial implementation.
 */
const pageMocks = vi.hoisted( () => {
	/**
	 * Minimal interruption screen used to verify page composition.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestInterruptionScreen extends EventTarget {
		/** Localized interruption copy. */
		copy: unknown;

		/** Whether focused waiting progress may advance. */
		progressing = false;

		/** Whether the unavailable state is attempting recovery. */
		recovering = false;

		/** Current interruption presentation state. */
		state = InterruptionScreenState.WAITING;

		/** Localized all-time wellbeing summary. */
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

vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: pageMocks.getUILanguage },
		runtime: { sendMessage: pageMocks.sendMessage },
		storage: { local: {}, onChanged: pageMocks.storageChanges },
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
vi.mock( '../../components/screen', () => ( {
	ComponentInterruptionScreen: pageMocks.ComponentInterruptionScreen,
} ) );
vi.mock( '../interruption-page-controller', () => ( {
	createInterruptionPageController: pageMocks.createInterruptionPageController,
} ) );
vi.mock( '../../../statistics/services/statistics-client', () => ( {
	createStatisticsClient: pageMocks.createStatisticsClient,
} ) );
vi.mock( '../../../statistics/services/wellbeing-summary-controller', () => ( {
	createWellbeingSummaryController: pageMocks.createWellbeingSummaryController,
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
	const options = pageMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

	if ( options === undefined ) {
		throw new TypeError( 'Expected interruption page controller options.' );
	}

	options.onPresentationStateChange?.( InterruptionScreenState.WAITING );

	return Promise.resolve();
}

describe( 'interruption page service', () => {
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
		vi.spyOn( Date, 'now' ).mockReturnValue( 100_000 );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	} );

	it( 'loads preferences before connecting runtime timing and motion', async () => {
		const interruptionScreen = new pageMocks.ComponentInterruptionScreen();
		const motionPreference = Object.assign( new EventTarget(), { matches: true } );
		const matchMedia = vi.fn().mockReturnValue( motionPreference );
		const appearanceTarget = {
			style: { removeProperty: pageMocks.removeDocumentVisibility },
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
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: pageMocks.start,
			stop: vi.fn(),
		} );
		pageMocks.start.mockImplementation( startControllerAndReportWaiting );
		pageMocks.wellbeingSummaryController.refresh.mockReturnValue(
			new Promise<void>( ignorePreferencesStartResolution ),
		);
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;
		pageMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );
		pageMocks.sendMessage.mockResolvedValue( { state: 'unavailable' } );

		const { startInterruptionPage } = await import( './index' );
		const startPage = startInterruptionPage();

		expect( matchMedia ).toHaveBeenCalledWith( '(prefers-reduced-motion: reduce)' );
		expect( pageMocks.getUILanguage ).toHaveBeenCalledOnce();
		expect( pageMocks.resolveLanguage ).toHaveBeenCalledWith( 'es-AR' );
		expect( pageMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget,
			browserLanguage: Language.SPANISH_VOS,
			presentation: interruptionScreen,
			storage: pageMocks.preferencesStorage,
			storageChanges: pageMocks.storageChanges,
			systemMotionPreference: motionPreference,
		} );
		expect( pageMocks.createStatisticsClient ).toHaveBeenCalledWith( {
			runtime: { sendMessage: pageMocks.sendMessage },
			storageChanges: pageMocks.storageChanges,
		} );
		expect( pageMocks.createWellbeingSummaryController ).toHaveBeenCalledWith( {
			source: pageMocks.statisticsClient,
			target: interruptionScreen,
		} );
		expect( pageMocks.createInterruptionPageController ).not.toHaveBeenCalled();
		expect( pageMocks.loadLocalizationBundle ).not.toHaveBeenCalled();
		expect( pageMocks.wellbeingSummaryController.setCopy ).not.toHaveBeenCalled();
		expect( pageMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await startPage;
		expect( pageMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		expect( pageMocks.preferencesController.addPreferencesChangeListener )
			.not.toHaveBeenCalled();
		expect( pageMocks.preferencesController.addLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( pageMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		expect( documentTarget.title ).toBe( 'Localized interruption title' );
		expect( interruptionScreen.copy ).toBe( pageMocks.initialLocalization.interruption );
		expect( interruptionScreen.wellbeingSummary )
			.toBe( pageMocks.initialLocalization.wellbeing.neutral );
		expect( pageMocks.wellbeingSummaryController.setCopy )
			.toHaveBeenCalledWith( pageMocks.initialLocalization.wellbeing );
		expect( pageMocks.wellbeingSummaryController.setCopy.mock.invocationCallOrder[ 0 ] )
			.toBeLessThan( pageMocks.removeDocumentVisibility.mock.invocationCallOrder[ 2 ] ?? 0 );
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
		expect( pageMocks.wellbeingSummaryController.refresh ).toHaveBeenCalledOnce();
		expect( pageMocks.wellbeingSummaryController.start ).toHaveBeenCalledOnce();
		expect( pageMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		const options = pageMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

		if ( options === undefined ) {
			throw new TypeError( 'Expected interruption page controller options.' );
		}

		expect( options.documentTarget ).toBe( documentTarget );
		expect( options.motionPreference ).toBe( pageMocks.preferencesController );
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
		expect( pageMocks.sendMessage ).toHaveBeenCalledWith( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		} );
		expect( pageMocks.start ).toHaveBeenCalledOnce();
	} );

	it( 'applies live language changes to interruption copy and wellbeing grammar', async () => {
		const interruptionScreen = new pageMocks.ComponentInterruptionScreen();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
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
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn().mockResolvedValue( undefined ),
			stop: vi.fn(),
		} );
		pageMocks.preferencesController.start.mockResolvedValue( undefined );
		const { startInterruptionPage } = await import( './index' );
		await startInterruptionPage();
		expect( interruptionScreen.copy ).toBe( pageMocks.initialLocalization.interruption );

		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( interruptionScreen.copy ).toBe( pageMocks.liveLocalization.interruption );
		} );

		expect( pageMocks.loadLocalizationBundle ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( documentTarget.title ).toBe( 'Live interruption title' );
		expect( interruptionScreen.wellbeingSummary )
			.toBe( pageMocks.liveLocalization.wellbeing.neutral );
		expect( pageMocks.wellbeingSummaryController.setCopy )
			.toHaveBeenLastCalledWith( pageMocks.liveLocalization.wellbeing );
	} );

	it( 'waits for the latest language before revealing and connecting interruption timing', async () => {
		const interruptionScreen = new pageMocks.ComponentInterruptionScreen();
		const frenchLocalization = Promise.withResolvers<unknown>();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( interruptionScreen ),
			title: 'Original interruption title',
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
		} );

		pageMocks.loadLocalizationBundle.mockImplementation( ( language ) =>
			language === Language.FRENCH
				? frenchLocalization.promise
				: Promise.resolve( pageMocks.liveLocalization ),
		);
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn().mockResolvedValue( undefined ),
			stop: vi.fn(),
		} );
		pageMocks.preferencesController.start.mockResolvedValue( undefined );
		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		const { startInterruptionPage } = await import( './index' );
		const startPage = startInterruptionPage();
		await vi.waitFor( () => {
			expect( pageMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.FRENCH );
		} );

		pageMocks.preferencesController.language = Language.JAPANESE;
		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( interruptionScreen.copy ).toBe( pageMocks.liveLocalization.interruption );
		} );
		expect( pageMocks.createInterruptionPageController ).not.toHaveBeenCalled();
		expect( pageMocks.removeDocumentVisibility ).not.toHaveBeenCalled();

		frenchLocalization.resolve( pageMocks.initialLocalization );
		await startPage;
		expect( pageMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		expect( interruptionScreen.copy ).toBe( pageMocks.liveLocalization.interruption );
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'releases page controllers and reveals recovery when runtime startup fails', async () => {
		const interruptionScreen = new pageMocks.ComponentInterruptionScreen();
		const controllerStop = vi.fn();
		const startupError = new Error( 'Runtime startup failed.' );
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
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
		pageMocks.preferencesController.start.mockResolvedValue( undefined );
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn().mockRejectedValue( startupError ),
			stop: controllerStop,
		} );
		const { startInterruptionPage } = await import( './index' );

		await expect( startInterruptionPage() ).rejects.toBe( startupError );
		expect( controllerStop ).toHaveBeenCalledOnce();
		expect( pageMocks.wellbeingSummaryController.stop ).toHaveBeenCalledOnce();
		expect( pageMocks.preferencesController.removeLanguageChangeListener )
			.toHaveBeenCalledWith( pageMocks.languageChangeListener.value );
		expect( pageMocks.preferencesController.stop ).toHaveBeenCalledOnce();
		expect( interruptionScreen.state ).toBe( InterruptionScreenState.UNAVAILABLE );
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

	it( 'retains current interruption copy when a live localization request fails', async () => {
		const interruptionScreen = new pageMocks.ComponentInterruptionScreen();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
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
		pageMocks.preferencesController.start.mockResolvedValue( undefined );
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn().mockResolvedValue( undefined ),
			stop: vi.fn(),
		} );
		const { startInterruptionPage } = await import( './index' );

		await startInterruptionPage();
		pageMocks.loadLocalizationBundle.mockRejectedValueOnce(
			new Error( 'Live packaged copy unavailable.' ),
		);
		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( pageMocks.loadLocalizationBundle ).toHaveBeenCalledWith( Language.JAPANESE );
		} );

		pageMocks.languageChangeListener.value?.( Language.FRENCH );
		await vi.waitFor( () => {
			expect( interruptionScreen.copy ).toBe( pageMocks.initialLocalization.interruption );
		} );
		expect( documentTarget.title ).toBe( 'Localized interruption title' );
	} );

	it( 'contains terminal interruption startup failures', async () => {
		vi.stubGlobal( 'document', Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( null ),
			visibilityState: 'visible',
		} ) );
		vi.stubGlobal( 'window', new EventTarget() );
		const { bootstrapInterruptionPage } = await import( './index' );

		await expect( bootstrapInterruptionPage() ).resolves.toBeUndefined();
		expect( pageMocks.removeDocumentVisibility ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'fails clearly when the interruption screen is missing', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: {
				style: { removeProperty: pageMocks.removeDocumentVisibility },
			},
			querySelector: vi.fn().mockReturnValue( null ),
			visibilityState: 'visible',
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', new EventTarget() );

		const { startInterruptionPage } = await import( './index' );

		await expect( startInterruptionPage() ).rejects.toThrow(
			'Expected the interruption page to contain the interruption screen.',
		);
		expect( pageMocks.createInterruptionPageController ).not.toHaveBeenCalled();
	} );
} );
