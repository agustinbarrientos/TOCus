import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	type SessionContinuityId,
} from '../../../../domains/protection/types/protection-value';
import {
	StoredProtectionStatisticsDeliveryStatus,
	type StoredProtectionStatisticsDeliveryStatus as StoredProtectionStatisticsDeliveryStatusValue,
} from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import {
	StatisticsOperationType,
} from '../../../../domains/statistics/types/statistics-operation';
import {
	type StatisticsDocument,
} from '../../../../domains/statistics/types/statistics-document';
import { createStatisticsDocument } from '../../../../domains/statistics/utils/create-statistics-document';
import { projectStatistics } from '../../../../domains/statistics/utils/project-statistics';
import { reduceStatistics } from '../../../../domains/statistics/utils/reduce-statistics';
import {
	type ProtectionCoordinatorStatisticsDeliveryBoundary,
} from '../../../../domains/protection/services/protection-coordinator';
import { createStatisticsFocusSession } from '../statistics-focus-session';
import {
	type StatisticsRuntime,
	type StatisticsCheckpointObservation,
	type StatisticsRuntimeOptions,
	type StatisticsRuntimeSnapshot,
} from './types';

/**
 * Compares exact own measurement-revision entries without trusting object prototypes.
 * @param left - First validated protection configuration.
 * @param right - Second validated protection configuration.
 * @return True when both configurations carry the same scope revisions.
 * @since 0.1.0 Initial implementation.
 */
function haveMatchingMeasurementRevisions(
	left: ProtectionConfigurationDocument,
	right: ProtectionConfigurationDocument,
): boolean {
	const leftEntries = Object.entries( left.measurementRevisionsByScope );
	const rightEntries = Object.entries( right.measurementRevisionsByScope );

	return leftEntries.length === rightEntries.length && leftEntries.every(
		( [ scopeId, revision ] ) =>
			Object.hasOwn( right.measurementRevisionsByScope, scopeId ) &&
			right.measurementRevisionsByScope[ scopeId ] === revision,
	);
}

