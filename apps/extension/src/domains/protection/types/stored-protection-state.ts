import { z } from 'zod';
import { AllowanceDurationMillisecondsSchema } from './allowance-duration';
import {
	AllowanceIdSchema,
	DurationMillisecondsSchema,
	EpochMillisecondsSchema,
	OwnerEpochSchema,
	ParticipantIdSchema,
	ProtectionScopeIdSchema,
	SessionContinuityIdSchema,
	WaitIdSchema,
} from './protection-value';
import { DailyLadderSchema } from './daily-ladder';
import {
	StoredProtectionParticipantsSchema,
} from './stored-protection-participant';
import { StoredProtectionStatisticsDeliverySchema } from './stored-protection-statistics-delivery';
import { WaitDurationMillisecondsSchema } from './wait-duration';

/**
 * Current version of durable stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const DurableStoredProtectionStateVersion = 2;

/**
 * Current version of session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const SessionStoredProtectionStateVersion = 1;

/**
 * Session scope-state variants retained in stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionScopeStateType = {
	WAITING: 'waiting',
	READY: 'ready',
} as const;

/**
 * Validates a session scope-state variant retained in stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionScopeStateTypeSchema = z.enum( StoredProtectionScopeStateType );

/**
 * Session scope-state variant retained in stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionScopeStateType = z.infer<typeof StoredProtectionScopeStateTypeSchema>;

/**
 * Validates a stored allowance interval.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionAllowanceSchema = z.object( {
	allowanceId: AllowanceIdSchema,
	startedAtEpochMilliseconds: EpochMillisecondsSchema,
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict().superRefine( ( allowance, context ) => {
	const allowanceDurationMilliseconds =
		allowance.expiresAtEpochMilliseconds - allowance.startedAtEpochMilliseconds;

	if ( ! AllowanceDurationMillisecondsSchema.safeParse( allowanceDurationMilliseconds ).success ) {
		context.addIssue( {
			code: 'custom',
			message: 'Stored allowance interval must span one through sixty whole minutes.',
			path: [ 'expiresAtEpochMilliseconds' ],
		} );
	}
} );

/**
 * Stored allowance interval.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionAllowance = z.infer<typeof StoredProtectionAllowanceSchema>;

/**
 * Validates durable state retained for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const StoredDurableProtectionScopeStateSchema = z.object( {
	ladder: DailyLadderSchema,
	allowance: StoredProtectionAllowanceSchema.optional(),
} ).strict();

/**
 * Durable state retained for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type StoredDurableProtectionScopeState = z.infer<typeof StoredDurableProtectionScopeStateSchema>;

/**
 * Validates an incomplete Waiting state retained for a continuous session.
 * @since 0.1.0 Initial implementation.
 */
export const StoredWaitingProtectionScopeStateSchema = z.object( {
	type: z.enum( [ StoredProtectionScopeStateType.WAITING ] ),
	waitId: WaitIdSchema,
	capturedWaitDurationMilliseconds: WaitDurationMillisecondsSchema,
	confirmedFocusedDurationMilliseconds: DurationMillisecondsSchema,
	participants: StoredProtectionParticipantsSchema,
	ownerParticipantId: z.union( [ ParticipantIdSchema, z.null() ] ),
	ownerEpoch: OwnerEpochSchema,
	checkpointHighWaterMilliseconds: DurationMillisecondsSchema,
	completionStatisticsEligible: z.boolean().default( false ),
} ).strict().superRefine( ( state, context ) => {
	if ( state.confirmedFocusedDurationMilliseconds >= state.capturedWaitDurationMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Stored Waiting progress must remain below the captured duration.',
			path: [ 'confirmedFocusedDurationMilliseconds' ],
		} );
	}

	if ( state.checkpointHighWaterMilliseconds > state.confirmedFocusedDurationMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Stored checkpoint high-water cannot exceed confirmed progress.',
			path: [ 'checkpointHighWaterMilliseconds' ],
		} );
	}

	if (
		state.ownerParticipantId !== null &&
		! state.participants.some( ( participant ) => participant.participantId === state.ownerParticipantId )
	) {
		context.addIssue( {
			code: 'custom',
			message: 'A stored Waiting owner must identify a stored participant.',
			path: [ 'ownerParticipantId' ],
		} );
	}

	if ( state.ownerParticipantId !== null && state.ownerEpoch < 1 ) {
		context.addIssue( {
			code: 'custom',
			message: 'A stored Waiting owner requires a positive owner epoch.',
			path: [ 'ownerEpoch' ],
		} );
	}

	if ( state.ownerParticipantId === null && state.checkpointHighWaterMilliseconds !== 0 ) {
		context.addIssue( {
			code: 'custom',
			message: 'An ownerless stored Waiting state requires zero checkpoint high-water.',
			path: [ 'checkpointHighWaterMilliseconds' ],
		} );
	}

	if (
		state.ownerParticipantId === null &&
		state.ownerEpoch <= 1 &&
		state.confirmedFocusedDurationMilliseconds !== 0
	) {
		context.addIssue( {
			code: 'custom',
			message: 'An initially ownerless stored Waiting history cannot contain confirmed progress.',
			path: [ 'confirmedFocusedDurationMilliseconds' ],
		} );
	}
} );

