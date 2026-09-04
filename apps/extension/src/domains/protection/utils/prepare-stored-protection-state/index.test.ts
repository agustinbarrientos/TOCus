import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import {
	ProtectionStateType,
} from '../../types/protection-state';
import { ProtectionParticipantOrigin } from '../../types/protection-participant';
import {
	StoredProtectionParticipantOrigin,
} from '../../types/stored-protection-participant';
import {
	StoredProtectionStatisticsDeliveryStatus,
} from '../../types/stored-protection-statistics-delivery';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredProtectionScopeStateType,
} from '../../types/stored-protection-state';
import { prepareStoredProtectionState } from './index';

/**
 * Fixed initial instant used by stored-state fixtures.
 * @since 0.1.0 Initial implementation.
 */
const FIRST_INSTANT = 1_800_000_000_000;

/**
 * Fixed allowance expiry used by stored-state fixtures.
 * @since 0.1.0 Initial implementation.
 */
const ALLOWANCE_EXPIRY = FIRST_INSTANT + 300_000;

/**
 * Complete empty statistics delivery used by stored-state preparation tests.
 * @since 0.1.0 Initial implementation.
 */
const COMPLETE_STATISTICS_DELIVERY = {
	status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
	outbox: [],
};

/**
 * Recursively freezes a test value so mutation attempts fail.
 * @param value - Value to freeze.
 * @return Deeply frozen value.
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
 * Creates a daily ladder test value.
 * @param completedWaits - Completed waits on the greatest observed date.
 * @param greatestObservedLocalDate - Greatest observed local date.
 * @return Daily ladder test value.
 * @since 0.1.0 Initial implementation.
 */
function createLadder( completedWaits = 2, greatestObservedLocalDate = '2026-08-31' ) {
	return { completedWaits, greatestObservedLocalDate };
}

/**
 * Creates a runtime navigation participant test value.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param retainedDestination - Retained HTTP(S) destination.
 * @param focusEligible - Whether the participant can own progress.
 * @param joinSequence - Stable join sequence.
 * @return Runtime navigation participant test value.
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
		statisticsEligible: true,
		joinSequence,
	};
}

/**
 * Creates a runtime allowance-expiry participant test value.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param focusEligible - Whether the participant can own progress.
 * @param joinSequence - Stable join sequence.
 * @return Runtime allowance-expiry participant test value.
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
		statisticsEligible: true,
		joinSequence,
	};
}

/**
 * Creates an Idle runtime state test value.
 * @param scopeId - Scope identifier.
 * @return Idle runtime state test value.
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
 * Creates a Waiting runtime state test value.
 * @param scopeId - Scope identifier.
 * @return Waiting runtime state test value.
 * @since 0.1.0 Initial implementation.
 */
function createWaitingState( scopeId = 'scope-waiting' ) {
	return {
		type: ProtectionStateType.WAITING,
		scopeId,
		waitId: 'wait-a',
		capturedWaitDurationMilliseconds: 15_000,
		confirmedFocusedDurationMilliseconds: 4_000,
		participants: [
			createRuntimeNavigationParticipant(),
			createRuntimeExpiryParticipant(),
		],
		ownerParticipantId: 'participant-a',
		ownerEpoch: 3,
		checkpointHighWaterMilliseconds: 4_000,
		completionStatisticsEligible: true,
		ladder: createLadder(),
	};
}

/**
 * Creates an Allowance runtime state test value.
 * @param scopeId - Scope identifier.
 * @param readyParticipants - Ready participant collection.
 * @return Allowance runtime state test value.
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
 * Creates a stored navigation participant test value.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param retainedDestination - Retained HTTP(S) destination.
 * @param joinSequence - Stable join sequence.
 * @return Stored navigation participant test value.
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
		statisticsEligible: true,
		joinSequence,
	};
}

/**
 * Creates a stored allowance-expiry participant test value.
 * @param participantId - Participant identifier.
 * @param pageId - Page identifier.
 * @param joinSequence - Stable join sequence.
 * @return Stored allowance-expiry participant test value.
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
		statisticsEligible: true,
		joinSequence,
	};
}

/**
 * Creates current durable stored protection state.
 * @param scopes - Durable scopes.
 * @return Current durable stored protection state.
 * @since 0.1.0 Initial implementation.
 */
