import { describe, expect, it } from 'vitest';
import {
	InterruptionContinueRequestEventName,
	InterruptionRetryRequestEventName,
	InterruptionScreenState,
	type InterruptionScreenState as InterruptionScreenStateValue,
} from '../../components/screen/types';
import {
	InterruptionPageRequestType,
	InterruptionPageResponseState,
	type InterruptionPageRequest,
} from '../../../protection-runtime/types/runtime-message';
import { createInterruptionPageController } from './index';
import {
	type InterruptionPageController,
	type InterruptionPageClock,
	type InterruptionPageControllerOptions,
	type InterruptionPageMotionPreference,
	type InterruptionPageRuntime,
	type InterruptionPageScheduler,
	type InterruptionPageScreen,
	type InterruptionPageVisibility,
} from './types';

/**
 * Mutable interruption screen used to observe controller projections.
 * @since 0.1.0 Initial implementation.
 */
class MemoryInterruptionPageScreen extends EventTarget implements InterruptionPageScreen {
	state: InterruptionScreenStateValue = InterruptionScreenState.WAITING;

	waitDurationMilliseconds = 0;

	focusedProgressMilliseconds = 0;

	progressing = false;

	reducedMotion = false;

	recovering = false;

	displayedFocusedProgressMilliseconds = 0;

	/**
	 * Returns the focused progress currently displayed by the test screen.
	 * @return Displayed focused progress in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedProgressMilliseconds(): number {
		return this.displayedFocusedProgressMilliseconds;
	}
}

/**
 * Mutable epoch clock used by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryInterruptionPageClock implements InterruptionPageClock {
	epochMilliseconds = 0;

	/**
	 * Returns the current test epoch time.
	 * @return Current epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number {
		return this.epochMilliseconds;
	}
}

/**
 * Mutable reduced-motion preference used by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryInterruptionPageMotionPreference extends EventTarget implements InterruptionPageMotionPreference {
	matches = false;

	/**
	 * Updates the test preference and emits its browser change event.
	 * @param matches - Whether reduced motion is preferred.
	 * @since 0.1.0 Initial implementation.
	 */
	setMatches( matches: boolean ): void {
		this.matches = matches;
		this.dispatchEvent( new Event( 'change' ) );
	}
}

/**
 * Deterministic runtime message boundary used by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryInterruptionPageRuntime implements InterruptionPageRuntime {
	readonly requests: InterruptionPageRequest[] = [];

	/** Responses or failures consumed in request order. */
	readonly responses: unknown[];

	/**
	 * Creates one deterministic runtime boundary.
	 * @param responses - Ordered responses or errors returned to the controller.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( responses: unknown[] ) {
		this.responses = [ ...responses ];
	}

	/**
	 * Records one request and resolves its queued response.
	 * @param request - Valid interruption-page request.
	 * @return Queued runtime response.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage( request: InterruptionPageRequest ): Promise<unknown> {
		this.requests.push( request );
		const response = this.responses.shift();

		return response instanceof Error ? Promise.reject( response ) : Promise.resolve( response );
	}
}

/**
 * One recurring callback retained by the deterministic scheduler.
 * @since 0.1.0 Initial implementation.
 */
interface ScheduledTestInterval {
	callback: () => void;
	delayMilliseconds: number;
}

/**
 * One one-shot callback retained by the deterministic scheduler.
 * @since 0.1.0 Initial implementation.
 */
interface ScheduledTestTimeout {
	callback: () => void;
	delayMilliseconds: number;
}

