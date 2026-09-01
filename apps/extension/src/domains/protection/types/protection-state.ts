import { z, type RefinementCtx } from 'zod';
import { AllowanceDurationMillisecondsSchema } from './allowance-duration';
import {
	AllowanceIdSchema,
	DurationMillisecondsSchema,
	EpochMillisecondsSchema,
	OwnerEpochSchema,
	ParticipantIdSchema,
	ProtectionScopeIdSchema,
	WaitIdSchema,
} from './protection-value';
import { DailyLadderSchema } from './daily-ladder';
import {
	ProtectionParticipantSchema,
	type ProtectionParticipant,
} from './protection-participant';
import { WaitDurationMillisecondsSchema } from './wait-duration';

/**
 * Runtime states owned by one protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateType = {
	IDLE: 'idle',
	WAITING: 'waiting',
	ALLOWANCE: 'allowance',
} as const;

/**
 * Validates a protection runtime-state discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateTypeSchema = z.enum( ProtectionStateType );

/**
 * Protection runtime-state discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStateType = z.infer<typeof ProtectionStateTypeSchema>;

/**
 * Validates a transaction target identifying a waiting state.
 * @since 0.1.0 Initial implementation.
 */
export const WaitingProtectionStateTargetSchema = z.object( {
	stateType: z.enum( [ ProtectionStateType.WAITING ] ),
	waitId: WaitIdSchema,
} ).strict();

/**
 * Transaction target identifying a Waiting state.
 * @since 0.1.0 Initial implementation.
 */
export type WaitingProtectionStateTarget = z.infer<typeof WaitingProtectionStateTargetSchema>;

/**
 * Validates a transaction target identifying an allowance state.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceProtectionStateTargetSchema = z.object( {
	stateType: z.enum( [ ProtectionStateType.ALLOWANCE ] ),
	allowanceId: AllowanceIdSchema,
} ).strict();

/**
 * Transaction target identifying an Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceProtectionStateTarget = z.infer<typeof AllowanceProtectionStateTargetSchema>;

/**
 * Validates a transaction target for Waiting or Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateTargetSchema = z.discriminatedUnion( 'stateType', [
	WaitingProtectionStateTargetSchema,
	AllowanceProtectionStateTargetSchema,
] );

/**
 * Transaction target for Waiting or Allowance state.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStateTarget = z.infer<typeof ProtectionStateTargetSchema>;

/**
 * Adds participant and page identity collisions to one state refinement context.
 * @param participants - Participants whose identities must be unique.
 * @param context - Zod refinement context receiving collision issues.
 * @param collectionLabel - Human-readable participant collection label.
 * @param collectionPath - State property containing the participants.
 * @since 0.1.0 Initial implementation.
 */
function refineParticipantUniqueness(
	participants: ProtectionParticipant[],
	context: RefinementCtx,
	collectionLabel: string,
	collectionPath: string,
): void {
	const participantIds = new Set<string>();
	const pageIds = new Set<string>();

	participants.forEach( ( participant, index ) => {
		if ( participantIds.has( participant.participantId ) ) {
			context.addIssue( {
				code: 'custom',
				message: `${ collectionLabel } participant identifiers must be unique.`,
				path: [ collectionPath, index, 'participantId' ],
			} );
		}

		if ( pageIds.has( participant.pageId ) ) {
			context.addIssue( {
				code: 'custom',
				message: `${ collectionLabel } page identifiers must be unique.`,
				path: [ collectionPath, index, 'pageId' ],
			} );
		}

		participantIds.add( participant.participantId );
		pageIds.add( participant.pageId );
	} );
}

/**
 * Validates an idle protection state.
 * @since 0.1.0 Initial implementation.
 */
export const IdleProtectionStateSchema = z.object( {
	type: z.enum( [ ProtectionStateType.IDLE ] ),
	scopeId: ProtectionScopeIdSchema,
	ladder: DailyLadderSchema,
} ).strict();

/**
 * Idle protection state for one scope.
 * @since 0.1.0 Initial implementation.
 */
export type IdleProtectionState = z.infer<typeof IdleProtectionStateSchema>;

/**
 * Validates a waiting protection state and its participant invariants.
 * @since 0.1.0 Initial implementation.
 */
