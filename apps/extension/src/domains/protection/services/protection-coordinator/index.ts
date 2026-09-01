import {
	ProtectionEventSchema,
	ProtectionEventType,
} from '../../types/protection-event';
import {
	ProtectionStateSchema,
	ProtectionStateType,
	type ProtectionState,
} from '../../types/protection-state';
import { SessionContinuityIdSchema } from '../../types/protection-value';
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
	type PrepareProtectionEvent,
} from './types';

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
	let sessionContinuityId: string | null = null;
	let operationQueue: Promise<void> = Promise.resolve();

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

		const preparedState = prepareStoredProtectionState( {
			statesByScope: restoredState.statesByScope,
			sessionContinuityId: nextSessionContinuityId,
		} );

		try {
			await options.storage.save( preparedState );
		} catch {
			return createInitializationFailure( ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED );
		}

		statesByScope = restoredState.statesByScope;
		sessionContinuityId = nextSessionContinuityId;

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
	 * @return Validated dispatch result after persistence.
	 * @throws {Error} When event preparation rejects or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	async function dispatchOperation(
		prepareEvent: PrepareProtectionEvent,
	): Promise<ProtectionCoordinatorDispatchResult> {
		const currentStatesByScope = statesByScope;
		const currentSessionContinuityId = sessionContinuityId;

		if ( currentStatesByScope === null || currentSessionContinuityId === null ) {
			return createDispatchRejection( ProtectionCoordinatorFailureReason.NOT_INITIALIZED );
		}

		const eventResult = ProtectionEventSchema.safeParse( await prepareEvent() );

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
		const preparedState = prepareStoredProtectionState( {
			statesByScope: nextStatesByScope,
			sessionContinuityId: currentSessionContinuityId,
		} );

		try {
			await options.storage.save( preparedState );
		} catch {
			return createDispatchRejection( ProtectionCoordinatorFailureReason.STORAGE_WRITE_FAILED );
		}

		statesByScope = nextStatesByScope;

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
	 * @return Validated dispatch result after persistence.
	 * @throws {Error} When event preparation rejects or a domain invariant fails unexpectedly.
	 * @since 0.1.0 Initial implementation.
	 */
	function dispatch( prepareEvent: PrepareProtectionEvent ): Promise<ProtectionCoordinatorDispatchResult> {
		return enqueue( () => dispatchOperation( prepareEvent ) );
	}

	return { initialize, dispatch };
}

export * from './types';
