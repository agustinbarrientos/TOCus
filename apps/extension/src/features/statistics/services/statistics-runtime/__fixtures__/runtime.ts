import {
	type ProtectionCoordinatorStateSnapshot,
	type ProtectionCoordinatorStatisticsDeliverySnapshot,
} from '../../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../../domains/protection/types/protected-site-configuration';
import {
	type SessionContinuityId,
} from '../../../../../domains/protection/types/protection-value';
import { StoredProtectionStatisticsDeliveryStatus } from '../../../../../domains/protection/types/stored-protection-statistics-delivery';
import { type StatisticsDocument } from '../../../../../domains/statistics/types/statistics-document';
import { type StatisticsSessionDocument } from '../../../../../domains/statistics/types/statistics-session';
import {
	StatisticsFocusObservationMode,
	type StatisticsFocusEpochTransition,
} from '../../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import {
	type ProtectionRuntimeNavigation,
	type ProtectionRuntimeTab,
} from '../../../../protection-runtime/types/browser-runtime';
import {
	createStatisticsRuntime,
	type StatisticsCheckpointObservation,
	type StatisticsRuntime,
	type StatisticsRuntimeOptions,
} from '../index';
import {
	TEST_CONFIGURATION,
	TEST_SESSION_CONTINUITY_ID,
	TEST_NOW_EPOCH_MILLISECONDS,
	createStatisticsDocument,
} from './documents';
import {
	MemoryStatisticsSessionStorage,
	MemoryStatisticsStorage,
} from './persistence';

/**
 * Controlled protection boundary used by statistics-runtime tests.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryStatisticsProtectionCoordinator {
	/**
	 * Optional delivery acknowledgement failure.
	 * @since 0.1.0 Initial implementation.
	 */
	acknowledgementFailure: Error | null = null;

	/**
	 * Whether delivery acknowledgements match the current FIFO head.
	 * @since 0.1.0 Initial implementation.
	 */
	acknowledgementMatches = true;

	/**
	 * Optional delivery read failure.
	 * @since 0.1.0 Initial implementation.
	 */
	deliveryReadFailure: Error | null = null;

	/**
	 * Number of durable delivery reads.
	 * @since 0.1.0 Initial implementation.
	 */
	deliveryReadCount = 0;

	/**
	 * Number of protection-state reads.
	 * @since 0.1.0 Initial implementation.
	 */
	stateReadCount = 0;

	/**
	 * Optional protection-state read failure.
	 * @since 0.1.0 Initial implementation.
	 */
	stateReadFailure: Error | null = null;

	/**
	 * Optional delivery reset failure.
	 * @since 0.1.0 Initial implementation.
	 */
	resetFailure: Error | null = null;

	/**
	 * Controlled delivery reset result.
	 * @since 0.1.0 Initial implementation.
	 */
	resetResult = true;

	/**
	 * Optional delivery reset-completion failure.
	 * @since 0.1.0 Initial implementation.
	 */
	resetCompletionFailure: Error | null = null;

	/**
	 * Controlled delivery reset-completion result.
	 * @since 0.1.0 Initial implementation.
	 */
	resetCompletionResult = true;

	/**
	 * Current protection state snapshot.
	 * @since 0.1.0 Initial implementation.
	 */
	states: ProtectionCoordinatorStateSnapshot | null = {};

	/**
	 * Current browser-session continuity identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	sessionContinuityId: SessionContinuityId | null = TEST_SESSION_CONTINUITY_ID;

	/**
	 * Creates the controlled coordinator with one durable delivery snapshot.
	 * @param delivery - Initial durable delivery snapshot.
	 * @param trace - Ordered persistence and acknowledgement trace.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor(
		private delivery: ProtectionCoordinatorStatisticsDeliverySnapshot | null,
		private readonly trace: string[] = [],
	) {}

	/**
	 * Replaces the next detached durable-delivery snapshot.
	 * @param delivery - Next durable delivery visible to the runtime.
	 * @since 0.1.0 Initial implementation.
	 */
	replaceDelivery(
		delivery: ProtectionCoordinatorStatisticsDeliverySnapshot | null,
	): void {
		this.delivery = delivery;
	}

	/**
	 * Returns the current detached protection state snapshot.
	 * @return Current states or null before protection initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	getStates(): Promise<ProtectionCoordinatorStateSnapshot | null> {
		this.stateReadCount += 1;

		if ( this.stateReadFailure !== null ) {
			return Promise.reject( this.stateReadFailure );
		}

		return Promise.resolve( this.states );
	}

	/**
	 * Returns the current browser-session continuity identifier.
	 * @return Current browser-session identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getSessionContinuityId(): SessionContinuityId | null {
		return this.sessionContinuityId;
	}

	/**
	 * Returns current durable delivery or propagates the configured failure.
	 * @return Current delivery or null before protection initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	getStatisticsDelivery(): Promise<ProtectionCoordinatorStatisticsDeliverySnapshot | null> {
		this.deliveryReadCount += 1;

		if ( this.deliveryReadFailure !== null ) {
			return Promise.reject( this.deliveryReadFailure );
		}

		return Promise.resolve( this.delivery === null
			? null
			: structuredClone( this.delivery ) );
	}

	/**
	 * Removes the exact current head or reports a configured mismatch.
	 * @param batchId - Candidate durable FIFO head identifier.
	 * @return True only when the exact head is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	acknowledgeStatisticsDeliveryBatch( batchId: unknown ): Promise<boolean> {
		this.trace.push( `ack:${ String( batchId ) }` );

		if ( this.acknowledgementFailure !== null ) {
			return Promise.reject( this.acknowledgementFailure );
		}

		const head = this.delivery?.outbox[ 0 ];

		if ( ! this.acknowledgementMatches || head?.batchId !== batchId ) {
			return Promise.resolve( false );
		}

		this.delivery = {
			status: this.delivery?.status ?? StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: this.delivery?.outbox.slice( 1 ) ?? [],
		};

		return Promise.resolve( true );
	}

	/**
	 * Clears current durable statistics delivery or reports a controlled failure.
	 * @return True only when the controlled reset succeeds.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatisticsDelivery(): Promise<boolean> {
		this.trace.push( 'delivery:begin' );

		if ( this.resetFailure !== null ) {
			return Promise.reject( this.resetFailure );
		}

		if ( ! this.resetResult ) {
			return Promise.resolve( false );
		}

		this.delivery = createDelivery( StoredProtectionStatisticsDeliveryStatus.INCOMPLETE );

		return Promise.resolve( true );
	}

	/**
	 * Completes an empty incomplete delivery reset or reports a controlled failure.
	 * @return True only when the controlled completion succeeds.
	 * @since 0.1.0 Initial implementation.
	 */
	completeStatisticsDeliveryReset(): Promise<boolean> {
		this.trace.push( 'delivery:complete' );

		if ( this.resetCompletionFailure !== null ) {
			return Promise.reject( this.resetCompletionFailure );
		}

		if ( ! this.resetCompletionResult ) {
			return Promise.resolve( false );
		}

		this.delivery = createDelivery( StoredProtectionStatisticsDeliveryStatus.COMPLETE );

		return Promise.resolve( true );
	}
}

