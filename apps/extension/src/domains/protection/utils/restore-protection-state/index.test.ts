import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import {
	ProtectionStateReconciliationRequirementReason,
	ProtectionStateRestoreMode,
	RestoreProtectionStateResultSchema,
	ProtectionStateRestoreStatus,
	restoreProtectionState,
} from './index';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { ProtectionFactType } from '../../types/protection-fact';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType } from '../../types/protection-state';
import {
	StoredProtectionStateFailureReason,
	StoredProtectionStateParseStatus,
	parseStoredProtectionState,
} from '../parse-stored-protection-state';
import { prepareStoredProtectionState } from '../prepare-stored-protection-state';
import {
	StoredProtectionParticipantOrigin,
} from '../../types/stored-protection-participant';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredProtectionScopeStateType,
} from '../../types/stored-protection-state';

const FIRST_INSTANT = 1_800_000_000_000;
const ALLOWANCE_EXPIRY = FIRST_INSTANT + 300_000;

describe( 'RestoreProtectionStateResultSchema', () => {
	const validFact = {
		type: ProtectionFactType.PAUSE_TIME,
		factId: 'pause-time_10-scope-idle_6-wait-a_1-1_4-4000',
		scopeId: 'scope-idle',
		waitId: 'wait-a',
		ownerParticipantId: 'participant-a',
		ownerEpoch: 1,
		checkpointHighWaterMilliseconds: 4_000,
		acceptedDurationMilliseconds: 4_000,
		observedAtEpochMilliseconds: FIRST_INSTANT,
	};
	const validResults = [
		{
			label: 'restored',
			result: {
				status: ProtectionStateRestoreStatus.RESTORED,
				statesByScope: { 'scope-idle': createIdleState() },
				decisions: [],
				facts: [],
				requirements: [],
			},
		},
		{
			label: 'reconciliation-required',
			result: {
				status: ProtectionStateRestoreStatus.RECONCILIATION_REQUIRED,
				statesByScope: { 'scope-idle': createIdleState() },
				decisions: [],
				facts: [],
				requirements: [ {
					scopeId: 'scope-idle',
					allowanceId: 'allowance-a',
					participantId: 'participant-a',
					pageId: 'page-a',
					reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
				} ],
			},
		},
		{
			label: 'failure',
			result: {
				status: ProtectionStateRestoreStatus.FAILURE,
				reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
				statesByScope: {},
				decisions: [],
				facts: [],
				requirements: [],
			},
		},
	];

	it.each( validResults )( 'accepts exact-empty facts for a $label result', ( { result } ) => {
		expect( () => RestoreProtectionStateResultSchema.parse( result ) ).not.toThrow();
	} );

	it.each( validResults )( 'rejects a valid fact in a $label result', ( { result } ) => {
		expect( () => RestoreProtectionStateResultSchema.parse( {
			...result,
			facts: [ validFact ],
		} ) ).toThrow( ZodError );
	} );

	it.each( [ null, [], 'scope-idle' ] )( 'rejects non-record statesByScope value %#', ( statesByScope ) => {
		expect( () => RestoreProtectionStateResultSchema.parse( {
			...validResults[ 0 ]?.result,
			statesByScope,
		} ) ).toThrow( ZodError );
	} );

	it.each( [
		{ label: 'Date', statesByScope: new Date( 0 ) },
		{ label: 'Map', statesByScope: new Map( [ [ 'scope-idle', createIdleState() ] ] ) },
		{ label: 'RegExp', statesByScope: /scope-idle/ },
	] )( 'rejects a $label instance as statesByScope', ( { statesByScope } ) => {
		expect( () => RestoreProtectionStateResultSchema.parse( {
			...validResults[ 0 ]?.result,
			statesByScope,
		} ) ).toThrow( ZodError );
	} );

	it( 'rejects a runtime state indexed by a different scope identifier', () => {
		expect( () => RestoreProtectionStateResultSchema.parse( {
			...validResults[ 0 ]?.result,
			statesByScope: {
				'scope-a': createIdleState( 'scope-b' ),
			},
		} ) ).toThrow( ZodError );
	} );

	it( 'accepts a null-prototype runtime-state record with matching scope identity', () => {
		const statesByScope = {
			'scope-idle': createIdleState(),
		};
		Reflect.setPrototypeOf( statesByScope, null );

		expect( () => RestoreProtectionStateResultSchema.parse( {
			...validResults[ 0 ]?.result,
			statesByScope,
		} ) ).not.toThrow();
	} );
} );

