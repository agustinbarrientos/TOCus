import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllowanceIdSchema } from '../../domains/protection/types/protection-value';
import {
	type InterruptionPageController,
	type InterruptionPageControllerOptions,
} from '../../features/interruption/services/interruption-page-controller/types';
import {
	type ProtectedPageLayerController,
	type ProtectedPageLayerControllerOptions,
} from '../../features/interruption/services/protected-page-layer-controller/types';
import { type ProtectedPageMessage } from '../../features/protection-runtime/types/protected-page-message';

const PROTECTED_PAGE_INITIALIZATION_KEY = Symbol.for( 'tocus.protected-page.initialization' );

/**
 * Browser message listener retained by the protected-page entrypoint.
 * @since 0.1.0 Initial implementation.
 */
type ProtectedPageMessageListener = (
	message: ProtectedPageMessage,
	sender: unknown,
	sendResponse: ( response?: unknown ) => void,
) => true;

/**
 * Creates test doubles before the entrypoint module and its mocks are evaluated.
 * @return Hoisted protected-page entrypoint doubles.
 * @since 0.1.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal protected-page layer used to verify entrypoint composition.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestProtectedPageLayer extends EventTarget {
		connected = false;

		connectionGuardEnabled = false;

		interruptionLayerPresented = false;

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
		getInterruptionScreen(): EventTarget {
			return new EventTarget();
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
	}

	return {
		ComponentProtectedPageLayer: TestProtectedPageLayer,
		addMessageListener: vi.fn<( listener: ProtectedPageMessageListener ) => void>(),
		append: vi.fn<( layer: TestProtectedPageLayer ) => void>(),
		createInterruptionPageController: vi.fn<(
			options: InterruptionPageControllerOptions,
		) => InterruptionPageController>(),
		createProtectedPageLayerController: vi.fn<(
			options: ProtectedPageLayerControllerOptions,
		) => ProtectedPageLayerController>(),
		handleMessage: vi.fn<ProtectedPageLayerController[ 'handleMessage' ]>(),
		removeMessageListener: vi.fn(),
		sendMessage: vi.fn(),
		stopLayerController: vi.fn(),
	};
} );

/**
 * Protected-page layer test double exposed by the hoisted module mocks.
 * @since 0.1.0 Initial implementation.
 */
type TestProtectedPageLayer = InstanceType<typeof entrypointMocks.ComponentProtectedPageLayer>;

vi.mock( 'wxt/browser', () => ( {
	browser: {
		runtime: {
			onMessage: {
				addListener: entrypointMocks.addMessageListener,
				removeListener: entrypointMocks.removeMessageListener,
			},
			sendMessage: entrypointMocks.sendMessage,
		},
	},
} ) );
vi.mock( '../../features/interruption/components/protected-page-layer', () => ( {
	ComponentProtectedPageLayer: entrypointMocks.ComponentProtectedPageLayer,
} ) );
vi.mock( '../../features/interruption/services/interruption-page-controller', () => ( {
	createInterruptionPageController: entrypointMocks.createInterruptionPageController,
} ) );
vi.mock( '../../features/interruption/services/protected-page-layer-controller', () => ( {
	createProtectedPageLayerController: entrypointMocks.createProtectedPageLayerController,
} ) );

