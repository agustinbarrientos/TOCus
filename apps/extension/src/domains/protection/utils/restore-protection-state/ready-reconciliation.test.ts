import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import {
	ProtectionStateReconciliationRequirementReason,
	ProtectionStateRestoreMode,
	ProtectionStateRestoreStatus,
	restoreProtectionState,
} from './index';
import { ProtectionDecisionType } from '../../types/protection-decision';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import { ProtectionStateType } from '../../types/protection-state';
import {
	ProtectedUrlMatchStatus,
	ProtectedUrlUnsupportedReason,
} from '../../types/protected-url-match';
import {
	ScheduleEvaluationFailureReason,
	ScheduleEvaluationStatus,
} from '../../types/schedule-evaluation';
import {
	StoredProtectionStateParseStatus,
} from '../parse-stored-protection-state';
import {
	StoredProtectionParticipantOrigin,
} from '../../types/stored-protection-participant';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredProtectionScopeStateType,
} from '../../types/stored-protection-state';

/**
 * Fixed initial instant used by Ready-state restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
const FIRST_INSTANT = 1_800_000_000_000;

/**
 * Fixed allowance expiry used by Ready-state restoration fixtures.
 * @since 0.1.0 Initial implementation.
 */
const ALLOWANCE_EXPIRY = FIRST_INSTANT + 300_000;

/**
 * Recursively freezes a fixture so mutation attempts fail.
 * @param value - Fixture value to freeze.
 * @return The deeply frozen fixture.
 * @since 0.1.0 Initial implementation.
 */
function freezeDeeply<Value>( value: Value ): Value {
	if ( typeof value !== 'object' || value === null || Object.isFrozen( value ) ) {
		return value;
	}

	for ( const child of Object.values( value ) ) {
		freezeDeeply( child );
	}

	return Object.freeze( value );
}

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
		statisticsEligible: false,
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
		statisticsEligible: false,
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
		completedWaitId: 'wait-a',
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
		statisticsDelivery: {
			status: 'complete',
			outbox: [],
		},
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
 * Creates a protected same-scope observation result.
 * @param scopeId - Scope returned by the fresh match.
 * @return A protected rule match.
 * @since 0.1.0 Initial implementation.
 */
function createProtectedMatch( scopeId = 'scope-allowance' ) {
	return {
		status: ProtectedUrlMatchStatus.PROTECTED,
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId,
		},
	};
}

/**
 * Creates a fresh participant observation.
 * @param participantId - Observed participant identifier.
 * @param pageId - Observed page identifier.
 * @param observedDestination - Current destination or null.
 * @param match - Fresh rule-match result.
 * @param schedule - Fresh schedule result.
 * @return A fresh participant observation.
 * @since 0.1.0 Initial implementation.
 */
function createFreshObservation(
	participantId = 'participant-a',
	pageId = 'page-a',
	observedDestination: string | null = 'https://example.com/a',
	match: unknown = createProtectedMatch(),
	schedule: unknown = { status: ScheduleEvaluationStatus.ACTIVE },
) {
	return {
		participantId,
		pageId,
		observedDestination,
		match,
		schedule,
	};
}

/**
 * Wraps a fresh observation with restoration transaction identity.
 * @param observation - Fresh participant observation.
 * @param scopeId - Durable scope identifier.
 * @param allowanceId - Durable allowance identifier.
 * @return A Ready restoration observation.
 * @since 0.1.0 Initial implementation.
 */
