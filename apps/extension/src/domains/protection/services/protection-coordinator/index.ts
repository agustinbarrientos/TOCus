import {
	ProtectionEventSchema,
	ProtectionEventType,
} from '../../types/protection-event';
import {
	ProtectionStateSchema,
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import {
	ProtectionFactBatchIdSchema,
	SessionContinuityIdSchema,
	type SessionContinuityId,
} from '../../types/protection-value';
import {
	StoredProtectionStatisticsDeliverySchema,
	StoredProtectionStatisticsDeliveryStatus,
	type StoredProtectionStatisticsDelivery,
} from '../../types/stored-protection-statistics-delivery';
import {
	StoredProtectionStateParseStatus,
	parseStoredProtectionState,
} from '../../utils/parse-stored-protection-state';
import { prepareStoredProtectionState } from '../../utils/prepare-stored-protection-state';
import {
	ProtectionStateRestoreMode,
	ProtectionStateRestoreStatus,
	restoreProtectionState,
} from '../../utils/restore-protection-state';
import { transitionProtectionState } from '../../utils/transition-protection-state';
import {
	ProtectionCoordinatorDispatchResultSchema,
	ProtectionCoordinatorDispatchStatus,
	ProtectionCoordinatorFailureReason,
	ProtectionCoordinatorInitializationInputSchema,
	ProtectionCoordinatorInitializationResultSchema,
	ProtectionCoordinatorInitializationStatus,
	type ProtectionCoordinator,
	type ProtectionCoordinatorDispatchResult,
	type ProtectionCoordinatorFailureReason as ProtectionCoordinatorFailureReasonValue,
	type ProtectionCoordinatorInitializationResult,
	type ProtectionCoordinatorOptions,
	type ProtectionCoordinatorStatisticsDeliveryBoundary,
	type ProtectionCoordinatorStatisticsDeliverySnapshot,
	type ProtectionCoordinatorStateSnapshot,
	type PrepareProtectionEvent,
} from './types';
import {
	cloneProtectionStatisticsDelivery,
	createEmptyProtectionStatisticsDelivery,
	prepareStatisticsDeliveryForTransition,
} from '../../utils/prepare-protection-statistics-delivery';

/**
 * Clones current runtime state without exposing the coordinator's mutable authority.
 * @param statesByScope - Validated states owned by the coordinator.
 * @return Detached states indexed by protection scope.
 * @since 0.1.0 Initial implementation.
 */
function cloneProtectionStates(
	statesByScope: Readonly<Record<string, ProtectionState>>,
): ProtectionCoordinatorStateSnapshot {
	return Object.fromEntries(
		Object.entries( statesByScope ).map( ( [ scopeId, state ] ) => [
			scopeId,
			ProtectionStateSchema.parse( state ),
		] ),
	);
}

/**
 * Creates a validated failed initialization result without exposing an error object.
 * @param reason - Stable initialization failure reason.
 * @return Failed initialization result.
 * @since 0.1.0 Initial implementation.
 */
function createInitializationFailure(
	reason: ProtectionCoordinatorFailureReasonValue,
): ProtectionCoordinatorInitializationResult {
	return ProtectionCoordinatorInitializationResultSchema.parse( {
		status: ProtectionCoordinatorInitializationStatus.FAILED,
		reason,
		decisions: [],
		facts: [],
		requirements: [],
	} );
}

/**
 * Creates a validated rejected dispatch result without unpersisted effects.
 * @param reason - Stable dispatch rejection reason.
 * @return Rejected dispatch result.
 * @since 0.1.0 Initial implementation.
 */
function createDispatchRejection(
	reason: ProtectionCoordinatorFailureReasonValue,
): ProtectionCoordinatorDispatchResult {
	return ProtectionCoordinatorDispatchResultSchema.parse( {
		status: ProtectionCoordinatorDispatchStatus.REJECTED,
		reason,
		decisions: [],
		facts: [],
	} );
}

/**
 * Creates one serialized protection runtime coordinator.
 * @param options - Storage and identifier dependencies.
 * @return Protection coordinator instance.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionCoordinator( options: ProtectionCoordinatorOptions ): ProtectionCoordinator {
	let statesByScope: Record<string, ProtectionState> | null = null;
	let sessionContinuityId: SessionContinuityId | null = null;
	let statisticsDelivery: StoredProtectionStatisticsDelivery | null = null;
	let operationQueue: Promise<void> = Promise.resolve();

	/**
	 * Invokes the statistics batch identifier dependency without losing its receiver.
	 * @return Unknown identifier candidate.
	 * @since 0.1.0 Initial implementation.
	 */
	function createProtectionFactBatchId(): unknown {
		return options.createProtectionFactBatchId();
	}

	/**
	 * Serializes one coordinator operation without poisoning the queue after rejection.
	 * @param operation - Deferred coordinator operation.
	 * @return Promise for the operation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueue<T>( operation: () => Promise<T> ): Promise<T> {
		const result = operationQueue.then( operation, operation );

		operationQueue = result.then(
			() => undefined,
			() => undefined,
		);

		return result;
	}

	/**
	 * Restores, normalizes, and persists protection state inside the serialized queue.
	 * @param input - Unknown initialization observations.
	 * @return Validated initialization result after persistence.
	 * @throws {Error} When input validation or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	async function initializeOperation( input: unknown ): Promise<ProtectionCoordinatorInitializationResult> {
		statesByScope = null;
		sessionContinuityId = null;
		statisticsDelivery = null;

		const parsedInput = ProtectionCoordinatorInitializationInputSchema.parse( input );
		let loadedState: Awaited<ReturnType<typeof options.storage.load>>;

		try {
			loadedState = await options.storage.load();
		} catch {
			return createInitializationFailure( ProtectionCoordinatorFailureReason.STORAGE_READ_FAILED );
		}

		const parsedState = parseStoredProtectionState( loadedState );
		const nextSessionContinuityId = SessionContinuityIdSchema.parse(
			parsedState.session.status === StoredProtectionStateParseStatus.CURRENT
				? parsedState.session.state.sessionContinuityId
				: options.createSessionContinuityId(),
		);
		const restoredState = restoreProtectionState(
			parsedState.session.status === StoredProtectionStateParseStatus.CURRENT
				? {
					mode: ProtectionStateRestoreMode.CONTINUED_SESSION,
					parsedState,
					nowEpochMilliseconds: parsedInput.nowEpochMilliseconds,
					sessionContinuityId: nextSessionContinuityId,
					readyObservations: parsedInput.readyObservations,
				}
				: {
					mode: ProtectionStateRestoreMode.NEW_SESSION,
					parsedState,
					nowEpochMilliseconds: parsedInput.nowEpochMilliseconds,
				},
		);

		if ( restoredState.status === ProtectionStateRestoreStatus.FAILURE ) {
			return createInitializationFailure( ProtectionCoordinatorFailureReason.INVALID_DURABLE_STATE );
		}

		const nextStatisticsDelivery =
			parsedState.durable.status === StoredProtectionStateParseStatus.CURRENT
				? parsedState.durable.state.statisticsDelivery
				: createEmptyProtectionStatisticsDelivery();

		const preparedState = prepareStoredProtectionState( {
			statesByScope: restoredState.statesByScope,
			sessionContinuityId: nextSessionContinuityId,
			statisticsDelivery: nextStatisticsDelivery,
		} );

		try {
			await options.storage.save( preparedState );
		} catch {
			return createInitializationFailure( ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED );
		}

		statesByScope = restoredState.statesByScope;
		sessionContinuityId = nextSessionContinuityId;
		statisticsDelivery = nextStatisticsDelivery;

		return ProtectionCoordinatorInitializationResultSchema.parse( {
			status: restoredState.status === ProtectionStateRestoreStatus.RECONCILIATION_REQUIRED
				? ProtectionCoordinatorInitializationStatus.RECONCILIATION_REQUIRED
				: ProtectionCoordinatorInitializationStatus.READY,
			decisions: restoredState.decisions,
			facts: [],
			requirements: restoredState.requirements,
		} );
	}

	/**
	 * Prepares, applies, and persists one protection event inside the serialized queue.
	 * @param prepareEvent - Deferred event preparation with current browser observations.
	 * @param measurementRevision - Optional revision captured with an emitted statistics batch.
	 * @return Validated dispatch result after persistence.
	 * @throws {Error} When event preparation rejects or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	async function dispatchOperation(
		prepareEvent: PrepareProtectionEvent,
		measurementRevision?: unknown,
	): Promise<ProtectionCoordinatorDispatchResult> {
		const currentStatesByScope = statesByScope;
		const currentSessionContinuityId = sessionContinuityId;
		const currentStatisticsDelivery = statisticsDelivery;

		if (
			currentStatesByScope === null ||
			currentSessionContinuityId === null ||
			currentStatisticsDelivery === null
		) {
			return createDispatchRejection( ProtectionCoordinatorFailureReason.NOT_INITIALIZED );
		}

		const eventResult = ProtectionEventSchema.safeParse(
			await prepareEvent( cloneProtectionStates( currentStatesByScope ) ),
		);

		if ( ! eventResult.success ) {
			return createDispatchRejection( ProtectionCoordinatorFailureReason.INVALID_EVENT );
		}

		const parsedEvent = eventResult.data;
		let currentState = Object.hasOwn( currentStatesByScope, parsedEvent.scopeId )
			? currentStatesByScope[ parsedEvent.scopeId ]
			: undefined;

		if ( currentState === undefined ) {
			if ( parsedEvent.type !== ProtectionEventType.VISIT_ATTEMPT ) {
				return createDispatchRejection( ProtectionCoordinatorFailureReason.UNKNOWN_SCOPE );
			}

			currentState = ProtectionStateSchema.parse( {
				type: ProtectionStateType.IDLE,
				scopeId: parsedEvent.scopeId,
				ladder: {
					completedWaits: 0,
					greatestObservedLocalDate: parsedEvent.observedLocalDate,
				},
			} );
		}

		const transition = transitionProtectionState( currentState, parsedEvent );
		const nextStatesByScope = {
			...currentStatesByScope,
			[ parsedEvent.scopeId ]: transition.state,
		};
		const nextStatisticsDelivery = transition.facts.length === 0
			? currentStatisticsDelivery
			: prepareStatisticsDeliveryForTransition( {
				delivery: currentStatisticsDelivery,
				facts: transition.facts,
				scopeId: parsedEvent.scopeId,
				measurementRevision,
				createProtectionFactBatchId,
			} );
		const preparedState = prepareStoredProtectionState( {
			statesByScope: nextStatesByScope,
			sessionContinuityId: currentSessionContinuityId,
			statisticsDelivery: nextStatisticsDelivery,
		} );

		try {
			await options.storage.save( preparedState );
		} catch {
			return createDispatchRejection( ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED );
		}

		statesByScope = nextStatesByScope;
		statisticsDelivery = nextStatisticsDelivery;

		return ProtectionCoordinatorDispatchResultSchema.parse( {
			status: ProtectionCoordinatorDispatchStatus.APPLIED,
			decisions: transition.decisions,
			facts: transition.facts,
		} );
	}

	/**
	 * Enqueues protection-state initialization.
	 * @param input - Unknown initialization observations.
	 * @return Validated initialization result after persistence.
	 * @throws {Error} When input validation or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	function initialize( input: unknown ): Promise<ProtectionCoordinatorInitializationResult> {
		return enqueue( () => initializeOperation( input ) );
	}

	/**
	 * Enqueues deferred preparation for one protection event.
	 * @param prepareEvent - Deferred event preparation with current browser observations.
	 * @param measurementRevision - Optional revision captured with an emitted statistics batch.
	 * @return Validated dispatch result after persistence.
	 * @throws {Error} When event preparation rejects or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	function dispatch(
		prepareEvent: PrepareProtectionEvent,
		measurementRevision?: unknown,
	): Promise<ProtectionCoordinatorDispatchResult> {
		return enqueue( () => dispatchOperation( prepareEvent, measurementRevision ) );
	}

	/**
	 * Returns a detached state snapshot after earlier queued operations settle.
	 * @return Current runtime states, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	function getStates(): Promise<ProtectionCoordinatorStateSnapshot | null> {
		return enqueue( () => Promise.resolve(
			statesByScope === null ? null : cloneProtectionStates( statesByScope ),
		) );
	}

	/**
	 * Returns detached statistics delivery after earlier queued operations settle.
	 * @return Current durable delivery, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	function getStatisticsDelivery(): Promise<ProtectionCoordinatorStatisticsDeliverySnapshot | null> {
		return enqueue( () => Promise.resolve(
			statisticsDelivery === null
				? null
				: cloneProtectionStatisticsDelivery( statisticsDelivery ),
		) );
	}

	/**
	 * Captures the current durable-delivery tail without entering the coordinator queue.
	 * @return Current FIFO boundary, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	function getStatisticsDeliveryBoundary(): ProtectionCoordinatorStatisticsDeliveryBoundary | null {
		if ( statisticsDelivery === null ) {
			return null;
		}

		return {
			lastBatchId: statisticsDelivery.outbox.at( -1 )?.batchId ?? null,
		};
	}

	/**
	 * Returns the current browser-session continuity identifier without entering the queue.
	 * @return Current continuity identifier, or null before successful initialization.
	 * @since 0.1.0 Initial implementation.
	 */
	function getSessionContinuityId(): SessionContinuityId | null {
		return sessionContinuityId;
	}

	/**
	 * Removes one exact head delivery batch after durable-only persistence succeeds.
	 * @param batchId - Unknown candidate head batch identifier.
	 * @return True only after the matching head is durably removed.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	async function acknowledgeStatisticsDeliveryBatchOperation( batchId: unknown ): Promise<boolean> {
		const currentStatesByScope = statesByScope;
		const currentSessionContinuityId = sessionContinuityId;
		const currentStatisticsDelivery = statisticsDelivery;

		if (
			currentStatesByScope === null ||
			currentSessionContinuityId === null ||
			currentStatisticsDelivery === null
		) {
			return false;
		}

		const parsedBatchId = ProtectionFactBatchIdSchema.safeParse( batchId );
		const headBatch = currentStatisticsDelivery.outbox[ 0 ];

		if ( ! parsedBatchId.success || headBatch?.batchId !== parsedBatchId.data ) {
			return false;
		}

		const nextStatisticsDelivery = StoredProtectionStatisticsDeliverySchema.parse( {
			status: currentStatisticsDelivery.status,
			outbox: currentStatisticsDelivery.outbox.slice( 1 ),
		} );
		const preparedState = prepareStoredProtectionState( {
			statesByScope: currentStatesByScope,
			sessionContinuityId: currentSessionContinuityId,
			statisticsDelivery: nextStatisticsDelivery,
		} );

		await options.storage.saveDurableStatisticsDelivery( preparedState.durable );
		statisticsDelivery = nextStatisticsDelivery;

		return true;
	}

	/**
	 * Enqueues one exact-head statistics-delivery acknowledgement.
	 * @param batchId - Unknown candidate head batch identifier.
	 * @return True only after the matching head is durably removed.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	function acknowledgeStatisticsDeliveryBatch( batchId: unknown ): Promise<boolean> {
		return enqueue( () => acknowledgeStatisticsDeliveryBatchOperation( batchId ) );
	}

	/**
	 * Replaces current statistics delivery with an empty incomplete reset marker.
	 * @return True only after the reset is durably stored.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	async function resetStatisticsDeliveryOperation(): Promise<boolean> {
		const currentStatesByScope = statesByScope;
		const currentSessionContinuityId = sessionContinuityId;

		if (
			currentStatesByScope === null ||
			currentSessionContinuityId === null ||
			statisticsDelivery === null
		) {
			return false;
		}

		const nextStatisticsDelivery = StoredProtectionStatisticsDeliverySchema.parse( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: [],
		} );
		const preparedState = prepareStoredProtectionState( {
			statesByScope: currentStatesByScope,
			sessionContinuityId: currentSessionContinuityId,
			statisticsDelivery: nextStatisticsDelivery,
		} );

		await options.storage.saveDurableStatisticsDelivery( preparedState.durable );
		statisticsDelivery = nextStatisticsDelivery;

		return true;
	}

	/**
	 * Enqueues one durable statistics-delivery reset.
	 * @return True only after the reset is durably stored.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	function resetStatisticsDelivery(): Promise<boolean> {
		return enqueue( resetStatisticsDeliveryOperation );
	}

	/**
	 * Marks one empty incomplete statistics-delivery reset complete after durable persistence.
	 * @return True only after the completion is durably stored.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	async function completeStatisticsDeliveryResetOperation(): Promise<boolean> {
		const currentStatesByScope = statesByScope;
		const currentSessionContinuityId = sessionContinuityId;
		const currentStatisticsDelivery = statisticsDelivery;

		if (
			currentStatesByScope === null ||
			currentSessionContinuityId === null ||
			currentStatisticsDelivery?.status !== StoredProtectionStatisticsDeliveryStatus.INCOMPLETE ||
			currentStatisticsDelivery.outbox.length !== 0
		) {
			return false;
		}

		const nextStatisticsDelivery = createEmptyProtectionStatisticsDelivery();
		const preparedState = prepareStoredProtectionState( {
			statesByScope: currentStatesByScope,
			sessionContinuityId: currentSessionContinuityId,
			statisticsDelivery: nextStatisticsDelivery,
		} );

		await options.storage.saveDurableStatisticsDelivery( preparedState.durable );
		statisticsDelivery = nextStatisticsDelivery;

		return true;
	}

	/**
	 * Enqueues completion of one durable statistics-delivery reset.
	 * @return True only after the completion is durably stored.
	 * @throws {Error} When durable-only persistence rejects unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	function completeStatisticsDeliveryReset(): Promise<boolean> {
		return enqueue( completeStatisticsDeliveryResetOperation );
	}

	return {
		acknowledgeStatisticsDeliveryBatch,
		completeStatisticsDeliveryReset,
		dispatch,
		getStates,
		getSessionContinuityId,
		getStatisticsDelivery,
		getStatisticsDeliveryBoundary,
		initialize,
		resetStatisticsDelivery,
	};
}

export * from './types';