/**
 * Deterministic interval scheduler used by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class ManualInterruptionPageScheduler implements InterruptionPageScheduler {
	private nextHandle = 1;

	private readonly intervals = new Map<number, ScheduledTestInterval>();

	private readonly timeouts = new Map<number, ScheduledTestTimeout>();

	private readonly clearedTimeouts: ScheduledTestTimeout[] = [];

	/**
	 * Retains one recurring callback.
	 * @param callback - Callback executed by the manual scheduler.
	 * @param delayMilliseconds - Configured recurrence delay.
	 * @return Deterministic interval handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setInterval( callback: () => void, delayMilliseconds: number ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.intervals.set( handle, { callback, delayMilliseconds } );

		return handle;
	}

	/**
	 * Removes one retained recurring callback.
	 * @param handle - Deterministic interval handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearInterval( handle: number ): void {
		this.intervals.delete( handle );
	}

	/**
	 * Retains one one-shot callback.
	 * @param callback - Callback executed by the manual scheduler.
	 * @param delayMilliseconds - Delay before execution.
	 * @return Deterministic timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number {
		const handle = this.nextHandle;

		this.nextHandle += 1;
		this.timeouts.set( handle, { callback, delayMilliseconds } );

		return handle;
	}

	/**
	 * Removes one retained one-shot callback.
	 * @param handle - Deterministic timeout handle.
	 * @since 0.1.0 Initial implementation.
	 */
	clearTimeout( handle: number ): void {
		const timeout = this.timeouts.get( handle );

		if ( timeout !== undefined ) {
			this.clearedTimeouts.push( timeout );
		}
		this.timeouts.delete( handle );
	}

	/**
	 * Executes every currently retained interval callback once.
	 * @since 0.1.0 Initial implementation.
	 */
	runIntervals(): void {
		for ( const interval of this.intervals.values() ) {
			interval.callback();
		}
	}

	/**
	 * Executes and removes every currently retained timeout callback.
	 * @since 0.1.0 Initial implementation.
	 */
	runTimeouts(): void {
		const timeouts = [ ...this.timeouts.values() ];

		this.timeouts.clear();
		for ( const timeout of timeouts ) {
			timeout.callback();
		}
	}

	/**
	 * Executes callbacks retained before their cancellation to simulate an already queued browser task.
	 * @since 0.1.0 Initial implementation.
	 */
	runClearedTimeouts(): void {
		const timeouts = this.clearedTimeouts.splice( 0 );

		for ( const timeout of timeouts ) {
			timeout.callback();
		}
	}

	/**
	 * Returns every retained recurrence delay.
	 * @return Configured interval delays in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	getDelaysMilliseconds(): number[] {
		return [ ...this.intervals.values() ].map( ( interval ) => interval.delayMilliseconds );
	}

	/**
	 * Returns every retained one-shot delay.
	 * @return Configured timeout delays in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	getTimeoutDelaysMilliseconds(): number[] {
		return [ ...this.timeouts.values() ].map( ( timeout ) => timeout.delayMilliseconds );
	}
}

/**
 * Mutable document visibility observed by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryInterruptionPageVisibility implements InterruptionPageVisibility {
	documentVisible = true;

	windowFocused = true;

	/**
	 * Reports current test-document visibility.
	 * @return Whether the test document is visible.
	 * @since 0.1.0 Initial implementation.
	 */
	isDocumentVisible(): boolean {
		return this.documentVisible;
	}

	/**
	 * Reports current test-window focus.
	 * @return Whether the test window is focused.
	 * @since 0.1.0 Initial implementation.
	 */
	isWindowFocused(): boolean {
		return this.windowFocused;
	}
}

/**
 * Complete deterministic controller fixture.
 * @since 0.1.0 Initial implementation.
 */
interface InterruptionPageControllerFixture {
	clock: MemoryInterruptionPageClock;
	controller: InterruptionPageController;
	documentTarget: EventTarget;
	runtime: MemoryInterruptionPageRuntime;
	motionPreference: MemoryInterruptionPageMotionPreference;
	scheduler: ManualInterruptionPageScheduler;
	screen: MemoryInterruptionPageScreen;
	visibility: MemoryInterruptionPageVisibility;
	windowTarget: EventTarget;
}

/**
 * Creates one controller with deterministic page dependencies.
 * @param responses - Ordered runtime responses or failures.
 * @return Complete controller fixture.
 * @since 0.1.0 Initial implementation.
 */