/**
 * Creates a stored-state daily ladder fixture.
 * @param completedWaits - Completed waits on the greatest observed date.
 * @param greatestObservedLocalDate - Greatest observed local date.
 * @return A daily ladder.
 * @since 0.1.0 Initial implementation.
 */
function createLadder( completedWaits = 2, greatestObservedLocalDate = '2026-08-31' ) {
	return { completedWaits, greatestObservedLocalDate };
}

/**
 * Creates a runtime navigation participant fixture.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param retainedDestination - Retained HTTP(S) destination.
 * @param focusEligible - Whether the participant can own progress.
 * @param joinSequence - Stable join sequence.
 * @return A runtime navigation participant.
 * @since 0.1.0 Initial implementation.
 */
function createRuntimeNavigationParticipant(
	participantId = 'participant-a',
	pageId = 'page-a',
	retainedDestination: string | null = 'https://example.com/a',
	focusEligible = true,
	joinSequence = 0,
) {
	return {
		origin: ProtectionParticipantOrigin.NAVIGATION,
		participantId,
		pageId,
		retainedDestination,
		focusEligible,
		joinSequence,
	};
}

/**
 * Creates a runtime allowance-expiry participant fixture.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param focusEligible - Whether the participant can own progress.
 * @param joinSequence - Stable join sequence.
 * @return A runtime allowance-expiry participant.
 * @since 0.1.0 Initial implementation.
 */
function createRuntimeExpiryParticipant(
	participantId = 'participant-b',
	pageId = 'page-b',
	focusEligible = false,
	joinSequence = 1,
) {
	return {
		origin: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
		participantId,
		pageId,
		retainedDestination: null,
		focusEligible,
		joinSequence,
	};
}

/**
 * Creates a stored navigation participant fixture.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param retainedDestination - Retained HTTP(S) destination.
 * @param joinSequence - Stable join sequence.
 * @return A stored navigation participant.
 * @since 0.1.0 Initial implementation.
 */
function createStoredNavigationParticipant(
	participantId = 'participant-a',
	pageId = 'page-a',
	retainedDestination = 'https://example.com/a',
	joinSequence = 0,
) {
	return {
		origin: StoredProtectionParticipantOrigin.NAVIGATION,
		participantId,
		pageId,
		retainedDestination,
		joinSequence,
	};
}

/**
 * Creates a stored allowance-expiry participant fixture.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param joinSequence - Stable join sequence.
 * @return A stored allowance-expiry participant.
 * @since 0.1.0 Initial implementation.
 */
function createStoredExpiryParticipant(
	participantId = 'participant-b',
	pageId = 'page-b',
	joinSequence = 1,
) {
	return {
		origin: StoredProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
		participantId,
		pageId,
		retainedDestination: null,
		joinSequence,
	};
}

/**
 * Creates an Idle runtime state fixture.
 * @param scopeId - Scope identifier.
 * @return An Idle state.
 * @since 0.1.0 Initial implementation.
 */
function createIdleState( scopeId = 'scope-idle' ) {
	return {
		type: ProtectionStateType.IDLE,
		scopeId,
		ladder: createLadder(),
	};
}

/**
 * Creates an Allowance runtime state fixture.
 * @param scopeId - Scope identifier.
 * @param readyParticipants - Ready participant collection.
 * @return An Allowance state.
 * @since 0.1.0 Initial implementation.
 */
function createAllowanceState(
	scopeId = 'scope-allowance',
	readyParticipants = [ createRuntimeNavigationParticipant(), createRuntimeExpiryParticipant() ],
) {
	return {
		type: ProtectionStateType.ALLOWANCE,
		scopeId,
		allowanceId: 'allowance-a',
		completedWaitId: readyParticipants.length > 0 ? 'wait-a' : null,
		startedAtEpochMilliseconds: FIRST_INSTANT,
		expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY,
		readyParticipants,
		ladder: createLadder(),
	};
}

