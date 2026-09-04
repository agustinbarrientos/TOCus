import {
	ProtectionCoordinatorInitializationStatus,
	type ProtectionCoordinatorStatisticsDeliveryBoundary,
} from '../../../../domains/protection/services/protection-coordinator';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	StatisticsProjectionSchema,
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import {
	type StatisticsCheckpointObservation,
	type StatisticsRuntime,
} from '../statistics-runtime';
import { type ProtectionRuntimeTab } from '../../../protection-runtime/types/browser-runtime';
import {
	StatisticsFocusObservationMode,
	type StatisticsFocusObservationMode as StatisticsFocusObservationModeValue,
} from '../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import {
	type BrowserProtectionFocusEventIdentity,
	type BrowserProtectionStatisticsObservation,
	type BrowserStatisticsBridge,
	type BrowserStatisticsBridgeOptions,
} from './types';

/**
 * Cross-browser window identifier emitted when the browser loses operating-system focus.
 * @since 0.1.0 Initial implementation.
 */
const UNFOCUSED_BROWSER_WINDOW_ID = -1;

/**
 * Creates an unavailable statistics projection without fabricating local values.
 * @return Unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailableStatisticsProjection(): StatisticsProjection {
	return StatisticsProjectionSchema.parse( { status: StatisticsProjectionStatus.UNAVAILABLE } );
}

/**
 * Creates browser observation and persistence coordination for local statistics.
 * @param options - Browser, protection, storage, clock, and statistics dependencies.
 * @return Browser statistics bridge operations.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserStatisticsBridge(
	options: BrowserStatisticsBridgeOptions,
): BrowserStatisticsBridge {
	let focusBoundaryGeneration = 0;
	let operationQueue: Promise<void> = Promise.resolve();

	/**
	 * Returns a trustworthy current wall-clock value.
	 * @return Safe nonnegative epoch milliseconds, or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	function getSafeNow(): number | null {
		try {
			const observedAt = options.now();

			return Number.isSafeInteger( observedAt ) && observedAt >= 0
				? observedAt
				: null;
		} catch {
			return null;
		}
	}

	/**
	 * Reports whether an asynchronous focus snapshot still represents its browser event.
	 * @param focusEvent - Exact event identity, malformed marker, or absent identity.
	 * @param focusedTabId - Active tab returned by browser inspection.
	 * @param tabs - Complete inspected tab collection.
	 * @return Whether the snapshot may open a new focus anchor.
	 * @since 0.1.0 Initial implementation.
	 */
	function focusSnapshotMatchesEvent(
		focusEvent: BrowserProtectionFocusEventIdentity | null | undefined,
		focusedTabId: number | null,
		tabs: Awaited<ReturnType<BrowserStatisticsBridgeOptions[ 'browser' ][ 'listTabs' ]>>,
	): boolean {
		if ( focusEvent === undefined ) {
			return true;
		}

		if (
			focusEvent === null ||
			! Number.isSafeInteger( focusEvent.windowId ) ||
			focusEvent.windowId < UNFOCUSED_BROWSER_WINDOW_ID ||
			(
				focusEvent.tabId !== undefined &&
				( ! Number.isSafeInteger( focusEvent.tabId ) || focusEvent.tabId < 0 )
			)
		) {
			return false;
		}

		if ( focusedTabId === null ) {
			return focusEvent.tabId === undefined &&
				focusEvent.windowId === UNFOCUSED_BROWSER_WINDOW_ID;
		}

		const focusedTab = tabs.find( ( tab ) => tab.id === focusedTabId );

		return focusedTab?.windowId === focusEvent.windowId &&
			( focusEvent.tabId === undefined || focusEvent.tabId === focusedTabId );
	}

	/**
	 * Serializes one statistics operation without poisoning later work after rejection.
	 * @param operation - Deferred statistics operation.
	 * @return Promise for the statistics operation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueue<T>( operation: () => Promise<T> ): Promise<T> {
		const result = operationQueue.then( operation, operation );

		operationQueue = result.then( () => undefined, () => undefined );

		return result;
	}

	/**
	 * Runs one statistics boundary without allowing measurement failures to escape.
	 * @param operation - Deferred statistics operation.
	 * @return Promise resolved after success or contained failure.
	 * @since 0.1.0 Initial implementation.
	 */
	async function runOperation( operation: () => Promise<void> ): Promise<void> {
		try {
			await operation();
		} catch {
			// Statistics are observational and must never disable protection.
		}
	}

	/**
	 * Captures event-time browser inputs before protection or statistics work can be delayed.
	 * @param mode - Relationship between this observation and browser focus state.
	 * @param navigation - Optional top-level navigation observed by the current operation.
	 * @param focusEvent - Exact browser focus event identity, null when malformed, or undefined for another boundary.
	 * @return Privacy-safe browser observation that never rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function captureObservation(
		mode: StatisticsFocusObservationModeValue,
		navigation?: Parameters<BrowserStatisticsBridge[ 'captureObservation' ]>[ 1 ],
		focusEvent?: Parameters<BrowserStatisticsBridge[ 'captureObservation' ]>[ 2 ],
	): Promise<BrowserProtectionStatisticsObservation> {
		const generation = mode === StatisticsFocusObservationMode.BOUNDARY
			? ++focusBoundaryGeneration
			: focusBoundaryGeneration;
		const observedAtEpochMilliseconds = getSafeNow();
		let focusEpochTransitionPromise: ReturnType<StatisticsRuntime[ 'beginFocusObservation' ]>;

		try {
			focusEpochTransitionPromise = options.statisticsRuntime.beginFocusObservation( mode );
		} catch {
			focusEpochTransitionPromise = Promise.resolve( null );
		}

		let browserFocusPromise: Promise<readonly [
			number | null,
			ReadonlyArray<ProtectionRuntimeTab>,
		] | null> = Promise.resolve( null );

		if ( observedAtEpochMilliseconds !== null ) {
			try {
				browserFocusPromise = Promise.all( [
					options.browser.getFocusedTabId(),
					options.browser.listTabs(),
				] ).catch( () => null );
			} catch {
				browserFocusPromise = Promise.resolve( null );
			}
		}
		const browserFocus = await browserFocusPromise;
		const focusedAtEpochMilliseconds = browserFocus === null ? null : getSafeNow();
		const focusEpochTransition = await focusEpochTransitionPromise.catch( () => null );

		if (
			focusEpochTransition === null ||
			browserFocus === null ||
			focusedAtEpochMilliseconds === null ||
			generation !== focusBoundaryGeneration
		) {
			return { observedAtEpochMilliseconds, focusObservation: null, focusEpochTransition };
		}

		const [ focusedTabId, tabs ] = browserFocus;

		if ( ! focusSnapshotMatchesEvent( focusEvent, focusedTabId, tabs ) ) {
			return { observedAtEpochMilliseconds, focusObservation: null, focusEpochTransition };
		}

		const ordinaryTabs = tabs.filter( ( tab ) => tab.incognito === false );
		const ordinaryFocusedTabId = ordinaryTabs.some( ( tab ) => tab.id === focusedTabId )
			? focusedTabId
			: null;
		const ordinaryNavigation = navigation !== undefined && ordinaryTabs.some(
			( tab ) => tab.id === navigation.tabId,
		)
			? { navigation: { ...navigation } }
			: {};

		return {
			observedAtEpochMilliseconds,
			focusEpochTransition,
			focusObservation: {
				focusedAtEpochMilliseconds,
				focusedTabId: ordinaryFocusedTabId,
				tabs: ordinaryTabs.map( ( tab ) => ( { ...tab } ) ),
				...ordinaryNavigation,
			},
		};
	}

	/**
	 * Combines event-time browser inputs with authoritative post-operation protection state.
	 * @param configuration - Trusted configuration after the protection operation, or null after failure.
	 * @param browserObservation - Browser inputs captured when the event reached the runtime.
	 * @return Complete privacy-safe checkpoint observation that never rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function completeCheckpoint(
		configuration: ProtectionConfigurationDocument | null,
		browserObservation: Promise<BrowserProtectionStatisticsObservation>,
	): Promise<StatisticsCheckpointObservation> {
		const statesByScope = configuration === null
			? Promise.resolve( null )
			: options.coordinator.getStates().catch( () => null );
		const [ observation, states ] = await Promise.all( [ browserObservation, statesByScope ] );

		if ( configuration === null || observation.focusObservation === null || states === null ) {
			return {
				observedAtEpochMilliseconds: observation.observedAtEpochMilliseconds,
				focusObservation: null,
				focusEpochTransition: observation.focusEpochTransition,
			};
		}

		return {
			observedAtEpochMilliseconds: observation.observedAtEpochMilliseconds,
			focusEpochTransition: observation.focusEpochTransition,
			focusObservation: {
				...observation.focusObservation,
				statesByScope: states,
			},
		};
	}

	/**
	 * Drains durable facts before checkpointing the latest browser observation.
	 * @param configuration - Trusted configuration after the protection operation, or null after failure.
	 * @param boundary - Durable fact prefix owned by the completed protection operation.
	 * @param observation - Event-time focus observation captured before queueing.
	 * @return Promise resolved after both isolated statistics boundaries.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileObservation(
		configuration: ProtectionConfigurationDocument | null,
		boundary: ProtectionCoordinatorStatisticsDeliveryBoundary | null,
		observation: Promise<StatisticsCheckpointObservation>,
	): Promise<void> {
		await runOperation( () => options.statisticsRuntime.drainProtectionFacts( boundary ) );
		await runOperation( async () => options.statisticsRuntime.checkpoint(
			configuration,
			await observation,
		) );
	}

	/**
	 * Queues one completed protection operation for fact delivery and checkpointing.
	 * @param configuration - Trusted post-operation configuration, or null after failure.
	 * @param browserObservation - Browser inputs captured when the event reached the runtime.
	 * @since 0.1.0 Initial implementation.
	 */
	function observeProtectionOperation(
		configuration: ProtectionConfigurationDocument | null,
		browserObservation: Promise<BrowserProtectionStatisticsObservation>,
	): void {
		try {
			const boundary = options.coordinator.getStatisticsDeliveryBoundary();
			const observation = completeCheckpoint( configuration, browserObservation );

			void enqueue( () => reconcileObservation( configuration, boundary, observation ) );
		} catch {
			// Observational scheduling must never replace a completed protection result.
		}
	}

	/**
	 * Queues raw protection configuration reconciliation before later observations.
	 * @param rawConfiguration - Unknown unfiltered configuration value.
	 * @since 0.1.0 Initial implementation.
	 */
	function reconcileConfiguration( rawConfiguration: unknown ): void {
		void enqueue(
			() => runOperation(
				() => options.statisticsRuntime.reconcileConfiguration( rawConfiguration ),
			),
		);
	}

	/**
	 * Queues removal of focus measurement that cannot remain valid without protection.
	 * @since 0.1.0 Initial implementation.
	 */
	function discardFocusMeasurement(): void {
		void enqueue(
			() => runOperation(
				() => options.statisticsRuntime.discardFocusMeasurement(),
			),
		);
	}

	/**
	 * Establishes coordinator access needed to inspect or clear durable statistics delivery.
	 * @return True after current or lazy coordinator initialization succeeds.
	 * @since 0.1.0 Initial implementation.
	 */
	async function ensureCoordinator(): Promise<boolean> {
		try {
			if ( await options.coordinator.getStatisticsDelivery() !== null ) {
				return true;
			}

			const initialization = await options.coordinator.initialize( {
				nowEpochMilliseconds: options.now(),
				readyObservations: [],
			} );

			return initialization.status !== ProtectionCoordinatorInitializationStatus.FAILED;
		} catch {
			return false;
		}
	}

	/**
	 * Loads raw revisions and establishes durable-delivery access without enabling protection.
	 * @return Current configuration when statistics can safely proceed, otherwise null.
	 * @since 0.1.0 Initial implementation.
	 */
	async function prepareReadAccess(): Promise<ProtectionConfigurationDocument | null> {
		let rawConfiguration: unknown;

		try {
			rawConfiguration = await options.configurationStorage.load();
		} catch {
			await runOperation(
				() => options.statisticsRuntime.reconcileConfiguration( null ),
			);
			return null;
		}

		try {
			await options.statisticsRuntime.reconcileConfiguration( rawConfiguration );
		} catch {
			return null;
		}

		const configuration = ProtectionConfigurationDocumentSchema.safeParse( rawConfiguration );

		if (
			! configuration.success ||
			! await ensureCoordinator()
		) {
			return null;
		}

		return configuration.data;
	}

	/**
	 * Establishes reset access without requiring readable statistics or protection configuration.
	 * @return True when current settings were read and durable delivery can be cleared.
	 * @since 0.1.0 Initial implementation.
	 */
	async function prepareResetAccess(): Promise<boolean> {
		let rawConfiguration: unknown;

		try {
			rawConfiguration = await options.configurationStorage.load();
			await options.statisticsRuntime.reconcileConfiguration( rawConfiguration );
		} catch {
			return false;
		}

		return ensureCoordinator();
	}

	/**
	 * Reads and validates only the public statistics projection from its runtime snapshot.
	 * @return Available local totals or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	function getProjection(): StatisticsProjection {
		try {
			const projection = StatisticsProjectionSchema.safeParse(
				options.statisticsRuntime.getSnapshot().projection,
			);

			return projection.success
				? projection.data
				: createUnavailableStatisticsProjection();
		} catch {
			return createUnavailableStatisticsProjection();
		}
	}

	/**
	 * Returns the latest trustworthy all-time statistics projection.
	 * @return Available local totals or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	function readStatistics(): Promise<StatisticsProjection> {
		const initialBoundary = options.coordinator.getStatisticsDeliveryBoundary();

		return enqueue( async () => {
			if ( ! await prepareReadAccess() ) {
				return createUnavailableStatisticsProjection();
			}

			const boundary = initialBoundary ?? options.coordinator.getStatisticsDeliveryBoundary();

			try {
				await options.statisticsRuntime.drainProtectionFacts( boundary );
			} catch {
				return createUnavailableStatisticsProjection();
			}

			try {
				if ( options.statisticsRuntime.getSnapshot().deliveryStatus === null ) {
					return createUnavailableStatisticsProjection();
				}
			} catch {
				return createUnavailableStatisticsProjection();
			}

			return getProjection();
		} );
	}

	/**
	 * Clears local statistics and returns the resulting trustworthy projection.
	 * @return Zero-valued local totals after success or an unavailable projection.
	 * @since 0.1.0 Initial implementation.
	 */
	function resetStatistics(): Promise<StatisticsProjection> {
		return enqueue( async () => {
			if ( ! await prepareResetAccess() ) {
				return createUnavailableStatisticsProjection();
			}

			try {
				if ( ! await options.statisticsRuntime.reset() ) {
					return createUnavailableStatisticsProjection();
				}
			} catch {
				return createUnavailableStatisticsProjection();
			}

			return getProjection();
		} );
	}

	return {
		captureObservation,
		discardFocusMeasurement,
		observeProtectionOperation,
		readStatistics,
		reconcileConfiguration,
		resetStatistics,
	};
}

export * from './types';