function createStoredDurableState<Scopes extends object>( scopes: Scopes ) {
	return {
		schemaVersion: DurableStoredProtectionStateVersion,
		statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		scopes,
	};
}

/**
 * Creates current session stored protection state.
 * @param scopes - Session scopes.
 * @param sessionContinuityId - Stored continuity identifier.
 * @return Current session stored protection state.
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
 * Creates a stored Waiting scope test value.
 * @return Stored Waiting scope test value.
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
		completionStatisticsEligible: true,
	};
}

/**
 * Creates a stored Ready scope test value.
 * @return Stored Ready scope test value.
 * @since 0.1.0 Initial implementation.
 */
function createStoredReadyScope() {
	return {
		type: StoredProtectionScopeStateType.READY,
		allowanceId: 'allowance-a',
		completedWaitId: 'wait-a',
		participants: [
			createStoredNavigationParticipant(),
			createStoredExpiryParticipant(),
		],
	};
}

/**
 * Creates a durable stored scope test value.
 * @param allowanceId - Optional allowance identifier.
 * @return Durable stored scope test value.
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

describe( 'prepareStoredProtectionState', () => {
	it( 'prepares empty current durable and session state from an empty runtime map', () => {
		expect( prepareStoredProtectionState( {
			statesByScope: {},
			sessionContinuityId: 'session-empty',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} ) ).toEqual( {
			durable: createStoredDurableState( {} ),
			session: createStoredSessionState( {}, 'session-empty' ),
		} );
	} );

	it( 'prepares Idle, Waiting, Allowance with Ready, and Allowance without Ready across lexical scopes', () => {
		const input = {
			statesByScope: {
				'scope-waiting': createWaitingState(),
				'scope-idle': createIdleState(),
				'scope-empty-ready': createAllowanceState( 'scope-empty-ready', [] ),
				'scope-allowance': createAllowanceState(),
			},
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		};

		const result = prepareStoredProtectionState( input );

		expect( Object.keys( result.durable.scopes ) ).toEqual( [
			'scope-allowance',
			'scope-empty-ready',
			'scope-idle',
			'scope-waiting',
		] );
		expect( result.durable ).toEqual( createStoredDurableState( {
			'scope-allowance': createStoredDurableScope( 'allowance-a' ),
			'scope-empty-ready': createStoredDurableScope( 'allowance-a' ),
			'scope-idle': createStoredDurableScope(),
			'scope-waiting': createStoredDurableScope(),
		} ) );
		expect( result.session ).toEqual( createStoredSessionState( {
			'scope-allowance': createStoredReadyScope(),
			'scope-waiting': createStoredWaitingScope(),
		} ) );
	} );

	it( 'retains completed-wait provenance only in Ready session state', () => {
		const allowance = {
			...createAllowanceState(),
			completedWaitId: 'wait-completed',
		};

		const result = prepareStoredProtectionState( {
			statesByScope: { 'scope-allowance': allowance },
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} );

		const incompleteDelivery = {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: [],
		};
		const preservedDelivery = prepareStoredProtectionState( {
			statesByScope: { 'scope-allowance': allowance },
			sessionContinuityId: 'session-current',
			statisticsDelivery: incompleteDelivery,
		} ).durable.statisticsDelivery;

		expect( result.durable.scopes[ 'scope-allowance' ] ).toEqual(
			createStoredDurableScope( 'allowance-a' ),
		);
		expect( preservedDelivery ).toEqual( incompleteDelivery );
		expect( result.session.scopes[ 'scope-allowance' ] ).toEqual( {
			...createStoredReadyScope(),
			completedWaitId: 'wait-completed',
		} );
	} );

	it.each( [
		{ label: 'shorter than one minute', intervalMilliseconds: 59_999 },
		{ label: 'off the whole-minute grid', intervalMilliseconds: 60_001 },
		{ label: 'longer than sixty minutes', intervalMilliseconds: 3_600_001 },
	] )( 'rejects an allowance interval $label', ( { intervalMilliseconds } ) => {
		const state = createAllowanceState();
		state.expiresAtEpochMilliseconds = state.startedAtEpochMilliseconds + intervalMilliseconds;

		expect( () => prepareStoredProtectionState( {
			statesByScope: { 'scope-allowance': state },
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} ) ).toThrow( ZodError );
	} );

	it( 'orders stored participants by join sequence and lexical participant identity', () => {
		const waiting = createWaitingState();
		waiting.participants = [
			createRuntimeExpiryParticipant( 'participant-z', 'page-z', false, 2 ),
			createRuntimeNavigationParticipant( 'participant-b', 'page-b', 'https://example.com/b', true, 0 ),
			createRuntimeNavigationParticipant( 'participant-a', 'page-a', 'https://example.com/a', false, 0 ),
		];
		waiting.ownerParticipantId = 'participant-b';

		const result = prepareStoredProtectionState( {
			statesByScope: { 'scope-waiting': waiting },
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} );

		expect( result.session.scopes[ 'scope-waiting' ]?.participants.map(
			( participant ) => participant.participantId,
		) ).toEqual( [ 'participant-a', 'participant-b', 'participant-z' ] );
	} );

	it( 'rejects a state-map key that differs from the contained runtime scope identifier', () => {
		expect( () => prepareStoredProtectionState( {
			statesByScope: { 'scope-wrong': createIdleState() },
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} ) ).toThrow( ZodError );
	} );

	it.each( [ null, undefined, {}, [], { statesByScope: {}, sessionContinuityId: 'bad value' } ] )(
		'rejects malformed preparation input %#',
		( input ) => {
			expect( () => prepareStoredProtectionState( input ) ).toThrow( ZodError );
		},
	);

	it.each( [
		{ label: 'Date', statesByScope: new Date( 0 ) },
		{ label: 'Map', statesByScope: new Map( [ [ 'scope-idle', createIdleState() ] ] ) },
		{ label: 'RegExp', statesByScope: /scope-idle/ },
	] )( 'rejects a $label instance as a runtime-state record', ( { statesByScope } ) => {
		expect( () => prepareStoredProtectionState( {
			statesByScope,
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} ) ).toThrow( ZodError );
	} );

	it( 'accepts a null-prototype runtime-state record', () => {
		const statesByScope = {
			'scope-idle': createIdleState(),
		};
		Reflect.setPrototypeOf( statesByScope, null );

		expect( prepareStoredProtectionState( {
			statesByScope,
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} ).durable.scopes ).toEqual( {
			'scope-idle': createStoredDurableScope(),
		} );
	} );

	it( 'retains no volatile or participant state in the durable value', () => {
		const storedState = prepareStoredProtectionState( {
			statesByScope: {
				'scope-waiting': createWaitingState(),
				'scope-allowance': createAllowanceState(),
			},
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} );
		const durableText = JSON.stringify( storedState.durable );
		const forbiddenKeys = [
			'waitId',
			'capturedWaitDurationMilliseconds',
			'confirmedFocusedDurationMilliseconds',
			'participants',
			'readyParticipants',
			'completedWaitId',
			'sessionContinuityId',
			'focusEligible',
			'ownerParticipantId',
			'ownerEpoch',
			'retainedDestination',
			'checkpointHighWaterMilliseconds',
		];

		for ( const forbiddenKey of forbiddenKeys ) {
			expect( durableText ).not.toContain( `"${ forbiddenKey }"` );
		}
	} );

	it( 'does not mutate deeply frozen runtime state', () => {
		const input = freezeDeeply( {
			statesByScope: {
				'scope-waiting': createWaitingState(),
				'scope-allowance': createAllowanceState(),
			},
			sessionContinuityId: 'session-current',
			statisticsDelivery: COMPLETE_STATISTICS_DELIVERY,
		} );

		expect( () => prepareStoredProtectionState( input ) ).not.toThrow();
	} );
} );