/**
 * Creates a current durable state fixture.
 * @param scopes - Durable scope record.
 * @return A current durable state.
 * @since 0.1.0 Initial implementation.
 */
function createStoredDurableState<Scopes extends object>( scopes: Scopes ) {
	return {
		schemaVersion: DurableStoredProtectionStateVersion,
		scopes,
	};
}

/**
 * Creates a current session state fixture.
 * @param scopes - Session scope record.
 * @param sessionContinuityId - Stored continuity identifier.
 * @return A current session state.
 * @since 0.1.0 Initial implementation.
 */
function createStoredSessionState(
	scopes: unknown = {},
	sessionContinuityId = 'session-current',
) {
	return {
		schemaVersion: SessionStoredProtectionStateVersion,
		sessionContinuityId,
		scopes,
	};
}

/**
 * Creates a stored Waiting scope fixture.
 * @return A stored Waiting scope.
 * @since 0.1.0 Initial implementation.
 */
function createStoredWaitingScope() {
	return {
		type: StoredProtectionScopeStateType.WAITING,
		waitId: 'wait-a',
		capturedWaitDurationMilliseconds: 15_000,
		confirmedFocusedDurationMilliseconds: 4_000,
		participants: [
			createStoredNavigationParticipant(),
			createStoredExpiryParticipant(),
		],
		ownerParticipantId: 'participant-a',
		ownerEpoch: 3,
		checkpointHighWaterMilliseconds: 4_000,
	};
}

/**
 * Creates a stored Ready scope fixture.
 * @param allowanceId - Matching allowance identifier.
 * @param participants - Stored Ready participant collection.
 * @return A stored Ready scope.
 * @since 0.1.0 Initial implementation.
 */
function createStoredReadyScope(
	allowanceId = 'allowance-a',
	participants: unknown[] = [ createStoredNavigationParticipant(), createStoredExpiryParticipant() ],
) {
	return {
		type: StoredProtectionScopeStateType.READY,
		allowanceId,
		completedWaitId: 'wait-a',
		participants,
	};
}

/**
 * Creates a durable scope fixture.
 * @param allowanceId - Optional allowance identifier.
 * @return A durable scope.
 * @since 0.1.0 Initial implementation.
 */
function createStoredDurableScope( allowanceId: string | null = null ) {
	if ( allowanceId === null ) {
		return { ladder: createLadder() };
	}

	return {
		ladder: createLadder(),
		allowance: {
			allowanceId,
			startedAtEpochMilliseconds: FIRST_INSTANT,
			expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY,
		},
	};
}

/**
 * Creates a parsed-state pair fixture.
 * @param durable - Parsed durable result.
 * @param session - Parsed session result.
 * @return Parsed stored protection state.
 * @since 0.1.0 Initial implementation.
 */
function createParsedStoredState(
	durable: unknown = {
		status: StoredProtectionStateParseStatus.CURRENT,
		state: createStoredDurableState( {} ),
	},
	session: unknown = { status: StoredProtectionStateParseStatus.ABSENT },
) {
	return { durable, session };
}


/**
 * Creates a continued-session restoration input.
 * @param parsedState - Parsed durable and session results.
 * @param readyObservations - Fresh Ready observations.
 * @param nowEpochMilliseconds - Current wall-clock instant.
 * @param sessionContinuityId - Coordinator continuity identifier.
 * @return A continued-session restoration input.
 * @since 0.1.0 Initial implementation.
 */
function createContinuedRestoreInput(
	parsedState: unknown,
	readyObservations: unknown[] = [],
	nowEpochMilliseconds = FIRST_INSTANT + 1,
	sessionContinuityId = 'session-current',
) {
	return {
		mode: ProtectionStateRestoreMode.CONTINUED_SESSION,
		parsedState,
		nowEpochMilliseconds,
		sessionContinuityId,
		readyObservations,
	};
}

/**
 * Creates a new-session restoration input.
 * @param parsedState - Parsed durable and session results.
 * @param nowEpochMilliseconds - Current wall-clock instant.
 * @return A new-session restoration input.
 * @since 0.1.0 Initial implementation.
 */
