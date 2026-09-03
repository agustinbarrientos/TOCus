import { describe, expect, it, vi } from 'vitest';
import {
	ProtectedPageMessageType,
	type ProtectedPagePresentationStatus,
} from '../../../protection-runtime/types/protected-page-message';
import {
	createProtectedPageLayerController,
} from './index';
import {
	type ProtectedPageLayerControllerOptions,
	type ProtectedPageLayerScheduler,
	type ProtectedPageLayerView,
} from './types';

/** One deterministically scheduled timeout callback. */
interface ScheduledTimeout {
	/** Callback executed when the timeout elapses. */
	callback: () => void;
	/** Exact delay supplied while scheduling the callback. */
	delayMilliseconds: number;
}

/** In-memory view used to observe protected-page presentation behavior. */
class MemoryProtectedPageLayerView implements ProtectedPageLayerView {
	interruptionLayerPresented = false;

	warningRemainingSeconds: number | null = null;

	/**
	 * Resolves after the in-memory presentation is immediately ready.
	 * @return Resolved presentation operation.
	 */
	waitForInterruptionPresentation(): Promise<void> {
		return Promise.resolve();
	}
}

/** Deterministic scheduler that exposes registered callbacks to each test. */
class ManualProtectedPageLayerScheduler implements ProtectedPageLayerScheduler {
	intervalCallback: ( () => void ) | null = null;

	intervalDelay: number | null = null;

	/** Next unique timeout handle. */
	private nextTimeoutHandle = 1;

	/** Scheduled timeout callbacks indexed by handle. */
	private readonly timeouts = new Map<number, ScheduledTimeout>();

	/**
	 * Returns the most recently scheduled timeout callback.
	 * @return Latest timeout callback or null.
	 */
	get timeoutCallback(): ( () => void ) | null {
		return Array.from( this.timeouts.values() ).at( -1 )?.callback ?? null;
	}

	/**
	 * Returns the most recently scheduled timeout delay.
	 * @return Latest timeout delay or null.
	 */
	get timeoutDelay(): number | null {
		return Array.from( this.timeouts.values() ).at( -1 )?.delayMilliseconds ?? null;
	}

	/** Clears the current interval callback. */
	clearInterval(): void {
		this.intervalCallback = null;
		this.intervalDelay = null;
	}

	/**
	 * Clears one scheduled timeout callback.
	 * @param handle - Deterministic timeout handle.
	 */
	clearTimeout( handle: number ): void {
		this.timeouts.delete( handle );
	}

	/**
	 * Captures one recurring callback.
	 * @param callback - Callback to retain.
	 * @param delayMilliseconds - Delay between callback executions.
	 * @return Deterministic interval handle.
	 */
	setInterval( callback: () => void, delayMilliseconds: number ): number {
		this.intervalCallback = callback;
		this.intervalDelay = delayMilliseconds;
		return 1;
	}

	/**
	 * Captures one one-shot callback.
	 * @param callback - Callback to retain.
	 * @param delayMilliseconds - Delay before callback execution.
	 * @return Deterministic timeout handle.
	 */
	setTimeout( callback: () => void, delayMilliseconds: number ): number {
		const handle = this.nextTimeoutHandle;

		this.nextTimeoutHandle += 1;
		this.timeouts.set( handle, { callback, delayMilliseconds } );
		return handle;
	}

	/**
	 * Returns the callback scheduled for one exact delay.
	 * @param delayMilliseconds - Exact scheduled delay to find.
	 * @return Matching timeout callback or null.
	 */
	getTimeoutCallback( delayMilliseconds: number ): ( () => void ) | null {
		return Array.from( this.timeouts.values() ).find(
			( timeout ) => timeout.delayMilliseconds === delayMilliseconds,
		)?.callback ?? null;
	}
}

/**
 * Creates a protected-page controller harness with observable lifecycle counters.
 * @param now - Optional clock override for boundary-race tests.
 * @return Controller dependencies and mutable observations.
 */
