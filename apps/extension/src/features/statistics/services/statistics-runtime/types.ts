import {
	type ProtectionCoordinator,
	type ProtectionCoordinatorStatisticsDeliveryBoundary,
} from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';
import { type StatisticsSessionStorageService } from '../../../../domains/statistics/services/statistics-session-storage';
import { type StatisticsStorageService } from '../../../../domains/statistics/services/statistics-storage';
import {
	type StatisticsFocusEpochTransition,
	type StatisticsFocusObservationMode,
} from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { type StatisticsCheckpointObservation } from '../statistics-focus-session';

export type {
	StatisticsCheckpointFocusObservation,
	StatisticsCheckpointObservation,
} from '../statistics-focus-session';

/**
 * Dependencies used by one stateful statistics runtime.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsRuntimeOptions {
	coordinator: Pick<
		ProtectionCoordinator,
		'acknowledgeStatisticsDeliveryBatch' |
		'completeStatisticsDeliveryReset' |
		'getSessionContinuityId' |
		'getStatisticsDelivery' |
		'resetStatisticsDelivery'
	>;
	storage: StatisticsStorageService;
	sessionStorage: StatisticsSessionStorageService;

	/**
	 * Creates a fresh statistics generation identifier for an explicit reset.
	 * @return Unknown identifier validated by the statistics reducer.
	 * @since 0.1.0 Initial implementation.
	 */
	createGenerationId(): unknown;
}

/**
 * Privacy-safe current statistics runtime projection and availability.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsRuntimeSnapshot {
	deliveryStatus: StoredProtectionStatisticsDeliveryStatus | null;
	focusMeasurementEnabled: boolean;
	projection: StatisticsProjection;
}

/**
 * Stateful statistics operations serialized by their browser-runtime caller.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsRuntime {
	/**
	 * Persists focus continuity before any asynchronous browser inspection begins.
	 * @param mode - Relationship between the observation and browser focus state.
	 * @return Focus epoch context, or null when session persistence is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	beginFocusObservation(
		mode: StatisticsFocusObservationMode,
	): Promise<StatisticsFocusEpochTransition | null>;

	/**
	 * Removes any retained focus anchor when protection becomes unavailable.
	 * @return Promise resolved after the contained session-storage attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	discardFocusMeasurement(): Promise<void>;

	/**
	 * Loads local/session state and durably reconciles current raw configuration revisions.
	 * @param rawConfiguration - Unknown unfiltered protection configuration.
	 * @return Promise resolved after the contained reconciliation attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileConfiguration( rawConfiguration: unknown ): Promise<void>;

	/**
	 * Applies and acknowledges every currently retained durable fact batch in FIFO order.
	 * @param boundary - Optional protection-operation boundary limiting the retained prefix.
	 * @return Promise resolved after the contained drain attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	drainProtectionFacts(
		boundary?: ProtectionCoordinatorStatisticsDeliveryBoundary | null,
	): Promise<void>;

	/**
	 * Checkpoints privacy-filtered focused allowance observations and expired measurements.
	 * @param configuration - Current permission-filtered configuration, or null when unavailable.
	 * @param observation - Browser focus and event time captured before queued persistence.
	 * @return Promise resolved after the contained checkpoint attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	checkpoint(
		configuration: ProtectionConfigurationDocument | null,
		observation: StatisticsCheckpointObservation,
	): Promise<void>;

	/**
	 * Returns the current privacy-safe aggregate projection and runtime availability.
	 * @return Detached current statistics runtime snapshot.
	 * @since 0.1.0 Initial implementation.
	 */
	getSnapshot(): StatisticsRuntimeSnapshot;

	/**
	 * Clears durable delivery, session measurement work, and local aggregate values.
	 * @return True only after every owned reset write completes.
	 * @since 0.1.0 Initial implementation.
	 */
	reset(): Promise<boolean>;
}