function createNewSessionRestoreInput( parsedState: unknown, nowEpochMilliseconds = FIRST_INSTANT + 1 ) {
	return {
		mode: ProtectionStateRestoreMode.NEW_SESSION,
		parsedState,
		nowEpochMilliseconds,
	};
}

describe( 'restoreProtectionState', () => {
	it.each( [
		{
			label: 'invalid durable state',
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		},
		{
			label: 'unsupported durable state',
			reason: StoredProtectionStateFailureReason.UNSUPPORTED_VERSION,
		},
	] )( 'gives failed durable parse precedence over all session state for $label', ( { reason } ) => {
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.FAILED, reason },
			{
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredSessionState( {
					'scope-session-only': createStoredWaitingScope(),
				} ),
			},
		);

		expect( restoreProtectionState( createContinuedRestoreInput( parsedState ) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.FAILURE,
			reason,
			statesByScope: {},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	} );

	it( 'restores exact empty state when durable state is absent', () => {
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.ABSENT },
			{ status: StoredProtectionStateParseStatus.ABSENT },
		);

		expect( restoreProtectionState( createNewSessionRestoreInput( parsedState ) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	} );

	it( 'materializes durable scopes lexically as Idle without allowance data', () => {
		const durable = createStoredDurableState( {
			'scope-z': { ladder: createLadder( 3 ) },
			'scope-a': { ladder: createLadder( 1 ) },
		} );
		const parsedState = createParsedStoredState( {
			status: StoredProtectionStateParseStatus.CURRENT,
			state: durable,
		} );

		const result = restoreProtectionState( createNewSessionRestoreInput( parsedState ) );

		expect( Object.keys( result.statesByScope ) ).toEqual( [ 'scope-a', 'scope-z' ] );
		expect( result ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-a': {
					type: ProtectionStateType.IDLE,
					scopeId: 'scope-a',
					ladder: createLadder( 1 ),
				},
				'scope-z': {
					type: ProtectionStateType.IDLE,
					scopeId: 'scope-z',
					ladder: createLadder( 3 ),
				},
			},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	} );

	it.each( [
		{ label: 'new session', mode: ProtectionStateRestoreMode.NEW_SESSION },
		{ label: 'continued session without continuity proof', mode: ProtectionStateRestoreMode.CONTINUED_SESSION },
	] )( 'restores an unexpired durable allowance in a $label', ( { mode } ) => {
		const parsedState = createParsedStoredState( {
			status: StoredProtectionStateParseStatus.CURRENT,
			state: createStoredDurableState( {
				'scope-allowance': createStoredDurableScope( 'allowance-a' ),
			} ),
		} );
		const input = mode === ProtectionStateRestoreMode.NEW_SESSION
			? createNewSessionRestoreInput( parsedState )
			: createContinuedRestoreInput( parsedState );

		expect( restoreProtectionState( input ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-allowance': {
					...createAllowanceState( 'scope-allowance', [] ),
					ladder: createLadder(),
				},
			},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	} );

	it.each( [ ALLOWANCE_EXPIRY, ALLOWANCE_EXPIRY + 1 ] )(
		'converts an allowance to Idle in a new session at or after expiry %s',
		( nowEpochMilliseconds ) => {
			const parsedState = createParsedStoredState( {
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredDurableState( {
					'scope-allowance': createStoredDurableScope( 'allowance-a' ),
				} ),
			} );

			expect( restoreProtectionState(
				createNewSessionRestoreInput( parsedState, nowEpochMilliseconds ),
			) ).toEqual( {
				status: ProtectionStateRestoreStatus.RESTORED,
				statesByScope: {
					'scope-allowance': {
						type: ProtectionStateType.IDLE,
						scopeId: 'scope-allowance',
						ladder: createLadder(),
					},
				},
				decisions: [],
				facts: [],
				requirements: [],
			} );
		},
	);

	it.each( [ ALLOWANCE_EXPIRY, ALLOWANCE_EXPIRY + 1 ] )(
		'preserves an expired allowance under matching continued-session proof at %s',
		( nowEpochMilliseconds ) => {
			const durable = createStoredDurableState( {
				'scope-allowance': createStoredDurableScope( 'allowance-a' ),
			} );
			const session = createStoredSessionState();
			const parsedState = createParsedStoredState(
				{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
				{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
			);

			expect( restoreProtectionState( createContinuedRestoreInput(
				parsedState,
				[],
				nowEpochMilliseconds,
			) ) ).toEqual( {
				status: ProtectionStateRestoreStatus.RESTORED,
				statesByScope: {
					'scope-allowance': createAllowanceState( 'scope-allowance', [] ),
				},
				decisions: [],
				facts: [],
				requirements: [],
			} );
		},
	);

	it.each( [
		{
			label: 'absent session',
			session: { status: StoredProtectionStateParseStatus.ABSENT },
			sessionContinuityId: 'session-current',
		},
		{
			label: 'invalid session',
			session: {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
			},
			sessionContinuityId: 'session-current',
		},
		{
			label: 'unsupported session',
			session: {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.UNSUPPORTED_VERSION,
			},
			sessionContinuityId: 'session-current',
		},
		{
			label: 'mismatched continuity identifier',
			session: {
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredSessionState( {}, 'session-stale' ),
			},
			sessionContinuityId: 'session-current',
		},
	] )( 'uses new-session expiry semantics for $label', ( { session, sessionContinuityId } ) => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			session,
		);

		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[],
			ALLOWANCE_EXPIRY,
			sessionContinuityId,
		) ).statesByScope ).toEqual( {
			'scope-allowance': {
				type: ProtectionStateType.IDLE,
				scopeId: 'scope-allowance',
				ladder: createLadder(),
			},
		} );
	} );

	it( 'ignores session-only scopes because no durable ladder exists', () => {
		const parsedState = createParsedStoredState(
			{
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredDurableState( {} ),
			},
			{
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredSessionState( {
					'scope-session-only': createStoredWaitingScope(),
				} ),
			},
		);

		expect( restoreProtectionState( createContinuedRestoreInput( parsedState ) ).statesByScope ).toEqual( {} );
	} );

	it( 'ignores an inherited session scope when the durable scope has no own session entry', () => {
		const scopeId = 'scope-inherited';
		Object.defineProperty( Object.prototype, scopeId, {
			configurable: true,
			value: createStoredWaitingScope(),
		} );

		try {
			const parsedState = createParsedStoredState(
				{
					status: StoredProtectionStateParseStatus.CURRENT,
					state: createStoredDurableState( {
						[ scopeId ]: createStoredDurableScope(),
					} ),
				},
				{
					status: StoredProtectionStateParseStatus.CURRENT,
					state: createStoredSessionState( {} ),
				},
			);

			expect( restoreProtectionState( createContinuedRestoreInput( parsedState ) ).statesByScope ).toEqual( {
				[ scopeId ]: {
					type: ProtectionStateType.IDLE,
					scopeId,
					ladder: createLadder(),
				},
			} );
		} finally {
			Reflect.deleteProperty( Object.prototype, scopeId );
		}
	} );

	it( 'restores continued Waiting while clearing focus, ownership, and checkpoint state once', () => {
		const storedWaiting = createStoredWaitingScope();
		storedWaiting.participants.reverse();
		const durable = createStoredDurableState( {
			'scope-waiting': { ladder: createLadder( 7, '2026-08-30' ) },
		} );
		const session = createStoredSessionState( { 'scope-waiting': storedWaiting } );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);

		expect( restoreProtectionState( createContinuedRestoreInput( parsedState ) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-waiting': {
					type: ProtectionStateType.WAITING,
					scopeId: 'scope-waiting',
					waitId: 'wait-a',
					capturedWaitDurationMilliseconds: 15_000,
					confirmedFocusedDurationMilliseconds: 4_000,
					participants: [
						{ ...createRuntimeNavigationParticipant(), focusEligible: false },
						createRuntimeExpiryParticipant(),
					],
					ownerParticipantId: null,
					ownerEpoch: 4,
					checkpointHighWaterMilliseconds: 0,
					ladder: createLadder( 7, '2026-08-30' ),
				},
			},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	} );

	it( 'fails open every participant when continued Waiting owner identity cannot advance safely', () => {
		const durable = createStoredDurableState( {
			'scope-waiting': { ladder: createLadder( 7, '2026-08-30' ) },
		} );
		const session = createStoredSessionState( {
			'scope-waiting': {
				...createStoredWaitingScope(),
				ownerEpoch: Number.MAX_SAFE_INTEGER,
			},
		} );
		const parsedState = parseStoredProtectionState( { durable, session } );

		expect( parsedState.session.status ).toBe( StoredProtectionStateParseStatus.CURRENT );
		expect( restoreProtectionState( createContinuedRestoreInput( parsedState ) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-waiting': {
					type: ProtectionStateType.IDLE,
					scopeId: 'scope-waiting',
					ladder: createLadder( 7, '2026-08-30' ),
				},
			},
			decisions: [
				{
					type: ProtectionDecisionType.RELEASE_NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/a',
				},
				{
					type: ProtectionDecisionType.DISMISS_INTERRUPTION,
					participantId: 'participant-b',
					pageId: 'page-b',
				},
			],
			facts: [],
			requirements: [],
		} );
	} );

	it( 'restores an initially ownerless epoch-zero wait as ownerless epoch one', () => {
		const storedWaiting = {
			...createStoredWaitingScope(),
			confirmedFocusedDurationMilliseconds: 0,
			participants: [ createStoredNavigationParticipant() ],
			ownerParticipantId: null,
			ownerEpoch: 0,
			checkpointHighWaterMilliseconds: 0,
		};
		const durable = createStoredDurableState( { 'scope-waiting': createStoredDurableScope() } );
		const session = createStoredSessionState( { 'scope-waiting': storedWaiting } );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);

		const restored = restoreProtectionState( createContinuedRestoreInput( parsedState ) );
		expect( restored.statesByScope[ 'scope-waiting' ] ).toEqual( {
			type: ProtectionStateType.WAITING,
			scopeId: 'scope-waiting',
			waitId: 'wait-a',
			capturedWaitDurationMilliseconds: 15_000,
			confirmedFocusedDurationMilliseconds: 0,
			participants: [ { ...createRuntimeNavigationParticipant(), focusEligible: false } ],
			ownerParticipantId: null,
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 0,
			ladder: createLadder(),
		} );
	} );

	it( 'preserves confirmed progress when restoring an ownerless epoch-two wait', () => {
		const storedWaiting = {
			...createStoredWaitingScope(),
			ownerParticipantId: null,
			ownerEpoch: 2,
			checkpointHighWaterMilliseconds: 0,
		};
		const durable = createStoredDurableState( { 'scope-waiting': createStoredDurableScope() } );
		const session = createStoredSessionState( { 'scope-waiting': storedWaiting } );
		const parsedStoredState = parseStoredProtectionState( { durable, session } );

		expect( parsedStoredState.session ).toEqual( {
			status: StoredProtectionStateParseStatus.CURRENT,
			state: session,
		} );
		expect( restoreProtectionState(
			createContinuedRestoreInput( parsedStoredState ),
		).statesByScope[ 'scope-waiting' ] ).toEqual( {
			type: ProtectionStateType.WAITING,
			scopeId: 'scope-waiting',
			waitId: 'wait-a',
			capturedWaitDurationMilliseconds: 15_000,
			confirmedFocusedDurationMilliseconds: 4_000,
			participants: [
				{ ...createRuntimeNavigationParticipant(), focusEligible: false },
				createRuntimeExpiryParticipant(),
			],
			ownerParticipantId: null,
			ownerEpoch: 3,
			checkpointHighWaterMilliseconds: 0,
			ladder: createLadder(),
		} );
	} );

	it.each( [
		{ label: 'new session', mode: ProtectionStateRestoreMode.NEW_SESSION },
		{ label: 'mismatched continued session', mode: ProtectionStateRestoreMode.CONTINUED_SESSION },
	] )( 'abandons incomplete Waiting without ladder advancement or decisions in a $label', ( { mode } ) => {
		const durable = createStoredDurableState( { 'scope-waiting': createStoredDurableScope() } );
		const session = createStoredSessionState( { 'scope-waiting': createStoredWaitingScope() }, 'session-stale' );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const input = mode === ProtectionStateRestoreMode.NEW_SESSION
			? createNewSessionRestoreInput( parsedState )
			: createContinuedRestoreInput( parsedState );

		expect( restoreProtectionState( input ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-waiting': {
					type: ProtectionStateType.IDLE,
					scopeId: 'scope-waiting',
					ladder: createLadder(),
				},
			},
			decisions: [],
			facts: [],
			requirements: [],
		} );
	} );

	it( 'lets a durable allowance win over stale session Waiting', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredWaitingScope(),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);

		expect( restoreProtectionState( createContinuedRestoreInput( parsedState ) ).statesByScope ).toEqual( {
			'scope-allowance': createAllowanceState( 'scope-allowance', [] ),
		} );
	} );

	it.each( [
		{
			label: 'durable scope without allowance',
			durableScope: createStoredDurableScope(),
			storedAllowanceId: 'allowance-a',
		},
		{
			label: 'mismatched allowance identifier',
			durableScope: createStoredDurableScope( 'allowance-a' ),
			storedAllowanceId: 'allowance-stale',
		},
	] )( 'discards session Ready for $label', ( { durableScope, storedAllowanceId } ) => {
		const durable = createStoredDurableState( { 'scope-allowance': durableScope } );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( storedAllowanceId ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);

		const restored = restoreProtectionState( createContinuedRestoreInput( parsedState ) );
		expect( restored.decisions ).toEqual( [] );
		expect( restored.requirements ).toEqual( [] );
		expect( restored.statesByScope[ 'scope-allowance' ]?.type ).toBe(
			durableScope.allowance === undefined ? ProtectionStateType.IDLE : ProtectionStateType.ALLOWANCE,
		);
	} );

	it( 'safely restores magic scope keys without aliasing runtime state', () => {
		const statesByScope = Object.fromEntries( [ '__proto__', 'constructor', 'toString' ].map(
			( scopeId ) => [ scopeId, createIdleState( scopeId ) ],
		) );
		const preparedState = prepareStoredProtectionState( {
			statesByScope,
			sessionContinuityId: 'session-current',
		} );
		const parsedState = parseStoredProtectionState( preparedState );
		const restoredState = restoreProtectionState( createNewSessionRestoreInput( parsedState ) );

		expect( Object.keys( preparedState.durable.scopes ) ).toEqual( [
			'__proto__',
			'constructor',
			'toString',
		] );
		for ( const scopeId of Object.keys( preparedState.durable.scopes ) ) {
			expect( Object.hasOwn( preparedState.durable.scopes, scopeId ) ).toBe( true );
			expect( preparedState.durable.scopes[ scopeId ] ).not.toBe( statesByScope[ scopeId ] );
		}

		expect( Object.keys( restoredState.statesByScope ) ).toEqual( [
			'__proto__',
			'constructor',
			'toString',
		] );
		for ( const scopeId of Object.keys( restoredState.statesByScope ) ) {
			expect( Object.hasOwn( restoredState.statesByScope, scopeId ) ).toBe( true );
		}
	} );

	it( 'returns freshly cloned restoration state on every replay', () => {
		const durable = createStoredDurableState( { 'scope-idle': createStoredDurableScope() } );
		const parsedState = createParsedStoredState( {
			status: StoredProtectionStateParseStatus.CURRENT,
			state: durable,
		} );
		const input = createNewSessionRestoreInput( parsedState );

		const first = restoreProtectionState( input );
		const second = restoreProtectionState( input );

		expect( first ).toEqual( second );
		expect( first ).not.toBe( second );
		expect( first.statesByScope[ 'scope-idle' ] ).not.toBe( second.statesByScope[ 'scope-idle' ] );
		expect( first.statesByScope[ 'scope-idle' ]?.ladder ).not.toBe( durable.scopes[ 'scope-idle' ].ladder );
	} );

	it.each( [
		null,
		undefined,
		{},
		[],
		{ mode: 'unknown', parsedState: createParsedStoredState(), nowEpochMilliseconds: FIRST_INSTANT },
		{
			mode: ProtectionStateRestoreMode.NEW_SESSION,
			parsedState: createParsedStoredState(),
			nowEpochMilliseconds: FIRST_INSTANT,
			sessionContinuityId: 'session-current',
		},
	] )( 'rejects malformed restoration input %#', ( input ) => {
		expect( () => restoreProtectionState( input ) ).toThrow( ZodError );
	} );

} );