function createReadyObservation(
	observation: unknown = createFreshObservation(),
	scopeId = 'scope-allowance',
	allowanceId = 'allowance-a',
) {
	return { scopeId, allowanceId, observation };
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
describe( 'restoreProtectionState Ready reconciliation', () => {
	it( 'restores completed-wait provenance with Ready participants', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': {
				...createStoredReadyScope( 'allowance-a', [ createStoredNavigationParticipant() ] ),
				completedWaitId: 'wait-completed',
			},
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);

		const result = restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ createReadyObservation() ],
		) );

		expect( result.statesByScope[ 'scope-allowance' ] ).toEqual( {
			...createAllowanceState( 'scope-allowance', [
				{ ...createRuntimeNavigationParticipant(), focusEligible: false },
			] ),
			completedWaitId: 'wait-completed',
		} );
	} );

	it( 'reconciles an exact active navigation observation through the Ready reducer event', () => {
		const parsedState = createParsedStoredState(
			{
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredDurableState( {
					'scope-allowance': createStoredDurableScope( 'allowance-a' ),
				} ),
			},
			{
				status: StoredProtectionStateParseStatus.CURRENT,
				state: createStoredSessionState( {
					'scope-allowance': createStoredReadyScope( 'allowance-a', [
						createStoredNavigationParticipant(),
					] ),
				} ),
			},
		);

		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ createReadyObservation() ],
		) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-allowance': createAllowanceState( 'scope-allowance', [
					{ ...createRuntimeNavigationParticipant(), focusEligible: false },
				] ),
			},
			decisions: [
				{
					type: ProtectionDecisionType.PRESENT_READY,
					participantId: 'participant-a',
					pageId: 'page-a',
					allowanceId: 'allowance-a',
				},
			],
			facts: [],
			requirements: [],
		} );
	} );

	it.each( [
		{
			label: 'removed rule',
			match: { status: ProtectedUrlMatchStatus.UNPROTECTED },
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			label: 'moved scope',
			match: createProtectedMatch( 'scope-moved' ),
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			label: 'unsupported destination',
			match: {
				status: ProtectedUrlMatchStatus.UNSUPPORTED,
				reason: ProtectedUrlUnsupportedReason.UNSUPPORTED_SCHEME,
			},
			schedule: { status: ScheduleEvaluationStatus.ACTIVE },
		},
		{
			label: 'inactive schedule',
			match: createProtectedMatch(),
			schedule: { status: ScheduleEvaluationStatus.INACTIVE },
		},
		{
			label: 'schedule error',
			match: createProtectedMatch(),
			schedule: {
				status: ScheduleEvaluationStatus.ERROR,
				reason: ScheduleEvaluationFailureReason.INVALID_TIME_ZONE,
			},
		},
	] )( 'fails open navigation Ready for $label through reducer rules', ( { match, schedule } ) => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', [
				createStoredNavigationParticipant(),
			] ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const observation = createReadyObservation(
			createFreshObservation(
				'participant-a',
				'page-a',
				'https://example.com/a',
				match,
				schedule,
			),
		);

		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ observation ],
		) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RESTORED,
			statesByScope: {
				'scope-allowance': createAllowanceState( 'scope-allowance', [] ),
			},
			decisions: [
				{
					type: ProtectionDecisionType.RELEASE_NAVIGATION,
					participantId: 'participant-a',
					pageId: 'page-a',
					retainedDestination: 'https://example.com/a',
				},
			],
			facts: [],
			requirements: [],
		} );
	} );

	it( 'reconciles an expiry-origin participant with null destination and dismisses it when removed', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', [
				createStoredExpiryParticipant( 'participant-b', 'page-b', 0 ),
			] ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const activeObservation = createReadyObservation(
			createFreshObservation( 'participant-b', 'page-b', null ),
		);
		const removedObservation = createReadyObservation(
			createFreshObservation(
				'participant-b',
				'page-b',
				null,
				{ status: ProtectedUrlMatchStatus.UNPROTECTED },
			),
		);

		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ activeObservation ],
		) ).decisions ).toEqual( [
			{
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-b',
				pageId: 'page-b',
				allowanceId: 'allowance-a',
			},
		] );
		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ removedObservation ],
		) ).decisions ).toEqual( [
			{
				type: ProtectionDecisionType.DISMISS_INTERRUPTION,
				participantId: 'participant-b',
				pageId: 'page-b',
			},
		] );
	} );

	it.each( [
		{
			label: 'missing observation',
			participant: createStoredNavigationParticipant(),
			observations: [],
			reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
		},
		{
			label: 'changed observed destination',
			participant: createStoredNavigationParticipant(),
			observations: [ createReadyObservation(
				createFreshObservation( 'participant-a', 'page-a', 'https://example.com/changed' ),
			) ],
			reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_REJECTED,
		},
		{
			label: 'wrong wrapper scope',
			participant: createStoredNavigationParticipant(),
			observations: [ createReadyObservation( createFreshObservation(), 'scope-wrong' ) ],
			reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
		},
		{
			label: 'wrong wrapper allowance',
			participant: createStoredNavigationParticipant(),
			observations: [ createReadyObservation( createFreshObservation(), 'scope-allowance', 'allowance-wrong' ) ],
			reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
		},
		{
			label: 'wrong participant identity',
			participant: createStoredNavigationParticipant(),
			observations: [ createReadyObservation(
				createFreshObservation( 'participant-wrong', 'page-a' ),
			) ],
			reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
		},
		{
			label: 'wrong page identity',
			participant: createStoredNavigationParticipant(),
			observations: [ createReadyObservation(
				createFreshObservation( 'participant-a', 'page-wrong' ),
			) ],
			reason: ProtectionStateReconciliationRequirementReason.OBSERVATION_UNAVAILABLE,
		},
	] )( 'retains Ready and returns a typed requirement for $label', ( { participant, observations, reason } ) => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', [ participant ] ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);

		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			observations,
		) ) ).toEqual( {
			status: ProtectionStateRestoreStatus.RECONCILIATION_REQUIRED,
			statesByScope: {
				'scope-allowance': createAllowanceState( 'scope-allowance', [ {
					...participant,
					origin: ProtectionParticipantOrigin.NAVIGATION,
					focusEligible: false,
					statisticsEligible: false,
				} ] ),
			},
			decisions: [],
			facts: [],
			requirements: [
				{
					scopeId: 'scope-allowance',
					allowanceId: 'allowance-a',
					participantId: 'participant-a',
					pageId: 'page-a',
					reason,
				},
			],
		} );
	} );

	it( 'ignores extra observations for no-longer-stored participants', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', [
				createStoredNavigationParticipant(),
			] ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const extra = createReadyObservation(
			createFreshObservation( 'participant-extra', 'page-extra', 'https://example.com/extra' ),
		);

		expect( restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ extra, createReadyObservation() ],
		) ).decisions ).toEqual( [
			{
				type: ProtectionDecisionType.PRESENT_READY,
				participantId: 'participant-a',
				pageId: 'page-a',
				allowanceId: 'allowance-a',
			},
		] );
	} );

	it( 'rejects duplicate Ready observation identities even when destinations differ', () => {
		const parsedState = createParsedStoredState();
		const observation = createReadyObservation();
		const changedDestination = createReadyObservation( createFreshObservation(
			'participant-a',
			'page-a',
			'https://example.com/changed',
		) );

		expect( () => restoreProtectionState( createContinuedRestoreInput(
			parsedState,
			[ observation, changedDestination ],
		) ) ).toThrow( ZodError );
	} );

	it.each( [ ALLOWANCE_EXPIRY, ALLOWANCE_EXPIRY + 1 ] )(
		'preserves pending Ready without reconciliation decisions at or after expiry %s',
		( nowEpochMilliseconds ) => {
			const durable = createStoredDurableState( {
				'scope-allowance': createStoredDurableScope( 'allowance-a' ),
			} );
			const session = createStoredSessionState( {
				'scope-allowance': createStoredReadyScope( 'allowance-a', [
					createStoredNavigationParticipant(),
				] ),
			} );
			const parsedState = createParsedStoredState(
				{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
				{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
			);

			expect( restoreProtectionState( createContinuedRestoreInput(
				parsedState,
				[ createReadyObservation() ],
				nowEpochMilliseconds,
			) ) ).toEqual( {
				status: ProtectionStateRestoreStatus.RESTORED,
				statesByScope: {
					'scope-allowance': createAllowanceState( 'scope-allowance', [
						{ ...createRuntimeNavigationParticipant(), focusEligible: false },
					] ),
				},
				decisions: [],
				facts: [],
				requirements: [],
			} );
		},
	);

	it( 'processes Ready participants by join sequence then identity for deterministic output', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const participants = [
			createStoredNavigationParticipant( 'participant-z', 'page-z', 'https://example.com/z', 2 ),
			createStoredNavigationParticipant( 'participant-b', 'page-b', 'https://example.com/b', 0 ),
			createStoredNavigationParticipant( 'participant-a', 'page-a', 'https://example.com/a', 0 ),
		];
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', participants ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const observations = participants.map( ( participant ) => createReadyObservation(
			createFreshObservation(
				participant.participantId,
				participant.pageId,
				participant.retainedDestination,
			),
		) );

		const result = restoreProtectionState( createContinuedRestoreInput( parsedState, observations ) );

		expect( result.decisions.map( ( decision ) =>
			decision.type === ProtectionDecisionType.PRESENT_READY
				? decision.participantId
				: decision.type,
		) ).toEqual( [
			'participant-a',
			'participant-b',
			'participant-z',
		] );
		const restoredAllowance = result.statesByScope[ 'scope-allowance' ];
		const readyParticipantIds = restoredAllowance?.type === ProtectionStateType.ALLOWANCE
			? restoredAllowance.readyParticipants.map( ( participant ) => participant.participantId )
			: [];

		expect( readyParticipantIds ).toEqual( [ 'participant-a', 'participant-b', 'participant-z' ] );
	} );

	it( 'returns replay-deterministic restoration with structurally zero facts', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', [
				createStoredNavigationParticipant(),
			] ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const input = createContinuedRestoreInput( parsedState, [ createReadyObservation() ] );

		const first = restoreProtectionState( input );
		const second = restoreProtectionState( input );

		expect( second ).toEqual( first );
		expect( first.facts ).toEqual( [] );
		expect( Object.keys( first.facts ) ).toEqual( [] );
	} );

	it( 'does not mutate deeply frozen parsed state or observations', () => {
		const durable = createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
		} );
		const session = createStoredSessionState( {
			'scope-allowance': createStoredReadyScope( 'allowance-a', [
				createStoredNavigationParticipant(),
			] ),
		} );
		const parsedState = createParsedStoredState(
			{ status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			{ status: StoredProtectionStateParseStatus.CURRENT, state: session },
		);
		const input = freezeDeeply(
			createContinuedRestoreInput( parsedState, [ createReadyObservation() ] ),
		);

		expect( () => restoreProtectionState( input ) ).not.toThrow();
	} );
} );
