import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	InterruptionPageRequestType,
	type InterruptionPageRequest,
} from '../../features/protection-runtime/types/runtime-message';
import {
	type InterruptionPageController,
	type InterruptionPageControllerOptions,
} from '../../features/interruption/services/interruption-page-controller/types';

const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal interruption screen used to verify entrypoint composition.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestInterruptionScreen extends EventTarget {}

	return {
		ComponentInterruptionScreen: TestInterruptionScreen,
		createInterruptionPageController: vi.fn<(
			options: InterruptionPageControllerOptions,
		) => InterruptionPageController>(),
		sendMessage: vi.fn<( request: InterruptionPageRequest ) => Promise<unknown>>(),
		start: vi.fn(),
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: { runtime: { sendMessage: entrypointMocks.sendMessage } },
} ) );
vi.mock( '../../features/interruption/components/screen', () => ( {
	ComponentInterruptionScreen: entrypointMocks.ComponentInterruptionScreen,
} ) );
vi.mock( '../../features/interruption/services/interruption-page-controller', () => ( {
	createInterruptionPageController: entrypointMocks.createInterruptionPageController,
} ) );

describe( 'interruption page entrypoint', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.spyOn( Date, 'now' ).mockReturnValue( 100_000 );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	} );

	it( 'connects the controller to the browser reduced-motion preference and epoch clock', async () => {
		const interruptionScreen = new entrypointMocks.ComponentInterruptionScreen();
		const motionPreference = Object.assign( new EventTarget(), { matches: true } );
		const matchMedia = vi.fn().mockReturnValue( motionPreference );
		const windowTarget = Object.assign( new EventTarget(), {
			clearInterval: vi.fn(),
			clearTimeout: vi.fn(),
			matchMedia,
			setInterval: vi.fn(),
			setTimeout: vi.fn(),
		} );
		const documentTarget = Object.assign( new EventTarget(), {
			hasFocus: vi.fn().mockReturnValue( true ),
			querySelector: vi.fn().mockReturnValue( interruptionScreen ),
			visibilityState: 'visible',
		} );

		vi.stubGlobal( 'document', documentTarget );
		vi.stubGlobal( 'window', windowTarget );
		entrypointMocks.createInterruptionPageController.mockReturnValue( {
			start: entrypointMocks.start,
			stop: vi.fn(),
		} );
		entrypointMocks.start.mockResolvedValue( undefined );
		entrypointMocks.sendMessage.mockResolvedValue( { state: 'unavailable' } );

		await import( './index' );

		expect( matchMedia ).toHaveBeenCalledWith( '(prefers-reduced-motion: reduce)' );
		expect( entrypointMocks.createInterruptionPageController ).toHaveBeenCalledOnce();
		const options = entrypointMocks.createInterruptionPageController.mock.calls[ 0 ]?.[ 0 ];

		if ( options === undefined ) {
			throw new TypeError( 'Expected interruption page controller options.' );
		}

		expect( options.documentTarget ).toBe( documentTarget );
		expect( options.motionPreference ).toBe( motionPreference );
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
