import { describe, expect, it, vi } from 'vitest';
import { StatisticsStorageKey } from '../../../../domains/statistics/services/statistics-storage';
import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import { type StatisticsRuntimeRequest } from '../../types/runtime-message';
import { createStatisticsClient } from './index';

/**
 * Browser storage-change listener used by the statistics-client fixture.
 * @since 0.1.0 Initial implementation.
 */
type TestStorageChangeListener = (
	changes: Readonly<Record<string, { readonly newValue?: unknown }>>,
	areaName: string,
) => void;

/**
 * Mutable browser storage-change source used by statistics-client tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryStorageChangeSource {
	/**
	 * Storage-change listeners registered with the source.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly listeners = new Set<TestStorageChangeListener>();

	/**
	 * Begins delivering browser storage changes to one listener.
	 * @param listener - Browser storage-change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: TestStorageChangeListener ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops delivering browser storage changes to one listener.
	 * @param listener - Previously registered listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: TestStorageChangeListener ): void {
		this.listeners.delete( listener );
	}

	/**
	 * Emits one browser storage change to every active listener.
	 * @param changes - Changed values indexed by storage key.
	 * @param areaName - Browser storage area containing the changes.
	 * @since 0.1.0 Initial implementation.
	 */
	emit(
		changes: Readonly<Record<string, { readonly newValue?: unknown }>>,
		areaName: string,
	): void {
		for ( const listener of this.listeners ) {
			listener( changes, areaName );
		}
	}
}

/**
 * Complete available projection returned by a trusted statistics runtime.
 * @since 0.1.0 Initial implementation.
 */
const AVAILABLE_STATISTICS_PROJECTION = Object.freeze( {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: 1_200_000,
	focusedPauseMilliseconds: 42_000,
	reconsideredVisitCount: 4,
	completedWaitCount: 3,
	allowanceGrantedCount: 2,
} as const );

describe( 'createStatisticsClient', () => {
	it( 'reads and validates the current statistics projection', async () => {
		const sendMessage = vi.fn<( request: StatisticsRuntimeRequest ) => Promise<unknown>>()
			.mockResolvedValue( AVAILABLE_STATISTICS_PROJECTION );
		const client = createStatisticsClient( { runtime: { sendMessage } } );

		await expect( client.readStatistics() ).resolves.toEqual( AVAILABLE_STATISTICS_PROJECTION );
		expect( sendMessage ).toHaveBeenCalledWith( { type: 'read-statistics' } );
	} );

	it( 'resets statistics and validates the resulting projection', async () => {
		const sendMessage = vi.fn<( request: StatisticsRuntimeRequest ) => Promise<unknown>>()
			.mockResolvedValue( AVAILABLE_STATISTICS_PROJECTION );
		const client = createStatisticsClient( { runtime: { sendMessage } } );

		await expect( client.resetStatistics() ).resolves.toEqual( AVAILABLE_STATISTICS_PROJECTION );
		expect( sendMessage ).toHaveBeenCalledWith( { type: 'reset-statistics' } );
	} );

	it( 'exposes only all-time statistics and local-change operations', () => {
		const client = createStatisticsClient( { runtime: { sendMessage: vi.fn() } } );

		expect( Object.keys( client ).sort() ).toEqual( [
			'addStatisticsChangeListener',
			'readStatistics',
			'removeStatisticsChangeListener',
			'resetStatistics',
		] );
	} );

	it( 'returns unavailable when the runtime response is malformed', async () => {
		const sendMessage = vi.fn<( request: StatisticsRuntimeRequest ) => Promise<unknown>>()
			.mockResolvedValue( {
				status: StatisticsProjectionStatus.AVAILABLE,
				focusedPauseMilliseconds: -1,
			} );
		const client = createStatisticsClient( { runtime: { sendMessage } } );

		await expect( client.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
	} );

	it( 'returns unavailable when runtime messaging rejects', async () => {
		const sendMessage = vi.fn<( request: StatisticsRuntimeRequest ) => Promise<unknown>>()
			.mockRejectedValue( new Error( 'Runtime unavailable.' ) );
		const client = createStatisticsClient( { runtime: { sendMessage } } );

		await expect( client.readStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
	} );

	it( 'returns unavailable when runtime messaging throws synchronously', async () => {
		const sendMessage = vi.fn<( request: StatisticsRuntimeRequest ) => Promise<unknown>>( () => {
			throw new Error( 'Runtime unavailable.' );
		} );
		const client = createStatisticsClient( { runtime: { sendMessage } } );

		await expect( client.resetStatistics() ).resolves.toEqual( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} );
	} );

	it( 'publishes only local changes to the statistics document while listeners are active', () => {
		const storageChanges = new MemoryStorageChangeSource();
		const client = createStatisticsClient( {
			runtime: { sendMessage: vi.fn() },
			storageChanges,
		} );
		const listener = vi.fn();
		const secondListener = vi.fn();

		client.addStatisticsChangeListener( listener );
		client.addStatisticsChangeListener( secondListener );
		storageChanges.emit( { unrelated: { newValue: true } }, 'local' );
		storageChanges.emit( {
			[ StatisticsStorageKey.STATISTICS ]: { newValue: AVAILABLE_STATISTICS_PROJECTION },
		}, 'session' );
		storageChanges.emit( {
			[ StatisticsStorageKey.STATISTICS ]: { newValue: AVAILABLE_STATISTICS_PROJECTION },
		}, 'local' );

		expect( listener ).toHaveBeenCalledOnce();
		expect( secondListener ).toHaveBeenCalledOnce();

		client.removeStatisticsChangeListener( listener );
		storageChanges.emit( {
			[ StatisticsStorageKey.STATISTICS ]: { newValue: AVAILABLE_STATISTICS_PROJECTION },
		}, 'local' );

		expect( listener ).toHaveBeenCalledOnce();
		expect( secondListener ).toHaveBeenCalledTimes( 2 );

		client.removeStatisticsChangeListener( secondListener );
		storageChanges.emit( {
			[ StatisticsStorageKey.STATISTICS ]: { newValue: AVAILABLE_STATISTICS_PROJECTION },
		}, 'local' );

		expect( secondListener ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'allows subscriptions when browser storage changes are unavailable', () => {
		const client = createStatisticsClient( {
			runtime: { sendMessage: vi.fn() },
		} );
		const listener = vi.fn();

		expect( () => {
			client.addStatisticsChangeListener( listener );
			client.removeStatisticsChangeListener( listener );
		} ).not.toThrow();
	} );
} );