/**
 * Incomplete Waiting state retained for a continuous session.
 * @since 0.1.0 Initial implementation.
 */
export type StoredWaitingProtectionScopeState = z.infer<typeof StoredWaitingProtectionScopeStateSchema>;

/**
 * Validates Ready participants retained for one durable allowance.
 * @since 0.1.0 Initial implementation.
 */
export const StoredReadyProtectionScopeStateSchema = z.object( {
	type: z.enum( [ StoredProtectionScopeStateType.READY ] ),
	allowanceId: AllowanceIdSchema,
	completedWaitId: WaitIdSchema,
	participants: StoredProtectionParticipantsSchema,
} ).strict();

/**
 * Ready participants retained for one durable allowance.
 * @since 0.1.0 Initial implementation.
 */
export type StoredReadyProtectionScopeState = z.infer<typeof StoredReadyProtectionScopeStateSchema>;

/**
 * Validates session state retained for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const StoredSessionProtectionScopeStateSchema = z.discriminatedUnion( 'type', [
	StoredWaitingProtectionScopeStateSchema,
	StoredReadyProtectionScopeStateSchema,
] );

/**
 * Session state retained for one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type StoredSessionProtectionScopeState = z.infer<typeof StoredSessionProtectionScopeStateSchema>;

/**
 * Validates the current durable stored-state version.
 * @since 0.1.0 Initial implementation.
 */
const DurableStoredProtectionStateVersionSchema = z.number().int().nonnegative().refine(
	( version ) => version === DurableStoredProtectionStateVersion,
);

/**
 * Validates the current session stored-state version.
 * @since 0.1.0 Initial implementation.
 */
const SessionStoredProtectionStateVersionSchema = z.number().int().nonnegative().refine(
	( version ) => version === SessionStoredProtectionStateVersion,
);

/**
 * Validates durable protection scopes indexed by scope identifier.
 * @since 0.1.0 Initial implementation.
 */
const StoredDurableProtectionScopesSchema = z.preprocess(
	( input ) => {
		if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
			return null;
		}

		const prototype: unknown = Object.getPrototypeOf( input );

		if ( prototype !== Object.prototype && prototype !== null ) {
			return null;
		}

		return Object.entries( input );
	},
	z.array( z.tuple( [ ProtectionScopeIdSchema, StoredDurableProtectionScopeStateSchema ] ) ),
).transform( ( entries ) => Object.fromEntries( entries ) );

/**
 * Validates session protection scopes indexed by scope identifier.
 * @since 0.1.0 Initial implementation.
 */
const StoredSessionProtectionScopesSchema = z.preprocess(
	( input ) => {
		if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
			return null;
		}

		const prototype: unknown = Object.getPrototypeOf( input );

		if ( prototype !== Object.prototype && prototype !== null ) {
			return null;
		}

		return Object.entries( input );
	},
	z.array( z.tuple( [ ProtectionScopeIdSchema, StoredSessionProtectionScopeStateSchema ] ) ),
).transform( ( entries ) => Object.fromEntries( entries ) );

/**
 * Validates the current durable stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredDurableProtectionStateSchema = z.object( {
	schemaVersion: DurableStoredProtectionStateVersionSchema,
	statisticsDelivery: StoredProtectionStatisticsDeliverySchema,
	scopes: StoredDurableProtectionScopesSchema,
} ).strict();

/**
 * Current durable stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredDurableProtectionState = z.infer<typeof StoredDurableProtectionStateSchema>;

/**
 * Validates the current session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredSessionProtectionStateSchema = z.object( {
	schemaVersion: SessionStoredProtectionStateVersionSchema,
	sessionContinuityId: SessionContinuityIdSchema,
	scopes: StoredSessionProtectionScopesSchema,
} ).strict();

/**
 * Current session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredSessionProtectionState = z.infer<typeof StoredSessionProtectionStateSchema>;

/**
 * Validates the durable and session values that comprise stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateSchema = z.object( {
	durable: StoredDurableProtectionStateSchema,
	session: StoredSessionProtectionStateSchema,
} ).strict();

/**
 * Durable and session values that comprise stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionState = z.infer<typeof StoredProtectionStateSchema>;