/**
 * Controlled browser observations used by statistics-runtime tests.
 * @since 0.1.0 Initial implementation.
 */
export class MemoryStatisticsBrowser {
	/**
	 * Current focused browser tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	focusedTabId: number | null = null;

	/**
	 * Current browser tab snapshot.
	 * @since 0.1.0 Initial implementation.
	 */
	tabs: ReadonlyArray<ProtectionRuntimeTab> = [];

	/**
	 * Optional focused-tab observation failure.
	 * @since 0.1.0 Initial implementation.
	 */
	focusedTabFailure: Error | null = null;

	/**
	 * Optional tab-list observation failure.
	 * @since 0.1.0 Initial implementation.
	 */
	tabListFailure: Error | null = null;
}

/**
 * Mutable deterministic clock used by statistics-runtime tests.
 * @since 0.1.0 Initial implementation.
 */
export class StatisticsRuntimeTestClock {
	/**
	 * Optional clock read failure.
	 * @since 0.1.0 Initial implementation.
	 */
	failure: Error | null = null;

	/**
	 * Creates a clock at one exact epoch instant.
	 * @param nowEpochMilliseconds - Initial epoch time.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public nowEpochMilliseconds = TEST_NOW_EPOCH_MILLISECONDS ) {}

	/**
	 * Returns the current mutable test instant.
	 * @return Current test epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now(): number {
		if ( this.failure !== null ) {
			throw this.failure;
		}

		return this.nowEpochMilliseconds;
	}
}

/**
 * Creates a complete or incomplete delivery around supplied FIFO batches.
 * @param status - Durable delivery completeness state.
 * @param outbox - Ordered batches waiting for aggregation.
 * @return Detached delivery snapshot.
 * @since 0.1.0 Initial implementation.
 */
export function createDelivery(
	status: ProtectionCoordinatorStatisticsDeliverySnapshot[ 'status' ],
	outbox: ProtectionCoordinatorStatisticsDeliverySnapshot[ 'outbox' ] = [],
): ProtectionCoordinatorStatisticsDeliverySnapshot {
	return { status, outbox };
}

/**
 * Creates one runtime and its controlled boundary dependencies.
 * @param delivery - Initial durable delivery snapshot.
 * @param document - Initial local statistics document or unsafe marker.
 * @param session - Initial compatible session work.
 * @return Runtime and controlled dependencies.
 * @since 0.1.0 Initial implementation.
 */
export function createRuntimeHarness(
	delivery: ProtectionCoordinatorStatisticsDeliverySnapshot | null = createDelivery(
		StoredProtectionStatisticsDeliveryStatus.COMPLETE,
	),
	document: StatisticsDocument | null = createStatisticsDocument(),
	session: StatisticsSessionDocument | null = null,
) {
	const trace: string[] = [];
	const storage = new MemoryStatisticsStorage( document, trace );
	const sessionStorage = new MemoryStatisticsSessionStorage( session, trace );
	const coordinator = new MemoryStatisticsProtectionCoordinator( delivery, trace );
	const browser = new MemoryStatisticsBrowser();
	const clock = new StatisticsRuntimeTestClock();
	let resetGenerationSequence = 0;

	/**
	 * Creates one deterministic fresh generation for each reset attempt.
	 * @return Fresh reset generation identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	function createResetGenerationId(): string {
		resetGenerationSequence += 1;

		return resetGenerationSequence === 1
			? 'generation_reset'
			: `generation_reset_${ String( resetGenerationSequence ) }`;
	}

	const options: StatisticsRuntimeOptions = {
		coordinator,
		storage,
		sessionStorage,
		createGenerationId: createResetGenerationId,
	};
	const runtime = createStatisticsRuntime( options );

	return { browser, clock, coordinator, options, runtime, sessionStorage, storage, trace };
}

/**
 * Reconciles the standard current configuration into one runtime.
 * @param runtime - Statistics runtime under test.
 * @param configuration - Raw configuration candidate.
 * @return Promise settled after reconciliation.
 * @since 0.1.0 Initial implementation.
 */
export function reconcileRuntime(
	runtime: StatisticsRuntime,
	configuration: unknown = TEST_CONFIGURATION,
): Promise<void> {
	return runtime.reconcileConfiguration( configuration );
}

/**
 * Creates one event-time checkpoint observation from controlled fixture state.
 * @param harness - Statistics runtime test harness.
 * @param configuration - Current permission-filtered configuration.
 * @param navigation - Optional top-level navigation captured with focus.
 * @param focusEpochTransition - Focus epoch context captured before browser inspection.
 * @return Complete observation or a conservative unavailable marker.
 * @since 0.1.0 Initial implementation.
 */
export function createTestCheckpointObservation(
	harness: ReturnType<typeof createRuntimeHarness>,
	configuration: ProtectionConfigurationDocument | null,
	navigation?: ProtectionRuntimeNavigation,
	focusEpochTransition: StatisticsFocusEpochTransition | null = {
		mode: StatisticsFocusObservationMode.SAMPLE,
		previousFocusEpochId: harness.sessionStorage.focusEpochId,
		currentFocusEpochId: harness.sessionStorage.focusEpochId,
	},
): StatisticsCheckpointObservation {
	const observedAtEpochMilliseconds = harness.clock.failure === null
		? harness.clock.nowEpochMilliseconds
		: null;
	const observationFailed = configuration === null ||
		harness.browser.focusedTabFailure !== null ||
		harness.browser.tabListFailure !== null ||
		harness.coordinator.stateReadFailure !== null ||
		harness.coordinator.states === null;

	return {
		observedAtEpochMilliseconds,
		focusEpochTransition,
		focusObservation: observationFailed
			? null
			: {
				focusedAtEpochMilliseconds: harness.clock.nowEpochMilliseconds,
				focusedTabId: harness.browser.focusedTabId,
				statesByScope: harness.coordinator.states ?? {},
				tabs: harness.browser.tabs,
				...( navigation === undefined ? {} : { navigation } ),
			},
	};
}

/**
 * Applies one deterministic event-time observation to the statistics runtime.
 * @param harness - Statistics runtime test harness.
 * @param configuration - Current permission-filtered configuration.
 * @param navigation - Optional top-level navigation captured with focus.
 * @param mode - Relationship between this checkpoint and browser focus state.
 * @return Promise resolved after checkpoint persistence settles.
 * @since 0.1.0 Initial implementation.
 */
export async function checkpointRuntime(
	harness: ReturnType<typeof createRuntimeHarness>,
	configuration: ProtectionConfigurationDocument | null = TEST_CONFIGURATION,
	navigation?: ProtectionRuntimeNavigation,
	mode: StatisticsFocusEpochTransition['mode'] = StatisticsFocusObservationMode.SAMPLE,
): Promise<void> {
	const focusEpochTransition = await harness.runtime.beginFocusObservation( mode );

	await harness.runtime.checkpoint(
		configuration,
		createTestCheckpointObservation(
			harness,
			configuration,
			navigation,
			focusEpochTransition,
		),
	);
}