export const WaitingProtectionStateSchema = z.object( {
	type: z.enum( [ ProtectionStateType.WAITING ] ),
	scopeId: ProtectionScopeIdSchema,
	waitId: WaitIdSchema,
	capturedWaitDurationMilliseconds: WaitDurationMillisecondsSchema,
	confirmedFocusedDurationMilliseconds: DurationMillisecondsSchema,
	participants: z.array( ProtectionParticipantSchema ).min( 1 ),
	ownerParticipantId: z.union( [ ParticipantIdSchema, z.null() ] ),
	ownerEpoch: OwnerEpochSchema,
	checkpointHighWaterMilliseconds: DurationMillisecondsSchema,
	ladder: DailyLadderSchema,
} ).strict().superRefine( ( state, context ) => {
	if ( state.confirmedFocusedDurationMilliseconds >= state.capturedWaitDurationMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Waiting progress must remain below the captured duration.',
			path: [ 'confirmedFocusedDurationMilliseconds' ],
		} );
	}

	if ( state.checkpointHighWaterMilliseconds > state.confirmedFocusedDurationMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Checkpoint high-water cannot exceed confirmed focused progress.',
			path: [ 'checkpointHighWaterMilliseconds' ],
		} );
	}

	refineParticipantUniqueness( state.participants, context, 'Waiting', 'participants' );

	const expectedOwnerParticipantId = state.participants.reduce<ProtectionParticipant | null>(
		( selected, participant ) => {
			if ( ! participant.focusEligible ) {
				return selected;
			}

			if (
				selected === null ||
				participant.joinSequence < selected.joinSequence ||
				(
					participant.joinSequence === selected.joinSequence &&
					participant.participantId < selected.participantId
				)
			) {
				return participant;
			}

			return selected;
		},
		null,
	)?.participantId ?? null;

	if ( state.ownerParticipantId !== expectedOwnerParticipantId ) {
		context.addIssue( {
			code: 'custom',
			message: 'Waiting ownership must select the deterministic eligible participant.',
			path: [ 'ownerParticipantId' ],
		} );
	}

	if ( state.ownerParticipantId !== null && state.ownerEpoch < 1 ) {
		context.addIssue( {
			code: 'custom',
			message: 'A focused Waiting owner requires a positive owner epoch.',
			path: [ 'ownerEpoch' ],
		} );
	}

	if ( state.ownerParticipantId === null && state.checkpointHighWaterMilliseconds !== 0 ) {
		context.addIssue( {
			code: 'custom',
			message: 'An ownerless Waiting state requires a zero checkpoint high-water value.',
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
			message: 'An initially ownerless Waiting history cannot contain confirmed progress.',
			path: [ 'confirmedFocusedDurationMilliseconds' ],
		} );
	}
} );

/**
 * Waiting protection state retaining participants and confirmed progress.
 * @since 0.1.0 Initial implementation.
 */
export type WaitingProtectionState = z.infer<typeof WaitingProtectionStateSchema>;

/**
 * Validates an allowance protection state and its participant invariants.
 * @since 0.1.0 Initial implementation.
 */
export const AllowanceProtectionStateSchema = z.object( {
	type: z.enum( [ ProtectionStateType.ALLOWANCE ] ),
	scopeId: ProtectionScopeIdSchema,
	allowanceId: AllowanceIdSchema,
	completedWaitId: z.union( [ WaitIdSchema, z.null() ] ),
	startedAtEpochMilliseconds: EpochMillisecondsSchema,
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
	readyParticipants: z.array( ProtectionParticipantSchema ),
	ladder: DailyLadderSchema,
} ).strict().superRefine( ( state, context ) => {
	const allowanceDurationMilliseconds =
		state.expiresAtEpochMilliseconds - state.startedAtEpochMilliseconds;

	if ( ! AllowanceDurationMillisecondsSchema.safeParse( allowanceDurationMilliseconds ).success ) {
		context.addIssue( {
			code: 'custom',
			message: 'Allowance interval must span one through sixty whole minutes.',
			path: [ 'expiresAtEpochMilliseconds' ],
		} );
	}

	refineParticipantUniqueness( state.readyParticipants, context, 'Ready', 'readyParticipants' );

	if ( state.readyParticipants.length > 0 && state.completedWaitId === null ) {
		context.addIssue( {
			code: 'custom',
			message: 'Ready participants require their originating completed-wait identifier.',
			path: [ 'completedWaitId' ],
		} );
	}
} );

/**
 * Active allowance state retaining participants awaiting an action.
 * @since 0.1.0 Initial implementation.
 */
export type AllowanceProtectionState = z.infer<typeof AllowanceProtectionStateSchema>;

/**
 * Validates exactly one Idle, Waiting, or Allowance state for a protection scope.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStateSchema = z.discriminatedUnion( 'type', [
	IdleProtectionStateSchema,
	WaitingProtectionStateSchema,
	AllowanceProtectionStateSchema,
] );

/**
 * Exactly one Idle, Waiting, or Allowance state for a protection scope.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionState = z.infer<typeof ProtectionStateSchema>;
