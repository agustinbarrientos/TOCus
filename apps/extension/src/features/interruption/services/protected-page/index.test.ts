import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllowanceIdSchema } from '../../../../domains/protection/types/protection-value';
import { Language } from '../../../../domains/preferences/types';
import {
	type InterruptionPageController,
	type InterruptionPageControllerOptions,
} from '../interruption-page-controller/types';
import {
	type ProtectedPageLayerController,
	type ProtectedPageLayerControllerOptions,
} from '../protected-page-layer-controller/types';
import { InterruptionScreenState } from '../../components/screen/types';
import {
	type PreferencesChangeListener,
	type PreferencesLanguageChangeListener,
} from '../../../preferences/services/preferences-controller/types';
import { type ProtectedPageMessage } from '../../../protection-runtime/types/protected-page-message';

/**
 * Isolated-world initialization key used by the protected-page service.
 * @since 0.1.0 Initial implementation.
 */
const PROTECTED_PAGE_INITIALIZATION_KEY = Symbol.for( 'tocus.protected-page.initialization' );

/**
 * Browser message listener accepted by the protected-page service.
 * @since 0.1.0 Initial implementation.
 */
type ProtectedPageMessageListener = (
	message: ProtectedPageMessage,
	sender: unknown,
	sendResponse: ( response?: unknown ) => void,
) => true;

/**
 * Creates test doubles before the protected-page service and its mocks are evaluated.
 * @return Hoisted protected-page service doubles.
 * @since 0.1.0 Initial implementation.
 */
const pageMocks = vi.hoisted( () => {
	/**
	 * Minimal nested interruption screen used to observe localized footer copy.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestInterruptionScreen extends EventTarget {
		wellbeingSummary = 'Default footer';
	}

	/**
	 * Minimal protected-page layer used to verify service composition.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestProtectedPageLayer extends EventTarget {
		connected = false;

		connectionGuardEnabled = false;

		copy: unknown;

		interruptionLayerPresented = false;

		interruptionCopy: unknown;

		lang = '';

		readonly interruptionScreen = new TestInterruptionScreen();

		readonly style = {
			removeProperty: vi.fn<( property: string ) => void>(),
			visibility: '',
		};

		/**
		 * Reports whether the layer is attached to the test document.
		 * @return Current attachment state.
		 * @since 0.1.0 Initial implementation.
		 */
		get isConnected(): boolean {
			return this.connected;
		}

		readonly updateComplete = Promise.resolve( true );

		warningRemainingSeconds: number | null = null;

		/**
		 * Returns the screen nested inside the layer.
		 * @return Test screen object.
		 * @since 0.1.0 Initial implementation.
		 */
		getInterruptionScreen(): TestInterruptionScreen {
			if ( this.interruptionCopy === undefined ) {
				throw new Error( 'The test interruption screen has not rendered.' );
			}

			return this.interruptionScreen;
		}

		/**
		 * Reports whether the test layer is connected and requested for presentation.
		 * @return Current test presentation visibility.
		 * @since 0.1.0 Initial implementation.
		 */
		isInterruptionPresentationVisible(): boolean {
			return this.connected && this.interruptionLayerPresented;
		}

		/**
		 * Resolves after the in-memory presentation is immediately ready.
		 * @return Resolved presentation operation.
		 * @since 0.1.0 Initial implementation.
		 */
		waitForInterruptionPresentation(): Promise<void> {
			return Promise.resolve();
		}

		/**
		 * Detaches the layer from the test document.
		 * @since 0.1.0 Initial implementation.
		 */
		remove(): void {
			this.connected = false;
		}
	}

	const initialLocalization = {
		interruption: { value: 'Localized interruption copy' },
		languageTag: 'fr',
		protectedPageLayer: { value: 'Localized protected-page copy' },
		wellbeing: { neutral: 'Localized neutral footer' },
	};
	const liveLocalization = {
		interruption: { value: 'Live interruption copy' },
		languageTag: 'ja',
		protectedPageLayer: { value: 'Live protected-page copy' },
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
		removeLanguageChangeListener: vi.fn<( listener: PreferencesLanguageChangeListener ) => void>(),
		removePreferencesChangeListener: vi.fn<( listener: PreferencesChangeListener ) => void>(),
		start: vi.fn(),
		stop: vi.fn(),
	} );
	const preferencesStorage = {};
	const statisticsClient = {};
	const storageChanges = {};
	const wellbeingSummaryController = {
		refresh: vi.fn(),
		setCopy: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	};

	return {
		ComponentProtectedPageLayer: TestProtectedPageLayer,
		addMessageListener: vi.fn<( listener: ProtectedPageMessageListener ) => void>(),
		append: vi.fn<( layer: TestProtectedPageLayer ) => void>(),
		createInterruptionPageController: vi.fn<(
			options: InterruptionPageControllerOptions,
		) => InterruptionPageController>(),
		createLocalizedProtectedPageCopy: vi.fn<( language: string ) => unknown>( ( language ) =>
			language === 'ja' ? liveLocalization : initialLocalization,
		),
		createProtectedPageLayerController: vi.fn<(
			options: ProtectedPageLayerControllerOptions,
		) => ProtectedPageLayerController>(),
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorage: vi.fn().mockReturnValue( preferencesStorage ),
		createStatisticsClient: vi.fn().mockReturnValue( statisticsClient ),
		createWellbeingSummaryController: vi.fn().mockReturnValue( wellbeingSummaryController ),
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		handleMessage: vi.fn<ProtectedPageLayerController[ 'handleMessage' ]>(),
		initialLocalization,
		languageChangeListener,
		liveLocalization,
		preferencesController,
		preferencesStorage,
		removeMessageListener: vi.fn(),
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		sendMessage: vi.fn(),
		stopLayerController: vi.fn(),
		storageChanges,
		statisticsClient,
		wellbeingSummaryController,
	};
} );