function createControllerFixture( responses: unknown[] ): InterruptionPageControllerFixture {
	const clock = new MemoryInterruptionPageClock();
	const documentTarget = new EventTarget();
	const motionPreference = new MemoryInterruptionPageMotionPreference();
	const runtime = new MemoryInterruptionPageRuntime( responses );
	const scheduler = new ManualInterruptionPageScheduler();
	const screen = new MemoryInterruptionPageScreen();
	const visibility = new MemoryInterruptionPageVisibility();
	const windowTarget = new EventTarget();
	const options: InterruptionPageControllerOptions = {
		clock,
		documentTarget,
		motionPreference,
		runtime,
		scheduler,
		screen,
		visibility,
		windowTarget,
	};

	return {
		clock,
		controller: createInterruptionPageController( options ),
		documentTarget,
		motionPreference,
		runtime,
		scheduler,
		screen,
		visibility,
		windowTarget,
	};
}

/**
 * Waits for queued controller requests and projections to settle.
 * @return Promise resolved after the next task.
 * @since 0.1.0 Initial implementation.
 */
function settleControllerRequests(): Promise<void> {
	return new Promise( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
}

describe( 'createInterruptionPageController', () => {
	it( 'connects once and projects authoritative Waiting state', async () => {
		const fixture = createControllerFixture( [ {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 2_000,
			progressing: true,
		} ] );

		await fixture.controller.start();

		expect( fixture.runtime.requests ).toEqual( [ {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		} ] );
		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [ 1_000 ] );
		expect( fixture.screen ).toMatchObject( {
			state: InterruptionScreenState.WAITING,
			waitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 2_000,
			progressing: true,
		} );
	} );

	it.each( [
		{ label: 'unavailable response', response: { state: InterruptionPageResponseState.UNAVAILABLE } },
		{ label: 'malformed response', response: { state: 'unknown' } },
		{ label: 'runtime failure', response: new Error( 'Runtime unavailable' ) },
	] )( 'silently recovers an initial $label with one runtime recovery', async ( { response } ) => {
		const recoveryResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [ response, recoveryResponse.promise ] );
		const startPromise = fixture.controller.start();

		await settleControllerRequests();

		expect( fixture.runtime.requests ).toEqual( [
			{
				type: InterruptionPageRequestType.CONNECT,
				documentVisible: true,
			},
			{
				type: InterruptionPageRequestType.RECOVER,
				documentVisible: true,
			},
		] );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.WAITING );

		recoveryResponse.resolve( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 2_000,
			progressing: true,
		} );
		await startPromise;

		expect( fixture.screen ).toMatchObject( {
			state: InterruptionScreenState.WAITING,
			focusedProgressMilliseconds: 2_000,
			progressing: true,
		} );
	} );

	it.each( [
		{ label: 'unavailable responses', response: { state: InterruptionPageResponseState.UNAVAILABLE } },
		{ label: 'malformed responses', response: { state: 'unknown' } },
		{ label: 'runtime failures', response: new Error( 'Runtime unavailable' ) },
	] )( 'shows recovery after two initial $label', async ( { response } ) => {
		const fixture = createControllerFixture( [
			response,
			response,
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
		] );

		await fixture.controller.start();

		expect( fixture.runtime.requests.map( ( request ) => request.type ) ).toEqual( [
			InterruptionPageRequestType.CONNECT,
			InterruptionPageRequestType.RECOVER,
		] );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.UNAVAILABLE );
		expect( fixture.screen.recovering ).toBe( false );
	} );

	it( 'keeps explicit recovery single-flight and projects its successful response', async () => {
		const recoveryResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
			recoveryResponse.promise,
		] );

		await fixture.controller.start();
		fixture.screen.state = InterruptionScreenState.UNAVAILABLE;
		fixture.screen.dispatchEvent( new Event( InterruptionRetryRequestEventName ) );
		fixture.screen.dispatchEvent( new Event( InterruptionRetryRequestEventName ) );

		expect( fixture.screen.recovering ).toBe( true );
		expect( fixture.runtime.requests.map( ( request ) => request.type ) ).toEqual( [
			InterruptionPageRequestType.CONNECT,
			InterruptionPageRequestType.RECOVER,
		] );

		recoveryResponse.resolve( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 3_000,
			progressing: true,
		} );
		await settleControllerRequests();

		expect( fixture.screen ).toMatchObject( {
			state: InterruptionScreenState.WAITING,
			focusedProgressMilliseconds: 3_000,
			progressing: true,
			recovering: false,
		} );
	} );

	it( 'makes explicit recovery available again after a recovery request fails', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
			new Error( 'Runtime unavailable.' ),
		] );

		await fixture.controller.start();
		fixture.screen.state = InterruptionScreenState.UNAVAILABLE;
		fixture.screen.dispatchEvent( new Event( InterruptionRetryRequestEventName ) );
		await settleControllerRequests();

		expect( fixture.runtime.requests.map( ( request ) => request.type ) ).toEqual( [
			InterruptionPageRequestType.CONNECT,
			InterruptionPageRequestType.RECOVER,
		] );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.UNAVAILABLE );
		expect( fixture.screen.recovering ).toBe( false );
	} );

	it( 'clears explicit recovery and ignores its late response after stopping', async () => {
		const recoveryResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
			recoveryResponse.promise,
		] );

		await fixture.controller.start();
		fixture.screen.state = InterruptionScreenState.UNAVAILABLE;
		fixture.screen.dispatchEvent( new Event( InterruptionRetryRequestEventName ) );
		expect( fixture.screen.recovering ).toBe( true );

		fixture.controller.stop();
		expect( fixture.screen.recovering ).toBe( false );
		recoveryResponse.resolve( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 300_000,
		} );
		await settleControllerRequests();

		expect( fixture.screen.state ).toBe( InterruptionScreenState.UNAVAILABLE );
	} );

	it( 'checkpoints displayed Waiting progress every second and adopts Ready', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 300_000,
			},
		] );

		await fixture.controller.start();
		fixture.screen.displayedFocusedProgressMilliseconds = 4_250;
		fixture.scheduler.runIntervals();
		await settleControllerRequests();

		expect( fixture.runtime.requests.at( 1 ) ).toEqual( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true,
			displayedFocusedDurationMilliseconds: 4_250,
		} );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.READY );
		expect( fixture.screen.progressing ).toBe( false );
		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [ 300_000 ] );
	} );

	it( 'synchronizes exactly when a Ready allowance expires without recurring polling', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 120_000,
			},
			{ state: InterruptionPageResponseState.READY_EXPIRED },
		] );

		fixture.clock.epochMilliseconds = 100_000;
		await fixture.controller.start();

		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [ 20_000 ] );

		fixture.clock.epochMilliseconds = 120_000;
		fixture.scheduler.runTimeouts();
		await settleControllerRequests();

		expect( fixture.runtime.requests.at( 1 ) ).toEqual( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		} );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.READY_EXPIRED );
		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [] );
	} );

	it( 'replaces the Ready expiry timeout when authoritative expiry changes', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 120_000,
			},
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 180_000,
			},
		] );

		fixture.clock.epochMilliseconds = 100_000;
		await fixture.controller.start();
		fixture.clock.epochMilliseconds = 110_000;
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		await settleControllerRequests();

		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [ 70_000 ] );

		fixture.controller.stop();

		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [] );
	} );

	it( 'ignores an already queued Ready expiry callback after state changes', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 120_000,
			},
			{ state: InterruptionPageResponseState.READY_EXPIRED },
		] );

		fixture.clock.epochMilliseconds = 100_000;
		await fixture.controller.start();
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		await settleControllerRequests();
		fixture.scheduler.runClearedTimeouts();
		await settleControllerRequests();

		expect( fixture.screen.state ).toBe( InterruptionScreenState.READY_EXPIRED );
		expect( fixture.runtime.requests ).toHaveLength( 2 );
	} );

	it( 'ignores Ready state received after stopping during the initial request', async () => {
		const readyResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [ readyResponse.promise ] );
		const startPromise = fixture.controller.start();

		fixture.controller.stop();
		readyResponse.resolve( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 120_000,
		} );
		await startPromise;

		expect( fixture.screen.state ).toBe( InterruptionScreenState.WAITING );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [] );
	} );

	it( 'ignores a runtime failure received after stopping during the initial request', async () => {
		const pendingResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [ pendingResponse.promise ] );
		const startPromise = fixture.controller.start();

		fixture.controller.stop();
		pendingResponse.reject( new Error( 'Runtime stopped.' ) );
		await startPromise;

		expect( fixture.screen.state ).toBe( InterruptionScreenState.WAITING );
		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [] );
	} );

	it( 'ignores a recovered state received after stopping during automatic recovery', async () => {
		const recoveryResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [
			{ state: InterruptionPageResponseState.UNAVAILABLE },
			recoveryResponse.promise,
		] );
		const startPromise = fixture.controller.start();

		await settleControllerRequests();
		expect( fixture.runtime.requests.map( ( request ) => request.type ) ).toEqual( [
			InterruptionPageRequestType.CONNECT,
			InterruptionPageRequestType.RECOVER,
		] );
		fixture.controller.stop();
		recoveryResponse.resolve( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 120_000,
		} );
		await startPromise;

		expect( fixture.screen.state ).toBe( InterruptionScreenState.WAITING );
		expect( fixture.screen.recovering ).toBe( false );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [] );
	} );

	it( 'preserves a fresh Connect request over attention changes after restarting', async () => {
		const staleReadyResponse = Promise.withResolvers<unknown>();
		const freshWaitingResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [
			staleReadyResponse.promise,
			freshWaitingResponse.promise,
		] );
		const firstStart = fixture.controller.start();
		let secondStartSettled = false;

		fixture.controller.stop();
		const secondStart = fixture.controller.start().then( () => {
			secondStartSettled = true;
		} );
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		staleReadyResponse.resolve( {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 120_000,
		} );
		await firstStart;
		await settleControllerRequests();

		expect( fixture.runtime.requests.map( ( request ) => request.type ) ).toEqual( [
			InterruptionPageRequestType.CONNECT,
			InterruptionPageRequestType.CONNECT,
		] );
		expect( secondStartSettled ).toBe( false );
		freshWaitingResponse.resolve( {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 15_000,
			focusedProgressMilliseconds: 4_000,
			progressing: true,
		} );
		await secondStart;
		expect( fixture.screen ).toMatchObject( {
			state: InterruptionScreenState.WAITING,
			waitDurationMilliseconds: 15_000,
			focusedProgressMilliseconds: 4_000,
			progressing: true,
		} );
	} );

	it( 'ignores an already queued Ready expiry callback after stopping', async () => {
		const fixture = createControllerFixture( [ {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 120_000,
		} ] );

		fixture.clock.epochMilliseconds = 100_000;
		await fixture.controller.start();
		fixture.controller.stop();
		fixture.scheduler.runClearedTimeouts();
		await settleControllerRequests();

		expect( fixture.runtime.requests ).toHaveLength( 1 );
	} );

	it( 'runs recurring checkpoints only while Waiting can progress', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 2_000,
				progressing: false,
			},
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 2_000,
				progressing: true,
			},
		] );

		await fixture.controller.start();
		fixture.scheduler.runIntervals();
		expect( fixture.runtime.requests ).toHaveLength( 1 );
		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );

		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		await settleControllerRequests();
		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [ 1_000 ] );

		fixture.scheduler.runIntervals();
		await settleControllerRequests();
		expect( fixture.runtime.requests.at( 2 )?.type ).toBe( InterruptionPageRequestType.CHECKPOINT );
	} );

	it( 'keeps one checkpoint interval when an attention update remains active Waiting', async () => {
		const waitingResponse = {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 2_000,
			progressing: true,
		};
		const fixture = createControllerFixture( [ waitingResponse, waitingResponse ] );

		await fixture.controller.start();
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		await settleControllerRequests();

		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [ 1_000 ] );
	} );

	it( 'coalesces synchronization requests while one runtime message remains unresolved', async () => {
		const connectResponse = Promise.withResolvers<unknown>();
		const waitingResponse = {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 0,
			progressing: true,
		};
		const fixture = createControllerFixture( [ connectResponse.promise, waitingResponse ] );
		const startPromise = fixture.controller.start();
		await Promise.resolve();

		fixture.screen.displayedFocusedProgressMilliseconds = 1_000;
		fixture.visibility.documentVisible = false;
		fixture.documentTarget.dispatchEvent( new Event( 'visibilitychange' ) );
		fixture.screen.displayedFocusedProgressMilliseconds = 2_000;
		fixture.visibility.documentVisible = true;
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		fixture.screen.displayedFocusedProgressMilliseconds = 3_000;
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );

		expect( fixture.runtime.requests ).toEqual( [ {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		} ] );

		connectResponse.resolve( waitingResponse );
		await startPromise;
		await settleControllerRequests();

		expect( fixture.runtime.requests ).toEqual( [
			{
				type: InterruptionPageRequestType.CONNECT,
				documentVisible: true,
			},
			{
				type: InterruptionPageRequestType.CHECKPOINT,
				documentVisible: true,
				displayedFocusedDurationMilliseconds: 3_000,
			},
		] );
	} );

	it( 'preserves a pending Continue request over later synchronization', async () => {
		const synchronizationResponse = Promise.withResolvers<unknown>();
		const continueResponse = Promise.withResolvers<unknown>();
		const readyResponse = {
			state: InterruptionPageResponseState.READY,
			allowanceExpiresAtEpochMilliseconds: 300_000,
		};
		const fixture = createControllerFixture( [
			readyResponse,
			synchronizationResponse.promise,
			continueResponse.promise,
		] );

		await fixture.controller.start();
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		fixture.screen.dispatchEvent( new Event( InterruptionContinueRequestEventName ) );
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		synchronizationResponse.resolve( readyResponse );
		await settleControllerRequests();

		expect( fixture.runtime.requests.at( 2 ) ).toEqual( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		} );
		continueResponse.resolve( { state: InterruptionPageResponseState.READY_EXPIRED } );
		await settleControllerRequests();
	} );

	it( 'discards pending synchronization when stopped during an active request', async () => {
		const connectResponse = Promise.withResolvers<unknown>();
		const fixture = createControllerFixture( [
			connectResponse.promise,
			{ state: InterruptionPageResponseState.UNAVAILABLE },
		] );
		const startPromise = fixture.controller.start();
		await Promise.resolve();

		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		fixture.controller.stop();
		connectResponse.resolve( { state: InterruptionPageResponseState.UNAVAILABLE } );
		await startPromise;
		await settleControllerRequests();

		expect( fixture.runtime.requests ).toEqual( [ {
			type: InterruptionPageRequestType.CONNECT,
			documentVisible: true,
		} ] );
	} );

	it( 'restores current window focus when restarting after detached focus changes', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: false,
			},
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
		] );

		await fixture.controller.start();
		fixture.visibility.windowFocused = false;
		fixture.windowTarget.dispatchEvent( new Event( 'blur' ) );
		await settleControllerRequests();
		fixture.controller.stop();
		fixture.visibility.windowFocused = true;
		await fixture.controller.start();

		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [ 1_000 ] );
	} );

	it.each( [ 'blur', 'visibilitychange' ] as const )(
		'stops recurring checkpoints immediately after %s attention loss',
		async ( eventType ) => {
			const checkpointResponse = Promise.withResolvers<unknown>();
			const attentionResponse = Promise.withResolvers<unknown>();
			const fixture = createControllerFixture( [
				{
					state: InterruptionPageResponseState.WAITING,
					capturedWaitDurationMilliseconds: 10_000,
					focusedProgressMilliseconds: 0,
					progressing: true,
				},
				checkpointResponse.promise,
				attentionResponse.promise,
			] );

			await fixture.controller.start();
			fixture.scheduler.runIntervals();

			if ( eventType === 'visibilitychange' ) {
				fixture.visibility.documentVisible = false;
				fixture.documentTarget.dispatchEvent( new Event( eventType ) );
			} else {
				fixture.windowTarget.dispatchEvent( new Event( eventType ) );
			}

			expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
			checkpointResponse.resolve( {
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			} );
			await settleControllerRequests();

			expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
			attentionResponse.resolve( {
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: false,
			} );
			await settleControllerRequests();
		},
	);

	it( 'checkpoints current progress as soon as Waiting attention changes', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 3_000,
				progressing: false,
			},
		] );

		await fixture.controller.start();
		fixture.screen.displayedFocusedProgressMilliseconds = 3_000;
		fixture.visibility.documentVisible = false;
		fixture.documentTarget.dispatchEvent( new Event( 'visibilitychange' ) );
		await settleControllerRequests();

		expect( fixture.runtime.requests.at( 1 ) ).toEqual( {
			type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: false,
			displayedFocusedDurationMilliseconds: 3_000,
		} );
		expect( fixture.screen.focusedProgressMilliseconds ).toBe( 3_000 );
		expect( fixture.screen.progressing ).toBe( false );
	} );

	it( 'synchronizes non-Waiting state when browser attention changes', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 300_000,
			},
			{ state: InterruptionPageResponseState.READY_EXPIRED },
		] );

		await fixture.controller.start();
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		await settleControllerRequests();

		expect( fixture.runtime.requests.at( 1 ) ).toEqual( {
			type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true,
		} );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.READY_EXPIRED );
	} );

	it( 'does not repeat a later synchronization failure automatically', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 300_000,
			},
			new Error( 'Runtime unavailable.' ),
			{
				state: InterruptionPageResponseState.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				focusedProgressMilliseconds: 0,
				progressing: true,
			},
		] );

		await fixture.controller.start();
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		await settleControllerRequests();

		expect( fixture.runtime.requests.map( ( request ) => request.type ) ).toEqual( [
			InterruptionPageRequestType.CONNECT,
			InterruptionPageRequestType.SYNCHRONIZE,
		] );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.UNAVAILABLE );
	} );

	it( 'projects the browser reduced-motion preference and observes later changes', async () => {
		const fixture = createControllerFixture( [ {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 0,
			progressing: true,
		} ] );

		fixture.motionPreference.matches = true;
		await fixture.controller.start();

		expect( fixture.screen.reducedMotion ).toBe( true );

		fixture.motionPreference.setMatches( false );

		expect( fixture.screen.reducedMotion ).toBe( false );

		fixture.controller.stop();
		fixture.motionPreference.setMatches( true );

		expect( fixture.screen.reducedMotion ).toBe( false );
	} );

	it( 'forwards Continue and adopts the returned non-actionable state', async () => {
		const fixture = createControllerFixture( [
			{
				state: InterruptionPageResponseState.READY,
				allowanceExpiresAtEpochMilliseconds: 300_000,
			},
			{ state: InterruptionPageResponseState.READY_EXPIRED },
		] );

		await fixture.controller.start();
		fixture.screen.dispatchEvent( new Event( InterruptionContinueRequestEventName ) );
		await settleControllerRequests();

		expect( fixture.runtime.requests.at( 1 ) ).toEqual( {
			type: InterruptionPageRequestType.CONTINUE,
			documentVisible: true,
		} );
		expect( fixture.screen.state ).toBe( InterruptionScreenState.READY_EXPIRED );
		expect( fixture.screen.progressing ).toBe( false );
	} );

	it.each( [
		{ label: 'unavailable response', response: { state: InterruptionPageResponseState.UNAVAILABLE } },
		{ label: 'malformed response', response: { state: 'unknown' } },
		{ label: 'runtime failure', response: new Error( 'Runtime unavailable' ) },
	] )( 'shows unavailable after $label', async ( { response } ) => {
		const fixture = createControllerFixture( [ response ] );

		await fixture.controller.start();

		expect( fixture.screen.state ).toBe( InterruptionScreenState.UNAVAILABLE );
		expect( fixture.screen.progressing ).toBe( false );
	} );

	it( 'stops checkpoints and removes page listeners', async () => {
		const fixture = createControllerFixture( [ {
			state: InterruptionPageResponseState.WAITING,
			capturedWaitDurationMilliseconds: 10_000,
			focusedProgressMilliseconds: 0,
			progressing: true,
		} ] );

		await fixture.controller.start();
		fixture.controller.stop();
		fixture.scheduler.runIntervals();
		fixture.documentTarget.dispatchEvent( new Event( 'visibilitychange' ) );
		fixture.windowTarget.dispatchEvent( new Event( 'blur' ) );
		fixture.windowTarget.dispatchEvent( new Event( 'focus' ) );
		fixture.screen.dispatchEvent( new Event( InterruptionContinueRequestEventName ) );
		fixture.screen.dispatchEvent( new Event( InterruptionRetryRequestEventName ) );
		await settleControllerRequests();

		expect( fixture.scheduler.getDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.scheduler.getTimeoutDelaysMilliseconds() ).toEqual( [] );
		expect( fixture.runtime.requests ).toHaveLength( 1 );
	} );
} );