/**
 * Creates stateful statistics coordination without adding a second runtime queue.
 * @param options - Local/session storage and protection dependencies.
 * @return Statistics runtime serialized by its caller.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsRuntime( options: StatisticsRuntimeOptions ): StatisticsRuntime {
	let configuration: ProtectionConfigurationDocument | null = null;
	let statisticsDocument: StatisticsDocument | null = null;
	let deliveryStatus: StoredProtectionStatisticsDeliveryStatusValue | null = null;

	/**
	 * Reads the current browser-session continuity identifier from protection state.
	 * @return Current continuity identifier, or null before protection initializes.
	 * @since 0.1.0 Initial implementation.
	 */
	function getSessionContinuityId(): SessionContinuityId | null {
		return options.coordinator.getSessionContinuityId();
	}

	const focusSession = createStatisticsFocusSession( {
		storage: options.storage,
		sessionStorage: options.sessionStorage,
		getSessionContinuityId,
	} );

	/**
	 * Persists focus continuity before any asynchronous browser inspection begins.
	 * @param mode - Relationship between the observation and browser focus state.
	 * @return Focus epoch context, or null when session persistence is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	function beginFocusObservation(
		mode: Parameters<StatisticsRuntime['beginFocusObservation']>[0],
	): ReturnType<StatisticsRuntime['beginFocusObservation']> {
		return focusSession.beginFocusObservation( mode );
	}

	/**
	 * Removes retained focus work even before aggregate statistics have initialized.
	 * @return Promise resolved after the contained session-storage attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	function discardFocusMeasurement(): Promise<void> {
		return focusSession.discardFocusMeasurement();
	}

	/**
	 * Disables all work that depends on a successfully reconciled local document.
	 * @since 0.1.0 Initial implementation.
	 */
	function markConfigurationUnavailable(): void {
		configuration = null;
		markStatisticsUnavailable();
	}

	/**
	 * Disables statistics work while retaining an independently validated raw configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	function markStatisticsUnavailable(): void {
		focusSession.markUnavailable();
		statisticsDocument = null;
		deliveryStatus = null;
	}

	/**
	 * Returns whether current state permits creation of new focus measurement work.
	 * @return True only after complete delivery and healthy session initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	function focusMeasurementIsEnabled(): boolean {
		return configuration !== null &&
			statisticsDocument !== null &&
			focusSession.isAvailable() &&
			deliveryStatus === StoredProtectionStatisticsDeliveryStatus.COMPLETE;
	}

	/**
	 * Loads and durably reconciles local statistics before enabling downstream work.
	 * @param rawConfiguration - Unknown unfiltered protection configuration.
	 * @return Promise resolved after the contained reconciliation attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileConfiguration( rawConfiguration: unknown ): Promise<void> {
		const parsedConfiguration = ProtectionConfigurationDocumentSchema.safeParse( rawConfiguration );

		if ( ! parsedConfiguration.success ) {
			markConfigurationUnavailable();
			return;
		}

		if (
			configuration !== null &&
			statisticsDocument !== null &&
			haveMatchingMeasurementRevisions( configuration, parsedConfiguration.data )
		) {
			configuration = parsedConfiguration.data;

			if ( ! focusSession.isStateKnown() ) {
				statisticsDocument = await focusSession.initialize( statisticsDocument );
			}

			return;
		}

		configuration = parsedConfiguration.data;

		let loadedDocument: StatisticsDocument | null;

		try {
			loadedDocument = await options.storage.load();
		} catch {
			markStatisticsUnavailable();
			return;
		}

		if ( loadedDocument === null ) {
			markStatisticsUnavailable();
			return;
		}

		let reconciledDocument: StatisticsDocument;

		try {
			reconciledDocument = reduceStatistics( loadedDocument, {
				type: StatisticsOperationType.RECONCILE_MEASUREMENT_REVISIONS,
				measurementRevisionsByScope: parsedConfiguration.data.measurementRevisionsByScope,
			} );
			await options.storage.save( reconciledDocument );
		} catch {
			markStatisticsUnavailable();
			return;
		}

		statisticsDocument = reconciledDocument;
		deliveryStatus = null;

		statisticsDocument = await focusSession.initialize( reconciledDocument );
	}

	/**
	 * Chooses the externally visible status after one interrupted drain.
	 * @param sourceStatus - Completeness status read before the interrupted drain.
	 * @return Incomplete when already known incomplete, otherwise unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	function getInterruptedDeliveryStatus(
		sourceStatus: StoredProtectionStatisticsDeliveryStatusValue,
	): StoredProtectionStatisticsDeliveryStatusValue | null {
		return sourceStatus === StoredProtectionStatisticsDeliveryStatus.INCOMPLETE
			? sourceStatus
			: null;
	}

	/**
	 * Applies and acknowledges retained protection facts in durable FIFO order.
	 * @param boundary - Optional protection-operation boundary limiting the retained prefix.
	 * @return Promise resolved after the contained drain attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	async function drainProtectionFacts(
		boundary?: ProtectionCoordinatorStatisticsDeliveryBoundary | null,
	): Promise<void> {
		if ( configuration === null || statisticsDocument === null ) {
			return;
		}

		if ( boundary === null ) {
			return;
		}

		const replay = await focusSession.replayPendingInterval( statisticsDocument );

		statisticsDocument = replay.statisticsDocument;

		if ( ! replay.succeeded ) {
			deliveryStatus = null;
			return;
		}

		let delivery;

		try {
			delivery = await options.coordinator.getStatisticsDelivery();
		} catch {
			deliveryStatus = null;
			return;
		}

		if ( delivery === null ) {
			deliveryStatus = null;
			return;
		}

		deliveryStatus = null;
		const boundaryIndex = boundary === undefined || boundary.lastBatchId === null
			? -1
			: delivery.outbox.findIndex( ( batch ) => batch.batchId === boundary.lastBatchId );
		const batches = boundary === undefined
			? delivery.outbox
			: boundaryIndex < 0
				? []
				: delivery.outbox.slice( 0, boundaryIndex + 1 );
		const sourceStatus = delivery.status;

		for ( const batch of batches ) {
			let nextDocument: StatisticsDocument;

			try {
				nextDocument = reduceStatistics( statisticsDocument, {
					type: StatisticsOperationType.APPLY_FACT_BATCH,
					batch,
				} );
				await options.storage.save( nextDocument );
			} catch {
				deliveryStatus = getInterruptedDeliveryStatus( sourceStatus );
				return;
			}

			statisticsDocument = nextDocument;

			try {
				if ( ! await options.coordinator.acknowledgeStatisticsDeliveryBatch( batch.batchId ) ) {
					deliveryStatus = getInterruptedDeliveryStatus( sourceStatus );
					return;
				}
			} catch {
				deliveryStatus = getInterruptedDeliveryStatus( sourceStatus );
				return;
			}
		}

		deliveryStatus = sourceStatus;
	}

	/**
	 * Checkpoints focused allowance work after initialization permits measurement.
	 * @param filteredConfiguration - Current permission-filtered configuration.
	 * @param observation - Focus and event time captured before queued persistence.
	 * @return Promise resolved after the contained checkpoint attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	async function checkpoint(
		filteredConfiguration: ProtectionConfigurationDocument | null,
		observation: StatisticsCheckpointObservation,
	): Promise<void> {
		if ( configuration === null || statisticsDocument === null ) {
			return;
		}

		statisticsDocument = await focusSession.checkpoint( {
			configuration: filteredConfiguration,
			statisticsDocument,
			observation,
			deliveryComplete: deliveryStatus === StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		} );
	}

	/**
	 * Clears every statistics persistence layer in an order that prevents stale replay.
	 * @return True only after durable delivery, session work, and local totals are reset.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reset(): Promise<boolean> {
		const currentConfiguration = configuration;
		const currentStatisticsDocument = statisticsDocument;
		const measurementRevisionsByScope = currentConfiguration?.measurementRevisionsByScope ?? {};

		let resetDocument: StatisticsDocument;

		try {
			const generationId = options.createGenerationId();

			resetDocument = currentStatisticsDocument === null
				? reduceStatistics( createStatisticsDocument( generationId ), {
					type: StatisticsOperationType.RECONCILE_MEASUREMENT_REVISIONS,
					measurementRevisionsByScope,
				} )
				: reduceStatistics( currentStatisticsDocument, {
					type: StatisticsOperationType.RESET,
					generationId,
					measurementRevisionsByScope,
				} );
		} catch {
			return false;
		}

		try {
			if ( ! await options.coordinator.resetStatisticsDelivery() ) {
				deliveryStatus = null;
				return false;
			}
		} catch {
			deliveryStatus = null;
			return false;
		}

		deliveryStatus = StoredProtectionStatisticsDeliveryStatus.INCOMPLETE;

		try {
			await options.storage.save( resetDocument );
		} catch {
			return false;
		}

		statisticsDocument = resetDocument;

		if ( ! await focusSession.reset() ) {
			return false;
		}

		try {
			if ( ! await options.coordinator.completeStatisticsDeliveryReset() ) {
				return false;
			}
		} catch {
			return false;
		}

		deliveryStatus = StoredProtectionStatisticsDeliveryStatus.COMPLETE;

		return true;
	}

	/**
	 * Returns a detached aggregate-only view of current runtime state.
	 * @return Current projection, delivery status, and focus-measurement availability.
	 * @since 0.1.0 Initial implementation.
	 */
	function getSnapshot(): StatisticsRuntimeSnapshot {
		return {
			deliveryStatus,
			focusMeasurementEnabled: focusMeasurementIsEnabled(),
			projection: projectStatistics(
				deliveryStatus === StoredProtectionStatisticsDeliveryStatus.COMPLETE
					? statisticsDocument
					: null,
			),
		};
	}

	return {
		beginFocusObservation,
		checkpoint,
		discardFocusMeasurement,
		drainProtectionFacts,
		getSnapshot,
		reconcileConfiguration,
		reset,
	};
}

export * from './types';