/**
 * Protected-page layer test double exposed by the hoisted module mocks.
 * @since 0.1.0 Initial implementation.
 */
type TestProtectedPageLayer = InstanceType<typeof pageMocks.ComponentProtectedPageLayer>;

/**
 * Provides an inert callback before a pending preference start captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignorePreferencesStartResolution(): undefined {
	return undefined;
}

vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: pageMocks.getUILanguage },
		runtime: {
			onMessage: {
				addListener: pageMocks.addMessageListener,
				removeListener: pageMocks.removeMessageListener,
			},
			sendMessage: pageMocks.sendMessage,
		},
		storage: { local: {}, onChanged: pageMocks.storageChanges },
	},
} ) );
vi.mock( '../../../../domains/preferences/services', () => ( {
	createPreferencesStorageService: pageMocks.createPreferencesStorage,
} ) );
vi.mock( '../../../../domains/preferences/utils', () => ( {
	resolveLanguage: pageMocks.resolveLanguage,
} ) );
vi.mock( '../../../../localization/utils/create-localized-protected-page-copy', () => ( {
	createLocalizedProtectedPageCopy: pageMocks.createLocalizedProtectedPageCopy,
} ) );
vi.mock( '../../../preferences/services/preferences-controller', () => ( {
	createPreferencesController: pageMocks.createPreferencesController,
} ) );
vi.mock( '../../components/protected-page-layer', () => ( {
	ComponentProtectedPageLayer: pageMocks.ComponentProtectedPageLayer,
} ) );
vi.mock( '../interruption-page-controller', () => ( {
	createInterruptionPageController: pageMocks.createInterruptionPageController,
} ) );
vi.mock( '../protected-page-layer-controller', () => ( {
	createProtectedPageLayerController: pageMocks.createProtectedPageLayerController,
} ) );
vi.mock( '../../../statistics/services/statistics-client', () => ( {
	createStatisticsClient: pageMocks.createStatisticsClient,
} ) );
vi.mock( '../../../statistics/services/wellbeing-summary-controller', () => ( {
	createWellbeingSummaryController: pageMocks.createWellbeingSummaryController,
} ) );

describe( 'protected page service', () => {
	beforeEach( () => {
		Reflect.deleteProperty( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY );
		vi.resetModules();
		vi.clearAllMocks();
		pageMocks.languageChangeListener.value = null;
		pageMocks.createLocalizedProtectedPageCopy.mockImplementation( ( language ) =>
			language === 'ja'
				? pageMocks.liveLocalization
				: pageMocks.initialLocalization,
		);
		pageMocks.preferencesController.language = 'fr';
		vi.spyOn( Date, 'now' ).mockReturnValue( 120_000 );
		pageMocks.preferencesController.start.mockResolvedValue( undefined );
	} );

	afterEach( () => {
		Reflect.deleteProperty( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY );
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	} );

	it( 'mounts one isolated layer and connects it to extension messaging', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			activeElement: null,
			documentElement: { append: pageMocks.append, lang: 'es' },
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( null ),
			title: 'Visited page title',
			visibilityState: 'visible',
		} );
		const motionPreference = Object.assign( new EventTarget(), { matches: false } );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( motionPreference ),
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );
		const interruptionController: InterruptionPageController = {
			start: vi.fn(),
			stop: vi.fn(),
		};
		const layerController: ProtectedPageLayerController = {
			handleMessage: pageMocks.handleMessage,
			stop: pageMocks.stopLayerController,
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		pageMocks.handleMessage.mockResolvedValue( undefined );
		pageMocks.sendMessage.mockResolvedValue( { state: 'waiting' } );
		pageMocks.createInterruptionPageController.mockReturnValue( interruptionController );
		pageMocks.createProtectedPageLayerController.mockReturnValue( layerController );
		pageMocks.wellbeingSummaryController.refresh.mockReturnValue(
			new Promise<void>( ignorePreferencesStartResolution ),
		);
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;

		pageMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );

		const { mountProtectedPageLayer } = await import( './index' );
		const initialization: unknown = mountProtectedPageLayer();

		expect( initialization ).toBeInstanceOf( Promise );
		if ( ! ( initialization instanceof Promise ) ) {
			throw new TypeError( 'Expected protected-page initialization to return a promise.' );
		}

		await vi.waitFor( () => {
			expect( pageMocks.preferencesController.start ).toHaveBeenCalledOnce();
		} );
		const pendingLayer = pageMocks.append.mock.calls[ 0 ]?.[ 0 ];

		expect( pendingLayer?.style.visibility ).toBe( 'hidden' );
		expect( pendingLayer?.style.removeProperty ).not.toHaveBeenCalled();
		expect( pageMocks.createLocalizedProtectedPageCopy ).toHaveBeenCalledOnce();
		expect( pageMocks.createLocalizedProtectedPageCopy ).toHaveBeenCalledWith( Language.SPANISH_VOS );
		expect( pendingLayer?.copy ).toBe( pageMocks.initialLocalization.protectedPageLayer );
		expect( pendingLayer?.interruptionCopy ).toBe( pageMocks.initialLocalization.interruption );
		completePreferencesStart();
		await initialization;
		expect( pendingLayer?.style.removeProperty ).toHaveBeenCalledWith( 'visibility' );

		expect( pageMocks.append ).toHaveBeenCalledWith(
			expect.any( pageMocks.ComponentProtectedPageLayer ),
		);
		expect( pageMocks.append.mock.calls[ 0 ]?.[ 0 ]?.connectionGuardEnabled ).toBe( true );
		expect( pageMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		expect( pageMocks.createProtectedPageLayerController ).toHaveBeenCalledOnce();
		expect( pageMocks.addMessageListener ).toHaveBeenCalledOnce();
		const messageListener = pageMocks.addMessageListener.mock.calls[ 0 ]?.[ 0 ];

		if ( messageListener === undefined ) {
			throw new TypeError( 'Expected the protected-page message listener.' );
		}

		const message: ProtectedPageMessage = { type: 'get-protected-page-presentation-status' };
		const sendResponse = vi.fn();

		expect( messageListener( message, {}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledOnce();
		} );

		expect( pageMocks.handleMessage ).toHaveBeenCalledWith( message );
		const interruptionOptions = pageMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

		if ( interruptionOptions === undefined ) {
			throw new TypeError( 'Expected interruption controller options.' );
		}

		expect( interruptionOptions.clock.now() ).toBe( 120_000 );
		const layer = pageMocks.append.mock.calls[ 0 ]?.[ 0 ];

		if ( layer === undefined ) {
			throw new TypeError( 'Expected the protected-page layer fixture.' );
		}

		expect( interruptionOptions.visibility.isDocumentVisible() ).toBe( false );
		expect( interruptionOptions.visibility.isWindowFocused() ).toBe( true );
		layer.interruptionLayerPresented = true;
		expect( interruptionOptions.visibility.isDocumentVisible() ).toBe( true );
		layer.connected = false;
		expect( interruptionOptions.visibility.isDocumentVisible() ).toBe( false );
		layer.connected = true;
		expect( pageMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget: layer,
			browserLanguage: Language.SPANISH_VOS,
			presentation: layer.interruptionScreen,
			storage: pageMocks.preferencesStorage,
			storageChanges: pageMocks.storageChanges,
			systemMotionPreference: motionPreference,
		} );
		expect( pageMocks.createStatisticsClient ).toHaveBeenCalledWith( {
			runtime: {
				onMessage: {
					addListener: pageMocks.addMessageListener,
					removeListener: pageMocks.removeMessageListener,
				},
				sendMessage: pageMocks.sendMessage,
			},
			storageChanges: pageMocks.storageChanges,
		} );
		expect( pageMocks.createWellbeingSummaryController ).toHaveBeenCalledWith( {
			source: pageMocks.statisticsClient,
			target: layer.interruptionScreen,
		} );
		expect( pageMocks.preferencesController.addPreferencesChangeListener )
			.not.toHaveBeenCalled();
		expect( pageMocks.getUILanguage ).toHaveBeenCalledOnce();
		expect( pageMocks.resolveLanguage ).toHaveBeenCalledWith( 'es-AR' );
		expect( pageMocks.preferencesController.addLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( pageMocks.createLocalizedProtectedPageCopy ).toHaveBeenCalledWith( Language.FRENCH );
		expect( layer.lang ).toBe( 'fr' );
		expect( layer.copy ).toBe( pageMocks.initialLocalization.protectedPageLayer );
		expect( layer.interruptionCopy ).toBe( pageMocks.initialLocalization.interruption );
		expect( layer.interruptionScreen.wellbeingSummary )
			.toBe( pageMocks.initialLocalization.wellbeing.neutral );
		expect( pageMocks.wellbeingSummaryController.setCopy )
			.toHaveBeenCalledWith( pageMocks.initialLocalization.wellbeing );
		expect( pageMocks.wellbeingSummaryController.setCopy.mock.invocationCallOrder[ 0 ] )
			.toBeLessThan( pendingLayer?.style.removeProperty.mock.invocationCallOrder[ 0 ] ?? 0 );
		expect( documentTarget.title ).toBe( 'Visited page title' );
		expect( documentTarget.documentElement.lang ).toBe( 'es' );
		expect( pageMocks.preferencesController.start ).toHaveBeenCalledOnce();
		expect( interruptionOptions.motionPreference ).toBe( pageMocks.preferencesController );
		interruptionOptions.onPresentationStateChange?.( InterruptionScreenState.WAITING );
		interruptionOptions.onPresentationStateChange?.( InterruptionScreenState.READY );
		expect( pageMocks.wellbeingSummaryController.refresh ).toHaveBeenCalledTimes( 2 );
		expect( pageMocks.wellbeingSummaryController.start ).toHaveBeenCalledOnce();
		const layerOptions = pageMocks.createProtectedPageLayerController.mock.calls[ 0 ]?.[ 0 ];

		if ( layerOptions === undefined ) {
			throw new TypeError( 'Expected protected-page layer controller options.' );
		}

		await layerOptions.reconcileAllowanceExpiry( AllowanceIdSchema.parse( 'allowance_1' ) );
		expect( pageMocks.sendMessage ).toHaveBeenLastCalledWith( {
			type: 'reconcile-allowance-expiry',
			allowanceId: 'allowance_1',
		} );
		const request = {
			type: 'connect',
			documentVisible: true,
		} as const;

		await expect( interruptionOptions.runtime.sendMessage( request ) ).resolves.toEqual( {
			state: 'waiting',
		} );
		expect( pageMocks.sendMessage ).toHaveBeenCalledWith( request );

		pageMocks.handleMessage.mockRejectedValueOnce( new Error( 'Controller failed.' ) );
		const rejectedResponse = vi.fn();

		expect( messageListener( message, {}, rejectedResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( rejectedResponse ).toHaveBeenCalledWith();
		} );
	} );

	it( 'applies live language changes only to the owned protected-page layer', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: pageMocks.append, lang: 'pt-BR' },
			hasFocus: vi.fn().mockReturnValue( true ),
			title: 'Visited page title',
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		pageMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: pageMocks.handleMessage,
			stop: vi.fn(),
		} );
		const { mountProtectedPageLayer } = await import( './index' );

		await mountProtectedPageLayer();
		const layer = pageMocks.append.mock.calls[ 0 ]?.[ 0 ];

		if ( layer === undefined ) {
			throw new TypeError( 'Expected the localized protected-page layer.' );
		}

		pageMocks.languageChangeListener.value?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( layer.copy ).toBe( pageMocks.liveLocalization.protectedPageLayer );
		} );

		expect( pageMocks.createLocalizedProtectedPageCopy ).toHaveBeenLastCalledWith( Language.JAPANESE );
		expect( layer.lang ).toBe( 'ja' );
		expect( layer.interruptionCopy ).toBe( pageMocks.liveLocalization.interruption );
		expect( layer.interruptionScreen.wellbeingSummary )
			.toBe( pageMocks.liveLocalization.wellbeing.neutral );
		expect( pageMocks.wellbeingSummaryController.setCopy )
			.toHaveBeenLastCalledWith( pageMocks.liveLocalization.wellbeing );
		expect( documentTarget.title ).toBe( 'Visited page title' );
		expect( documentTarget.documentElement.lang ).toBe( 'pt-BR' );
	} );

	it( 'does not trust an arbitrary pre-existing protected-page element', async () => {
		const existingLayer = new pageMocks.ComponentProtectedPageLayer();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: pageMocks.append },
			querySelector: vi.fn().mockReturnValue( existingLayer ),
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		pageMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: pageMocks.handleMessage,
			stop: vi.fn(),
		} );

		const { mountProtectedPageLayer } = await import( './index' );

		await mountProtectedPageLayer();

		expect( pageMocks.append ).toHaveBeenCalledOnce();
		expect( pageMocks.append ).not.toHaveBeenCalledWith( existingLayer );
		expect( pageMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		expect( pageMocks.createProtectedPageLayerController ).toHaveBeenCalledOnce();
	} );

	it( 'reattaches its owned layer before handling a later command', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: pageMocks.append },
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		pageMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: pageMocks.handleMessage,
			stop: vi.fn(),
		} );
		pageMocks.handleMessage.mockResolvedValue( undefined );
		const { mountProtectedPageLayer } = await import( './index' );

		await mountProtectedPageLayer();
		const ownedLayer = pageMocks.append.mock.calls[ 0 ]?.[ 0 ];

		if ( ! ( ownedLayer instanceof pageMocks.ComponentProtectedPageLayer ) ) {
			throw new TypeError( 'Expected the service to append its owned layer.' );
		}

		ownedLayer.connected = false;
		const messageListener = pageMocks.addMessageListener.mock.calls[ 0 ]?.[ 0 ];

		if ( messageListener === undefined ) {
			throw new TypeError( 'Expected the protected-page message listener.' );
		}

		messageListener( { type: 'get-protected-page-presentation-status' }, {}, vi.fn() );

		expect( pageMocks.append ).toHaveBeenCalledTimes( 2 );
		expect( pageMocks.append ).toHaveBeenLastCalledWith( ownedLayer );
	} );

	it( 'shares one initialization while concurrent mounts are pending', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: pageMocks.append },
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		pageMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: pageMocks.handleMessage,
			stop: vi.fn(),
		} );
		const { mountProtectedPageLayer } = await import( './index' );

		const firstMount: unknown = mountProtectedPageLayer();
		const secondMount: unknown = mountProtectedPageLayer();

		expect( secondMount ).toBe( firstMount );
		expect( firstMount ).toBeInstanceOf( Promise );
		expect( secondMount ).toBeInstanceOf( Promise );
		if ( ! ( firstMount instanceof Promise ) || ! ( secondMount instanceof Promise ) ) {
			throw new TypeError( 'Expected concurrent service mounts to return promises.' );
		}
		await Promise.all( [ firstMount, secondMount ] );
		expect( pageMocks.append ).toHaveBeenCalledOnce();
		expect( pageMocks.addMessageListener ).toHaveBeenCalledOnce();
	} );

	it( 'removes its layer when startup fails before preferences listeners exist', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: pageMocks.append },
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );
		const startupError = new Error( 'Interruption screen unavailable.' );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		pageMocks.createWellbeingSummaryController.mockImplementationOnce( () => {
			throw startupError;
		} );
		const { mountProtectedPageLayer } = await import( './index' );

		await expect( mountProtectedPageLayer() ).rejects.toBe( startupError );
		const layer = pageMocks.append.mock.calls[ 0 ]?.[ 0 ];

		expect( layer?.connectionGuardEnabled ).toBe( false );
		expect( layer?.connected ).toBe( false );
		expect( pageMocks.preferencesController.addPreferencesChangeListener )
			.not.toHaveBeenCalled();
		expect( pageMocks.preferencesController.removePreferencesChangeListener )
			.not.toHaveBeenCalled();
		expect( pageMocks.preferencesController.removeLanguageChangeListener )
			.not.toHaveBeenCalled();
		expect( pageMocks.preferencesController.stop ).toHaveBeenCalledOnce();
	} );

	it( 'clears a failed initialization so a later injection can retry', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: pageMocks.append },
			visibilityState: 'visible',
		} );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia: vi.fn().mockReturnValue( Object.assign( new EventTarget(), { matches: false } ) ),
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );
		const interruptionController: InterruptionPageController = {
			start: vi.fn(),
			stop: vi.fn(),
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		pageMocks.createInterruptionPageController
			.mockImplementationOnce( () => {
				throw new Error( 'First initialization failed.' );
			} )
			.mockReturnValue( interruptionController );
		pageMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: pageMocks.handleMessage,
			stop: vi.fn(),
		} );
		const { mountProtectedPageLayer } = await import( './index' );

		await expect( mountProtectedPageLayer() ).rejects.toThrow( 'First initialization failed.' );
		expect( pageMocks.preferencesController.stop ).toHaveBeenCalledOnce();
		expect( pageMocks.wellbeingSummaryController.start ).toHaveBeenCalledOnce();
		expect( pageMocks.wellbeingSummaryController.stop ).toHaveBeenCalledOnce();
		expect( pageMocks.preferencesController.removePreferencesChangeListener )
			.not.toHaveBeenCalled();
		expect( pageMocks.preferencesController.removeLanguageChangeListener ).toHaveBeenCalledOnce();
		expect( pageMocks.append.mock.calls[ 0 ]?.[ 0 ]?.connectionGuardEnabled ).toBe( false );
		expect( pageMocks.append.mock.calls[ 0 ]?.[ 0 ]?.connected ).toBe( false );
		await mountProtectedPageLayer();

		expect( pageMocks.append ).toHaveBeenCalledTimes( 2 );
		expect( pageMocks.addMessageListener ).toHaveBeenCalledOnce();
	} );
} );