function createHarness( now?: () => number ) {
	const clock = { now: 1_000 };
	const lifecycle = { starts: 0, stops: 0 };
	const reconcileAllowanceExpiry = vi.fn().mockResolvedValue( undefined );
	const scheduler = new ManualProtectedPageLayerScheduler();
	const view = new MemoryProtectedPageLayerView();
	const options: ProtectedPageLayerControllerOptions = {
		clock: {
			/**
			 * Returns the mutable fixture time.
			 * @return Current fixture time.
			 */
			now: now ?? ( () => clock.now ),
		},
		interruptionController: {
			/**
			 * Starts one observable controller lifecycle.
			 * @return Resolved connection operation.
			 */
			start: () => {
				lifecycle.starts += 1;
				return Promise.resolve();
			},
			/** Stops one observable controller lifecycle. */
			stop: () => {
				lifecycle.stops += 1;
			},
		},
		reconcileAllowanceExpiry,
		scheduler,
		view,
	};

	return {
		clock,
		controller: createProtectedPageLayerController( options ),
		lifecycle,
		reconcileAllowanceExpiry,
		scheduler,
		view,
	};
}

describe( 'protected-page layer controller', () => {
	it( 'reports only local presentation state to the background', async () => {
		const { controller } = createHarness();

		await expect( controller.handleMessage( {
			type: ProtectedPageMessageType.GET_PRESENTATION_STATUS,
		} ) ).resolves.toEqual( {
			allowanceWarningId: null,
			interruptionLayerPresented: false,
		} satisfies ProtectedPagePresentationStatus );
	} );

	it( 'updates the final warning and reconciles at the exact allowance boundary', async () => {
		const { clock, controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );

		expect( view.warningRemainingSeconds ).toBe( 10 );
		expect( scheduler.intervalDelay ).toBe( 1_000 );
		expect( scheduler.timeoutDelay ).toBe( 10_000 );

		clock.now = 2_001;
		scheduler.intervalCallback?.();
		expect( view.warningRemainingSeconds ).toBe( 9 );

		scheduler.timeoutCallback?.();
		await Promise.resolve();
		expect( view.warningRemainingSeconds ).toBeNull();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledOnce();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledWith( 'allowance_1' );
		await expect( controller.handleMessage( {
			type: ProtectedPageMessageType.GET_PRESENTATION_STATUS,
		} ) ).resolves.toEqual( {
			allowanceWarningId: null,
			interruptionLayerPresented: false,
		} );
	} );

	it( 'arms an exact local expiry guard before the warning window', async () => {
		const { controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} );

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.intervalCallback ).toBeNull();
		expect( scheduler.timeoutDelay ).toBe( 60_000 );
		expect( reconcileAllowanceExpiry ).not.toHaveBeenCalled();

		scheduler.timeoutCallback?.();
		await Promise.resolve();

		expect( reconcileAllowanceExpiry ).toHaveBeenCalledOnce();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledWith( 'allowance_1' );
	} );

	it( 'keeps an identical expiry guard without replacing its callback', async () => {
		const { controller, scheduler } = createHarness();
		const message = {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} as const;

		await controller.handleMessage( message );
		const expiry = scheduler.timeoutCallback;
		await controller.handleMessage( message );

		expect( scheduler.timeoutCallback ).toBe( expiry );
		expect( scheduler.timeoutDelay ).toBe( 60_000 );
	} );

	it( 'keeps identical expiry and future warning callbacks without replacing them', async () => {
		const { controller, scheduler } = createHarness();
		const message = {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 61_000,
		} as const;

		await controller.handleMessage( message );
		const expiry = scheduler.getTimeoutCallback( 60_000 );
		const warningStart = scheduler.getTimeoutCallback( 50_000 );
		await controller.handleMessage( message );

		expect( scheduler.getTimeoutCallback( 60_000 ) ).toBe( expiry );
		expect( scheduler.getTimeoutCallback( 50_000 ) ).toBe( warningStart );
	} );

	it( 'ignores a stale expiry callback after the same allowance receives a newer expiry', async () => {
		const { controller, reconcileAllowanceExpiry, scheduler } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} );
		const staleExpiry = scheduler.timeoutCallback;

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 91_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} );
		staleExpiry?.();
		await Promise.resolve();

		expect( scheduler.timeoutDelay ).toBe( 90_000 );
		expect( reconcileAllowanceExpiry ).not.toHaveBeenCalled();
	} );

	it( 'cancels the local expiry guard when authoritative state changes', async () => {
		const { controller, reconcileAllowanceExpiry, scheduler } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} );
		const staleExpiry = scheduler.timeoutCallback;

		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
		} );
		staleExpiry?.();
		await Promise.resolve();

		expect( scheduler.timeoutCallback ).toBeNull();
		expect( reconcileAllowanceExpiry ).not.toHaveBeenCalled();
	} );

	it( 'ignores stale warning removal after a newer allowance warning replaces it', async () => {
		const { controller, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_2',
			expiresAtEpochMilliseconds: 9_000,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
		} );

		expect( view.warningRemainingSeconds ).toBe( 8 );
	} );

	it( 'replaces a mismatched expiry guard before preserving the matching warning guard', async () => {
		const { controller, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 61_000,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 91_000,
		} );
		const matchingExpiry = scheduler.getTimeoutCallback( 90_000 );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 91_000,
		} );

		expect( view.warningRemainingSeconds ).toBe( 90 );
		expect( scheduler.getTimeoutCallback( 90_000 ) ).toBe( matchingExpiry );
	} );

	it( 'removes the warning whose allowance identity still matches', async () => {
		const { controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
		} );

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.timeoutCallback ).not.toBeNull();
		scheduler.timeoutCallback?.();
		await Promise.resolve();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledWith( 'allowance_1' );
	} );

	it( 'ignores a stale refresh callback after its warning is removed', async () => {
		const { controller, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );
		const staleRefresh = scheduler.intervalCallback;

		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
		} );
		staleRefresh?.();

		expect( view.warningRemainingSeconds ).toBeNull();
	} );

	it( 'reconciles immediately without scheduling a warning when the allowance already expired', async () => {
		const { clock, controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();
		clock.now = 12_000;

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.intervalCallback ).toBeNull();
		expect( scheduler.timeoutCallback ).toBeNull();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledWith( 'allowance_1' );
	} );

	it( 'reconciles when the allowance expires while its warning is being armed', async () => {
		const now = vi.fn()
			.mockReturnValueOnce( 1_000 )
			.mockReturnValue( 11_000 );
		const { controller, reconcileAllowanceExpiry, scheduler, view } = createHarness( now );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );
		await Promise.resolve();

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.intervalCallback ).toBeNull();
		expect( scheduler.timeoutCallback ).toBeNull();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledWith( 'allowance_1' );
	} );

	it( 'contains a rejected local expiry reconciliation request', async () => {
		const { controller, reconcileAllowanceExpiry, scheduler } = createHarness();

		reconcileAllowanceExpiry.mockRejectedValue( new Error( 'Background unavailable.' ) );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		} );
		scheduler.timeoutCallback?.();
		await Promise.resolve();

		expect( reconcileAllowanceExpiry ).toHaveBeenCalledOnce();
	} );

	it( 'presents the final warning from the local boundary before exact expiry', async () => {
		const { clock, controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 61_000,
		} );
		const warningStart = scheduler.getTimeoutCallback( 50_000 );
		const expiry = scheduler.getTimeoutCallback( 60_000 );

		expect( warningStart ).not.toBeNull();
		expect( expiry ).not.toBeNull();
		expect( view.warningRemainingSeconds ).toBeNull();

		clock.now = 51_000;
		warningStart?.();
		expect( view.warningRemainingSeconds ).toBe( 10 );
		expect( scheduler.intervalDelay ).toBe( 1_000 );
		expect( reconcileAllowanceExpiry ).not.toHaveBeenCalled();

		clock.now = 61_000;
		expiry?.();
		await Promise.resolve();
		expect( view.warningRemainingSeconds ).toBeNull();
		expect( reconcileAllowanceExpiry ).toHaveBeenCalledWith( 'allowance_1' );
	} );

	it( 'removes a local warning at the active-schedule boundary without expiring the allowance', async () => {
		const { clock, controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 56_000,
		} );
		const warningStart = scheduler.getTimeoutCallback( 50_000 );

		clock.now = 51_000;
		warningStart?.();
		const warningEnd = scheduler.getTimeoutCallback( 5_000 );
		expect( view.warningRemainingSeconds ).toBe( 10 );

		clock.now = 56_000;
		warningEnd?.();
		expect( view.warningRemainingSeconds ).toBeNull();
		expect( reconcileAllowanceExpiry ).not.toHaveBeenCalled();
	} );

	it( 'does not present a locally scheduled warning after its schedule interval already ended', async () => {
		const { clock, controller, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 56_000,
		} );
		const delayedWarningStart = scheduler.getTimeoutCallback( 50_000 );

		clock.now = 56_000;
		delayedWarningStart?.();

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.intervalCallback ).toBeNull();
	} );

	it( 'does not present a direct warning before its schedule interval starts', async () => {
		const { controller, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 56_000,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
		} );

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.intervalCallback ).toBeNull();
	} );

	it( 'removes a bounded warning when its refresh observes a delayed schedule-end timeout', async () => {
		const { clock, controller, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 1_000,
			warningEndsAtEpochMilliseconds: 6_000,
		} );
		const warningRefresh = scheduler.intervalCallback;

		expect( view.warningRemainingSeconds ).toBe( 60 );
		clock.now = 6_000;
		warningRefresh?.();

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.intervalCallback ).toBeNull();
	} );

	it( 'keeps an identical expiry guard while clearing a warning whose schedule interval elapsed', async () => {
		const { clock, controller, scheduler, view } = createHarness();
		const message = {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 1_000,
			warningEndsAtEpochMilliseconds: 6_000,
		} as const;

		await controller.handleMessage( message );
		const expiry = scheduler.getTimeoutCallback( 60_000 );
		clock.now = 6_000;
		await controller.handleMessage( message );

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( scheduler.getTimeoutCallback( 60_000 ) ).toBe( expiry );
	} );

	it( 'ignores a stale schedule-end callback after the guard changes', async () => {
		const { clock, controller, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 1_000,
			warningEndsAtEpochMilliseconds: 6_000,
		} );
		const staleWarningEnd = scheduler.getTimeoutCallback( 5_000 );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_2',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 1_000,
			warningEndsAtEpochMilliseconds: 7_000,
		} );

		clock.now = 6_000;
		staleWarningEnd?.();

		expect( view.warningRemainingSeconds ).toBe( 60 );
		scheduler.intervalCallback?.();
		expect( view.warningRemainingSeconds ).toBe( 55 );
	} );

	it( 'presents an already reached local warning boundary without replacing an identical guard', async () => {
		const { clock, controller, scheduler, view } = createHarness();
		clock.now = 52_000;
		const message = {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 61_000,
		} as const;

		await controller.handleMessage( message );
		const expiry = scheduler.getTimeoutCallback( 9_000 );
		const warningRefresh = scheduler.intervalCallback;
		await controller.handleMessage( message );

		expect( view.warningRemainingSeconds ).toBe( 9 );
		expect( scheduler.getTimeoutCallback( 9_000 ) ).toBe( expiry );
		expect( scheduler.intervalCallback ).toBe( warningRefresh );
	} );

	it.each( [
		{
			changedGuard: {
				allowanceId: 'allowance_2',
				expiresAtEpochMilliseconds: 61_000,
				warningStartsAtEpochMilliseconds: 51_000,
				warningEndsAtEpochMilliseconds: 61_000,
			},
			changedValue: 'allowance identity',
		},
		{
			changedGuard: {
				allowanceId: 'allowance_1',
				expiresAtEpochMilliseconds: 62_000,
				warningStartsAtEpochMilliseconds: 51_000,
				warningEndsAtEpochMilliseconds: 62_000,
			},
			changedValue: 'allowance expiry',
		},
		{
			changedGuard: {
				allowanceId: 'allowance_1',
				expiresAtEpochMilliseconds: 61_000,
				warningStartsAtEpochMilliseconds: 52_000,
				warningEndsAtEpochMilliseconds: 61_000,
			},
			changedValue: 'warning boundary',
		},
	] )( 'ignores a stale warning callback after the $changedValue changes', async ( { changedGuard } ) => {
		const { controller, reconcileAllowanceExpiry, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 61_000,
			warningStartsAtEpochMilliseconds: 51_000,
			warningEndsAtEpochMilliseconds: 61_000,
		} );
		const staleWarningStart = scheduler.getTimeoutCallback( 50_000 );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			...changedGuard,
		} );
		staleWarningStart?.();

		expect( view.warningRemainingSeconds ).toBeNull();
		expect( reconcileAllowanceExpiry ).not.toHaveBeenCalled();
	} );

	it( 'starts one modal interruption controller and dismisses it without reloading', async () => {
		const { controller, lifecycle, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );

		expect( view.interruptionLayerPresented ).toBe( true );
		expect( lifecycle.starts ).toBe( 1 );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );

		expect( view.interruptionLayerPresented ).toBe( false );
		expect( lifecycle.stops ).toBe( 1 );
	} );

	it( 'acknowledges presentation before the authoritative controller connects', async () => {
		const { view } = createHarness();
		const { promise: startOperation, resolve: resolveStart } = Promise.withResolvers<undefined>();
		const controller = createProtectedPageLayerController( {
			clock: {
				/**
				 * Returns the fixed fixture time.
				 * @return Fixed fixture time.
				 */
				now: () => 1_000,
			},
			interruptionController: {
				/**
				 * Starts one deliberately unresolved controller connection.
				 * @return Pending connection operation.
				 */
				start: () => startOperation,
				stop: vi.fn(),
			},
			reconcileAllowanceExpiry: vi.fn().mockResolvedValue( undefined ),
			scheduler: new ManualProtectedPageLayerScheduler(),
			view,
		} );

		await expect( controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} ) ).resolves.toBeUndefined();
		expect( view.interruptionLayerPresented ).toBe( true );

		resolveStart( undefined );
		await startOperation;
	} );

	it( 'does not connect until the modal presentation is visibly ready', async () => {
		const view = new MemoryProtectedPageLayerView();
		const { promise: presentationReady, resolve: resolvePresentation } = Promise.withResolvers<undefined>();
		const start = vi.fn().mockResolvedValue( undefined );

		view.waitForInterruptionPresentation = vi.fn().mockReturnValue( presentationReady );
		const controller = createProtectedPageLayerController( {
			clock: {
				/**
				 * Returns the fixed fixture time.
				 * @return Fixed fixture time.
				 */
				now: () => 1_000,
			},
			interruptionController: {
				start,
				stop: vi.fn(),
			},
			reconcileAllowanceExpiry: vi.fn().mockResolvedValue( undefined ),
			scheduler: new ManualProtectedPageLayerScheduler(),
			view,
		} );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );

		expect( view.interruptionLayerPresented ).toBe( true );
		expect( start ).not.toHaveBeenCalled();

		resolvePresentation( undefined );
		await presentationReady;
		await Promise.resolve();

		expect( start ).toHaveBeenCalledOnce();
	} );

	it( 'does not connect a presentation removed before it becomes visible', async () => {
		const view = new MemoryProtectedPageLayerView();
		const { promise: presentationReady, resolve: resolvePresentation } = Promise.withResolvers<undefined>();
		const start = vi.fn().mockResolvedValue( undefined );
		const stop = vi.fn();

		view.waitForInterruptionPresentation = vi.fn().mockReturnValue( presentationReady );
		const controller = createProtectedPageLayerController( {
			clock: {
				/**
				 * Returns the fixed fixture time.
				 * @return Fixed fixture time.
				 */
				now: () => 1_000,
			},
			interruptionController: { start, stop },
			reconcileAllowanceExpiry: vi.fn().mockResolvedValue( undefined ),
			scheduler: new ManualProtectedPageLayerScheduler(),
			view,
		} );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );
		resolvePresentation( undefined );
		await presentationReady;
		await Promise.resolve();

		expect( start ).not.toHaveBeenCalled();
		expect( stop ).toHaveBeenCalledOnce();
		expect( view.interruptionLayerPresented ).toBe( false );
	} );

	it( 'ignores a stale presentation failure after the interruption is removed', async () => {
		const view = new MemoryProtectedPageLayerView();
		const { promise: presentationReady, reject: rejectPresentation } = Promise.withResolvers<undefined>();
		const start = vi.fn().mockResolvedValue( undefined );
		const stop = vi.fn();

		view.waitForInterruptionPresentation = vi.fn().mockReturnValue( presentationReady );
		const controller = createProtectedPageLayerController( {
			clock: {
				/**
				 * Returns the fixed fixture time.
				 * @return Fixed fixture time.
				 */
				now: () => 1_000,
			},
			interruptionController: { start, stop },
			reconcileAllowanceExpiry: vi.fn().mockResolvedValue( undefined ),
			scheduler: new ManualProtectedPageLayerScheduler(),
			view,
		} );

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );
		rejectPresentation( new Error( 'Presentation was removed.' ) );
		await expect( presentationReady ).rejects.toThrow( 'Presentation was removed.' );
		await Promise.resolve();

		expect( start ).not.toHaveBeenCalled();
		expect( stop ).toHaveBeenCalledOnce();
		expect( view.interruptionLayerPresented ).toBe( false );
	} );

	it( 'ignores modal removal while no interruption controller is active', async () => {
		const { controller, lifecycle, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );

		expect( lifecycle.stops ).toBe( 0 );
		expect( view.interruptionLayerPresented ).toBe( false );
	} );

	it( 'uncovers the preserved page when asynchronous wait synchronization cannot start', async () => {
		const { view } = createHarness();

		const rejection = new Error( 'Runtime unavailable.' );
		const failingController = createProtectedPageLayerController( {
			clock: {
				/**
				 * Returns the fixed fixture time.
				 * @return Fixed fixture time.
				 */
				now: () => 1_000,
			},
			interruptionController: {
				/**
				 * Rejects one controller connection.
				 * @return Rejected connection operation.
				 */
				start: () => Promise.reject( rejection ),
				stop: vi.fn(),
			},
			reconcileAllowanceExpiry: vi.fn().mockResolvedValue( undefined ),
			scheduler: new ManualProtectedPageLayerScheduler(),
			view,
		} );

		await expect( failingController.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} ) ).resolves.toBeUndefined();
		await Promise.resolve();
		expect( view.interruptionLayerPresented ).toBe( false );
	} );

	it( 'clears a warning before presenting the modal interruption', async () => {
		const { controller, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );

		expect( view.warningRemainingSeconds ).toBeNull();
	} );

	it( 'ignores malformed and unrelated runtime messages', async () => {
		const { controller } = createHarness();

		await expect( controller.handleMessage( { type: 'unknown' } ) ).resolves.toBeUndefined();
		await expect( controller.handleMessage( null ) ).resolves.toBeUndefined();
	} );

	it( 'stops every local timer and listener during content teardown', async () => {
		const { controller, lifecycle, scheduler, view } = createHarness();

		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 11_000,
		} );
		await controller.handleMessage( {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );
		controller.stop();

		expect( scheduler.intervalCallback ).toBeNull();
		expect( scheduler.timeoutCallback ).toBeNull();
		expect( lifecycle.stops ).toBe( 1 );
		expect( view.interruptionLayerPresented ).toBe( false );
		expect( view.warningRemainingSeconds ).toBeNull();
	} );
} );