describe( 'protected-page unlisted entrypoint', () => {
	beforeEach( () => {
		Reflect.deleteProperty( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY );
		vi.resetModules();
		vi.clearAllMocks();
		vi.spyOn( Date, 'now' ).mockReturnValue( 120_000 );
	} );

	afterEach( () => {
		Reflect.deleteProperty( globalThis, PROTECTED_PAGE_INITIALIZATION_KEY );
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	} );

	it( 'mounts one isolated layer and connects it to extension messaging', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			activeElement: null,
			documentElement: { append: entrypointMocks.append },
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( null ),
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
			handleMessage: entrypointMocks.handleMessage,
			stop: entrypointMocks.stopLayerController,
		};

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		entrypointMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		entrypointMocks.handleMessage.mockResolvedValue( undefined );
		entrypointMocks.sendMessage.mockResolvedValue( { state: 'waiting' } );
		entrypointMocks.createInterruptionPageController.mockReturnValue( interruptionController );
		entrypointMocks.createProtectedPageLayerController.mockReturnValue( layerController );

		const entrypoint = await import( './index' );

		await entrypoint.default.main();

		expect( entrypointMocks.append ).toHaveBeenCalledWith(
			expect.any( entrypointMocks.ComponentProtectedPageLayer ),
		);
		expect( entrypointMocks.append.mock.calls[ 0 ]?.[ 0 ]?.connectionGuardEnabled ).toBe( true );
		expect( entrypointMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		expect( entrypointMocks.createProtectedPageLayerController ).toHaveBeenCalledOnce();
		expect( entrypointMocks.addMessageListener ).toHaveBeenCalledOnce();
		const messageListener = entrypointMocks.addMessageListener.mock.calls[ 0 ]?.[ 0 ] as (
			message: ProtectedPageMessage,
			sender: unknown,
			sendResponse: ( response?: unknown ) => void,
		) => true;
		const message: ProtectedPageMessage = { type: 'get-protected-page-presentation-status' };
		const sendResponse = vi.fn();

		expect( messageListener( message, {}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledOnce();
		} );

		expect( entrypointMocks.handleMessage ).toHaveBeenCalledWith( message );
		const interruptionOptions = entrypointMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

		if ( interruptionOptions === undefined ) {
			throw new TypeError( 'Expected interruption controller options.' );
		}

		expect( interruptionOptions.clock.now() ).toBe( 120_000 );
		const layer = entrypointMocks.append.mock.calls[ 0 ]?.[ 0 ];

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
		expect( interruptionOptions.motionPreference ).toBe( motionPreference );
		const layerOptions = entrypointMocks.createProtectedPageLayerController.mock.calls[ 0 ]?.[ 0 ];

		if ( layerOptions === undefined ) {
			throw new TypeError( 'Expected protected-page layer controller options.' );
		}

		await layerOptions.reconcileAllowanceExpiry( AllowanceIdSchema.parse( 'allowance_1' ) );
		expect( entrypointMocks.sendMessage ).toHaveBeenLastCalledWith( {
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
		expect( entrypointMocks.sendMessage ).toHaveBeenCalledWith( request );

		entrypointMocks.handleMessage.mockRejectedValueOnce( new Error( 'Controller failed.' ) );
		const rejectedResponse = vi.fn();

		expect( messageListener( message, {}, rejectedResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( rejectedResponse ).toHaveBeenCalledWith();
		} );
	} );

	it( 'does not trust an arbitrary pre-existing protected-page element', async () => {
		const existingLayer = new entrypointMocks.ComponentProtectedPageLayer();
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: entrypointMocks.append },
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
		entrypointMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		entrypointMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: entrypointMocks.handleMessage,
			stop: vi.fn(),
		} );

		const entrypoint = await import( './index' );

		await entrypoint.default.main();

		expect( entrypointMocks.append ).toHaveBeenCalledOnce();
		expect( entrypointMocks.append ).not.toHaveBeenCalledWith( existingLayer );
		expect( entrypointMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		expect( entrypointMocks.createProtectedPageLayerController ).toHaveBeenCalledOnce();
	} );

	it( 'reattaches its owned layer before handling a later command', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: entrypointMocks.append },
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
		entrypointMocks.append.mockImplementation( ( layer: TestProtectedPageLayer ) => {
			layer.connected = true;
		} );
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		entrypointMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: entrypointMocks.handleMessage,
			stop: vi.fn(),
		} );
		entrypointMocks.handleMessage.mockResolvedValue( undefined );
		const entrypoint = await import( './index' );

		await entrypoint.default.main();
		const ownedLayer = entrypointMocks.append.mock.calls[ 0 ]?.[ 0 ];

		if ( ! ( ownedLayer instanceof entrypointMocks.ComponentProtectedPageLayer ) ) {
			throw new TypeError( 'Expected the entrypoint to append its owned layer.' );
		}

		ownedLayer.connected = false;
		const messageListener = entrypointMocks.addMessageListener.mock.calls[ 0 ]?.[ 0 ] as (
			message: ProtectedPageMessage,
			sender: unknown,
			sendResponse: ( response?: unknown ) => void,
		) => true;

		messageListener( { type: 'get-protected-page-presentation-status' }, {}, vi.fn() );

		expect( entrypointMocks.append ).toHaveBeenCalledTimes( 2 );
		expect( entrypointMocks.append ).toHaveBeenLastCalledWith( ownedLayer );
	} );

	it( 'shares one initialization while concurrent mounts are pending', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: entrypointMocks.append },
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
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: vi.fn(),
			stop: vi.fn(),
		} );
		entrypointMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: entrypointMocks.handleMessage,
			stop: vi.fn(),
		} );
		const entrypoint = await import( './index' );

		const firstMount: unknown = entrypoint.default.main();
		const secondMount: unknown = entrypoint.default.main();

		expect( secondMount ).toBe( firstMount );
		expect( firstMount ).toBeInstanceOf( Promise );
		expect( secondMount ).toBeInstanceOf( Promise );
		if ( ! ( firstMount instanceof Promise ) || ! ( secondMount instanceof Promise ) ) {
			throw new TypeError( 'Expected concurrent entrypoint mounts to return promises.' );
		}
		await Promise.all( [ firstMount, secondMount ] );
		expect( entrypointMocks.append ).toHaveBeenCalledOnce();
		expect( entrypointMocks.addMessageListener ).toHaveBeenCalledOnce();
	} );

	it( 'clears a failed initialization so a later injection can retry', async () => {
		const documentTarget = Object.assign( new EventTarget(), {
			documentElement: { append: entrypointMocks.append },
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
		entrypointMocks.createInterruptionPageController
			.mockImplementationOnce( () => {
				throw new Error( 'First initialization failed.' );
			} )
			.mockReturnValue( interruptionController );
		entrypointMocks.createProtectedPageLayerController.mockReturnValue( {
			handleMessage: entrypointMocks.handleMessage,
			stop: vi.fn(),
		} );
		const entrypoint = await import( './index' );

		await expect( entrypoint.default.main() ).rejects.toThrow( 'First initialization failed.' );
		await entrypoint.default.main();

		expect( entrypointMocks.append ).toHaveBeenCalledTimes( 2 );
		expect( entrypointMocks.addMessageListener ).toHaveBeenCalledOnce();
	} );
} );
