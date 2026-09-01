import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import {
	StoredProtectionParticipantOrigin,
} from '../../types/stored-protection-participant';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredProtectionScopeStateType,
} from '../../types/stored-protection-state';
import {
	parseStoredProtectionState,
	StoredProtectionStateFailureReason,
	StoredProtectionStateParseStatus,
} from './index';

const FIRST_INSTANT = 1_800_000_000_000;
const ALLOWANCE_EXPIRY = FIRST_INSTANT + 300_000;

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
 * @return Daily ladder test value.
 * @since 0.1.0 Initial implementation.
 */
function createLadder() {
	return {
		completedWaits: 2,
		greatestObservedLocalDate: '2026-08-31',
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
	};
}

/**
 * Creates a stored Ready scope test value.
 * @param allowanceId - Matching allowance identifier.
 * @param participants - Stored Ready participants.
 * @return Stored Ready scope test value.
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

describe( 'parseStoredProtectionState', () => {
	it( 'keeps both absent stored values explicitly absent', () => {
		expect( parseStoredProtectionState( {} ) ).toEqual( {
			durable: { status: StoredProtectionStateParseStatus.ABSENT },
			session: { status: StoredProtectionStateParseStatus.ABSENT },
		} );
		expect( parseStoredProtectionState( { durable: undefined, session: undefined } ) ).toEqual( {
			durable: { status: StoredProtectionStateParseStatus.ABSENT },
			session: { status: StoredProtectionStateParseStatus.ABSENT },
		} );
	} );

	it( 'parses current durable and session state independently', () => {
		const durable = createStoredDurableState( { 'scope-idle': createStoredDurableScope() } );
		const session = createStoredSessionState( { 'scope-waiting': createStoredWaitingScope() } );

		expect( parseStoredProtectionState( { durable, session } ) ).toEqual( {
			durable: { status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			session: { status: StoredProtectionStateParseStatus.CURRENT, state: session },
		} );
	} );

	it.each( [ 0, 2, 999 ] )(
		'categorizes durable version %s as unsupported before stored-state validation',
		( schemaVersion ) => {
			expect( parseStoredProtectionState( {
				durable: { schemaVersion, malformed: true },
			} ).durable ).toEqual( {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.UNSUPPORTED_VERSION,
			} );
		},
	);

	it.each( [ 0, 2, 999 ] )(
		'categorizes session version %s as unsupported before stored-state validation',
		( schemaVersion ) => {
			expect( parseStoredProtectionState( {
				session: { schemaVersion, malformed: true },
			} ).session ).toEqual( {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.UNSUPPORTED_VERSION,
			} );
		},
	);

	it.each( [
		{ label: 'missing version', value: { scopes: {} } },
		{ label: 'negative version', value: { schemaVersion: -1, scopes: {} } },
		{ label: 'fractional version', value: { schemaVersion: 1.5, scopes: {} } },
		{ label: 'string version', value: { schemaVersion: '1', scopes: {} } },
		{ label: 'null', value: null },
		{ label: 'array', value: [] },
		{ label: 'primitive', value: 'stored-state' },
	] )( 'categorizes durable state with $label as invalid', ( { value } ) => {
		expect( parseStoredProtectionState( { durable: value } ).durable ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [
		{ label: 'missing version', value: { sessionContinuityId: 'session-current', scopes: {} } },
		{ label: 'negative version', value: { schemaVersion: -1, scopes: {} } },
		{ label: 'fractional version', value: { schemaVersion: 1.5, scopes: {} } },
		{ label: 'boolean version', value: { schemaVersion: true, scopes: {} } },
		{ label: 'null', value: null },
		{ label: 'array', value: [] },
		{ label: 'primitive', value: 1 },
	] )( 'categorizes session state with $label as invalid', ( { value } ) => {
		expect( parseStoredProtectionState( { session: value } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [
		{ label: 'Date', scopes: new Date( 0 ) },
		{ label: 'Map', scopes: new Map( [ [ 'scope-idle', createStoredDurableScope() ] ] ) },
		{ label: 'RegExp', scopes: /scope-idle/ },
	] )( 'categorizes $label scope containers as invalid stored state', ( { scopes } ) => {
		const result = parseStoredProtectionState( {
			durable: createStoredDurableState( scopes ),
			session: createStoredSessionState( scopes ),
		} );

		expect( result.durable ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
		expect( result.session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it( 'accepts null-prototype durable and session scope records', () => {
		const durableScopes = {
			'scope-idle': createStoredDurableScope(),
		};
		const sessionScopes = {
			'scope-waiting': createStoredWaitingScope(),
		};
		Reflect.setPrototypeOf( durableScopes, null );
		Reflect.setPrototypeOf( sessionScopes, null );
		const durable = createStoredDurableState( durableScopes );
		const session = createStoredSessionState( sessionScopes );

		expect( parseStoredProtectionState( { durable, session } ) ).toEqual( {
			durable: { status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			session: { status: StoredProtectionStateParseStatus.CURRENT, state: session },
		} );
	} );

	it( 'isolates corrupt durable state from valid session state', () => {
		const session = createStoredSessionState( { 'scope-waiting': createStoredWaitingScope() } );

		expect( parseStoredProtectionState( {
			durable: createStoredDurableState( { 'scope-idle': { ladder: null } } ),
			session,
		} ) ).toEqual( {
			durable: {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
			},
			session: { status: StoredProtectionStateParseStatus.CURRENT, state: session },
		} );
	} );

	it( 'isolates corrupt session state from valid durable state', () => {
		const durable = createStoredDurableState( { 'scope-idle': createStoredDurableScope() } );

		expect( parseStoredProtectionState( {
			durable,
			session: createStoredSessionState( { 'scope-waiting': { type: 'unknown' } } ),
		} ) ).toEqual( {
			durable: { status: StoredProtectionStateParseStatus.CURRENT, state: durable },
			session: {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
			},
		} );
	} );

	it.each( [
		{ label: 'allowance expiry equal to start', intervalMilliseconds: 0 },
		{ label: 'allowance expiry before start', intervalMilliseconds: -1 },
		{ label: 'allowance shorter than one minute', intervalMilliseconds: 59_999 },
		{ label: 'allowance off the whole-minute grid', intervalMilliseconds: 60_001 },
		{ label: 'allowance longer than sixty minutes', intervalMilliseconds: 3_600_001 },
	] )( 'rejects durable state with $label', ( { intervalMilliseconds } ) => {
		const durable = createStoredDurableState( {
			'scope-allowance': {
				...createStoredDurableScope( 'allowance-a' ),
				allowance: {
					allowanceId: 'allowance-a',
					startedAtEpochMilliseconds: FIRST_INSTANT,
					expiresAtEpochMilliseconds: FIRST_INSTANT + intervalMilliseconds,
				},
			},
		} );

		expect( parseStoredProtectionState( { durable } ).durable ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [
		{ label: 'completed progress', change: { confirmedFocusedDurationMilliseconds: 15_000 } },
		{ label: 'progress beyond captured duration', change: { confirmedFocusedDurationMilliseconds: 15_001 } },
		{ label: 'owner outside participants', change: { ownerParticipantId: 'participant-missing' } },
		{ label: 'nonzero ownerless checkpoint', change: { ownerParticipantId: null, checkpointHighWaterMilliseconds: 1 } },
		{ label: 'checkpoint above confirmed progress', change: { checkpointHighWaterMilliseconds: 4_001 } },
		{ label: 'owner at epoch zero', change: { ownerEpoch: 0 } },
	] )( 'rejects stored Waiting with $label', ( { change } ) => {
		const session = createStoredSessionState( {
			'scope-waiting': { ...createStoredWaitingScope(), ...change },
		} );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [ 0, 1 ] )( 'rejects ownerless epoch %s with confirmed progress', ( ownerEpoch ) => {
		const session = createStoredSessionState( {
			'scope-waiting': {
				...createStoredWaitingScope(),
				ownerParticipantId: null,
				ownerEpoch,
				checkpointHighWaterMilliseconds: 0,
			},
		} );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it( 'accepts an ownerless epoch-one wait only when confirmed progress and high-water are zero', () => {
		const storedWaiting = {
			...createStoredWaitingScope(),
			confirmedFocusedDurationMilliseconds: 0,
			ownerParticipantId: null,
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 0,
		};
		const session = createStoredSessionState( { 'scope-waiting': storedWaiting } );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.CURRENT,
			state: session,
		} );
	} );

	it( 'accepts a stale stored owner that is present without reselecting ownership', () => {
		const storedWaiting = {
			...createStoredWaitingScope(),
			ownerParticipantId: 'participant-b',
		};
		const session = createStoredSessionState( { 'scope-waiting': storedWaiting } );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.CURRENT,
			state: session,
		} );
	} );

	it.each( [
		{
			label: 'duplicate participant identifiers',
			participant: createStoredExpiryParticipant( 'participant-a', 'page-b' ),
		},
		{
			label: 'duplicate page identifiers',
			participant: createStoredExpiryParticipant( 'participant-b', 'page-a' ),
		},
	] )( 'rejects stored Waiting with $label', ( { participant } ) => {
		const session = createStoredSessionState( {
			'scope-waiting': {
				...createStoredWaitingScope(),
				participants: [ createStoredNavigationParticipant(), participant ],
			},
		} );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [
		{
			label: 'duplicate Ready participant identifiers',
			participants: [
				createStoredNavigationParticipant(),
				createStoredExpiryParticipant( 'participant-a', 'page-b' ),
			],
		},
		{
			label: 'duplicate Ready page identifiers',
			participants: [
				createStoredNavigationParticipant(),
				createStoredExpiryParticipant( 'participant-b', 'page-a' ),
			],
		},
	] )( 'rejects $label', ( { participants } ) => {
		const session = createStoredSessionState( {
			'scope-ready': createStoredReadyScope( 'allowance-a', participants ),
		} );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [
		{
			label: 'missing navigation destination',
			participant: {
				...createStoredNavigationParticipant(),
				retainedDestination: null,
			},
		},
		{
			label: 'non-HTTP navigation destination',
			participant: createStoredNavigationParticipant( 'participant-a', 'page-a', 'file:///tmp/a' ),
		},
		{
			label: 'non-null expiry destination',
			participant: {
				...createStoredExpiryParticipant(),
				retainedDestination: 'https://example.com/b',
			},
		},
	] )( 'rejects a stored participant with $label', ( { participant } ) => {
		const session = createStoredSessionState( {
			'scope-ready': createStoredReadyScope( 'allowance-a', [ participant ] ),
		} );

		expect( parseStoredProtectionState( { session } ).session ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it.each( [
		{
			label: 'durable stored state',
			input: { durable: { ...createStoredDurableState( {} ), extra: true } },
			key: 'durable',
		},
		{
			label: 'durable scope',
			input: {
				durable: createStoredDurableState( {
					'scope-idle': { ...createStoredDurableScope(), extra: true },
				} ),
			},
			key: 'durable',
		},
		{
			label: 'session stored state',
			input: { session: { ...createStoredSessionState(), extra: true } },
			key: 'session',
		},
		{
			label: 'session scope',
			input: {
				session: createStoredSessionState( {
					'scope-waiting': { ...createStoredWaitingScope(), extra: true },
				} ),
			},
			key: 'session',
		},
		{
			label: 'stored participant',
			input: {
				session: createStoredSessionState( {
					'scope-ready': createStoredReadyScope( 'allowance-a', [ {
						...createStoredNavigationParticipant(),
						extra: true,
					} ] ),
				} ),
			},
			key: 'session',
		},
	] )( 'rejects unknown keys in every strict $label', ( { input, key } ) => {
		const result = parseStoredProtectionState( input );
		const parsedState = key === 'durable' ? result.durable : result.session;

		expect( parsedState ).toEqual( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	} );

	it( 'does not expose raw invalid stored state or validation errors', () => {
		const raw = { schemaVersion: 1, secret: 'do-not-expose' };
		const result = parseStoredProtectionState( { durable: raw, session: raw } );

		expect( JSON.stringify( result ) ).not.toContain( 'do-not-expose' );
		expect( JSON.stringify( result ) ).not.toContain( 'issues' );
	} );

	it( 'rejects unknown parse-wrapper keys at the public boundary', () => {
		expect( () => parseStoredProtectionState( { durable: undefined, extra: true } ) ).toThrow( ZodError );
	} );

	it( 'does not mutate deeply frozen stored state', () => {
		const input = freezeDeeply( {
			durable: createStoredDurableState( { 'scope-allowance': createStoredDurableScope( 'allowance-a' ) } ),
			session: createStoredSessionState( { 'scope-ready': createStoredReadyScope() } ),
		} );

		expect( () => parseStoredProtectionState( input ) ).not.toThrow();
	} );

	it( 'clones parsed state instead of aliasing caller-owned values', () => {
		const durable = createStoredDurableState( { 'scope-idle': createStoredDurableScope() } );
		const result = parseStoredProtectionState( { durable } );

		expect( result.durable ).toMatchObject( { status: StoredProtectionStateParseStatus.CURRENT } );
		if ( result.durable.status === StoredProtectionStateParseStatus.CURRENT ) {
			expect( result.durable.state ).not.toBe( durable );
			expect( result.durable.state.scopes[ 'scope-idle' ] ).not.toBe(
				durable.scopes[ 'scope-idle' ],
			);
		}
	} );
} );
