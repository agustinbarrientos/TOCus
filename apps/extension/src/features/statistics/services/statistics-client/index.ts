import {
	StatisticsStorageKey,
} from '../../../../domains/statistics/services/statistics-storage';
import {
	StatisticsProjectionSchema,
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import {
	type StatisticsRuntimeRequest,
	StatisticsRuntimeRequestType,
} from '../../types/runtime-message';
import {
	type StatisticsClient,
	type StatisticsChangeListener,
	type StatisticsClientOptions,
	type StatisticsStorageChangeListener,
} from './types';

/**
 * Creates an unavailable projection without fabricating aggregate values.
 * @return Unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableStatisticsProjection(): StatisticsProjection {
	return { status: StatisticsProjectionStatus.UNAVAILABLE };
}

/**
 * Sends one local statistics request and validates the complete response.
 * @param options - Statistics client dependencies.
 * @param request - Local statistics request.
 * @return Validated projection or an unavailable marker.
 * @since 0.1.0 Initial implementation.
 */
async function sendStatisticsRequest(
	options: StatisticsClientOptions,
	request: StatisticsRuntimeRequest,
): Promise<StatisticsProjection> {
	try {
		return StatisticsProjectionSchema.parse(
			await options.runtime.sendMessage( request ),
		);
	} catch {
		return createUnavailableStatisticsProjection();
	}
}

/**
 * Creates a fail-closed local statistics source for extension interfaces.
 * @param options - Statistics client dependencies.
 * @return Local statistics source.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsClient( options: StatisticsClientOptions ): StatisticsClient {
	const changeListeners = new Set<StatisticsChangeListener>();

	/**
	 * Notifies subscribers after the local statistics document changes.
	 * @param changes - Changed browser-storage values.
	 * @param areaName - Browser storage area containing the changes.
	 * @since 0.1.0 Initial implementation.
	 */
	const handleStorageChange: StatisticsStorageChangeListener = ( changes, areaName ): void => {
		if ( areaName !== 'local' || ! Object.hasOwn( changes, StatisticsStorageKey.STATISTICS ) ) {
			return;
		}

		for ( const listener of changeListeners ) {
			listener();
		}
	};

	return {
		/**
		 * Subscribes to authoritative local statistics changes.
		 * @param listener - Listener notified after the statistics document changes.
		 * @since 0.1.0 Initial implementation.
		 */
		addStatisticsChangeListener( listener: StatisticsChangeListener ): void {
			if ( changeListeners.size === 0 ) {
				options.storageChanges?.addListener( handleStorageChange );
			}

			changeListeners.add( listener );
		},

		/**
		 * Stops notifying one statistics-change listener.
		 * @param listener - Previously subscribed listener.
		 * @since 0.1.0 Initial implementation.
		 */
		removeStatisticsChangeListener( listener: StatisticsChangeListener ): void {
			changeListeners.delete( listener );

			if ( changeListeners.size === 0 ) {
				options.storageChanges?.removeListener( handleStorageChange );
			}
		},

		/**
		 * Reads the current authoritative all-time statistics projection.
		 * @return Validated projection or an unavailable marker.
		 * @since 0.1.0 Initial implementation.
		 */
		readStatistics(): Promise<StatisticsProjection> {
			return sendStatisticsRequest( options, {
				type: StatisticsRuntimeRequestType.READ_STATISTICS,
			} );
		},

		/**
		 * Resets local all-time statistics without changing protection settings.
		 * @return Validated projection or an unavailable marker.
		 * @since 0.1.0 Initial implementation.
		 */
		resetStatistics(): Promise<StatisticsProjection> {
			return sendStatisticsRequest( options, {
				type: StatisticsRuntimeRequestType.RESET_STATISTICS,
			} );
		},
	};
}

export type {
	StatisticsChangeListener,
	StatisticsChangeSource,
	StatisticsClient,
	StatisticsClientOptions,
	StatisticsClientRuntime,
	StatisticsReader,
	StatisticsStorageChange,
	StatisticsStorageChangeListener,
	StatisticsStorageChangeSource,
} from './types';
