import { type StatisticsRuntimeRequest } from '../../types/runtime-message';
import { type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';

/**
 * Read-only authoritative statistics projection source.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsReader {
	/**
	 * Reads the current authoritative all-time statistics projection.
	 * @return Available statistics or an unavailable marker.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatistics(): Promise<StatisticsProjection>;
}

/**
 * Listener notified when the authoritative local statistics document changes.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsChangeListener = () => void;

/**
 * Read-only statistics source that reports authoritative local changes.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsChangeSource extends StatisticsReader {
	/**
	 * Subscribes to authoritative local statistics changes.
	 * @param listener - Listener notified after the statistics document changes.
	 * @since 0.1.0 Initial implementation.
	 */
	addStatisticsChangeListener( listener: StatisticsChangeListener ): void;

	/**
	 * Stops notifying one statistics-change listener.
	 * @param listener - Previously subscribed listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeStatisticsChangeListener( listener: StatisticsChangeListener ): void;
}

/**
 * Local authoritative statistics operations available to extension interfaces.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsClient extends StatisticsChangeSource {
	/**
	 * Resets all-time statistics without changing protection settings.
	 * @return Authoritative projection after the reset attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics(): Promise<StatisticsProjection>;
}

/**
 * Local extension message boundary used by the statistics client.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsClientRuntime {
	/**
	 * Sends one statistics request to the local background runtime.
	 * @param request - Validated statistics runtime request.
	 * @return Unknown response awaiting local validation.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage( request: StatisticsRuntimeRequest ): Promise<unknown>;
}

/**
 * One changed browser-storage value.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsStorageChange {
	/** Value stored after the change. */
	readonly newValue?: unknown;
}

/**
 * Browser storage-change listener used by the statistics client.
 * @since 0.1.0 Initial implementation.
 */
export type StatisticsStorageChangeListener = (
	changes: Readonly<Record<string, StatisticsStorageChange>>,
	areaName: string,
) => void;

/**
 * Browser storage-change event used for local statistics invalidation.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsStorageChangeSource {
	/**
	 * Begins delivering browser storage changes to one listener.
	 * @param listener - Browser storage-change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: StatisticsStorageChangeListener ): void;

	/**
	 * Stops delivering browser storage changes to one listener.
	 * @param listener - Previously registered listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: StatisticsStorageChangeListener ): void;
}

/**
 * Dependencies used to create one statistics client.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsClientOptions {
	/**
	 * Local extension message boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	runtime: StatisticsClientRuntime;

	/** Browser storage changes used to invalidate visible statistics. */
	storageChanges?: StatisticsStorageChangeSource;
}
