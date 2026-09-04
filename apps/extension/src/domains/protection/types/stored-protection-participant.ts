import { z } from 'zod';
import {
	JoinSequenceSchema,
	PageIdSchema,
	ParticipantIdSchema,
	RetainedNavigationDestinationSchema,
} from './protection-value';
import {
	ProtectionParticipantOrigin,
	type ProtectionParticipantOrigin as ProtectionParticipantOriginType,
} from './protection-participant';

/**
 * Participant origins retained in stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionParticipantOrigin = {
	NAVIGATION: 'navigation',
	ALLOWANCE_EXPIRY: 'allowance-expiry',
} as const;

/**
 * Validates an origin retained for a stored protection participant.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionParticipantOriginSchema = z.enum( StoredProtectionParticipantOrigin );

/**
 * Origin retained for a stored protection participant.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionParticipantOrigin = z.infer<typeof StoredProtectionParticipantOriginSchema>;

/**
 * Maps each runtime participant origin to its stored representation.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionParticipantOriginByProtectionParticipantOrigin = {
	[ ProtectionParticipantOrigin.NAVIGATION ]: StoredProtectionParticipantOrigin.NAVIGATION,
	[ ProtectionParticipantOrigin.ALLOWANCE_EXPIRY ]: StoredProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
} satisfies Record<ProtectionParticipantOriginType, StoredProtectionParticipantOrigin>;

/**
 * Maps each stored participant origin to its runtime representation.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionParticipantOriginByStoredProtectionParticipantOrigin = {
	[ StoredProtectionParticipantOrigin.NAVIGATION ]: ProtectionParticipantOrigin.NAVIGATION,
	[ StoredProtectionParticipantOrigin.ALLOWANCE_EXPIRY ]: ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
} satisfies Record<StoredProtectionParticipantOrigin, ProtectionParticipantOriginType>;

/**
 * Validates a stored navigation participant.
 * @since 0.1.0 Initial implementation.
 */
const StoredNavigationProtectionParticipantSchema = z.object( {
	origin: z.enum( [ StoredProtectionParticipantOrigin.NAVIGATION ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	retainedDestination: RetainedNavigationDestinationSchema,
	statisticsEligible: z.boolean().default( false ),
	joinSequence: JoinSequenceSchema,
} ).strict();

/**
 * Validates a stored allowance-expiry participant.
 * @since 0.1.0 Initial implementation.
 */
const StoredAllowanceExpiryProtectionParticipantSchema = z.object( {
	origin: z.enum( [ StoredProtectionParticipantOrigin.ALLOWANCE_EXPIRY ] ),
	participantId: ParticipantIdSchema,
	pageId: PageIdSchema,
	retainedDestination: z.null(),
	statisticsEligible: z.boolean().default( false ),
	joinSequence: JoinSequenceSchema,
} ).strict();

/**
 * Validates a stored protection participant without volatile focus state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionParticipantSchema = z.discriminatedUnion( 'origin', [
	StoredNavigationProtectionParticipantSchema,
	StoredAllowanceExpiryProtectionParticipantSchema,
] );

/**
 * Stored protection participant without volatile focus state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionParticipant = z.infer<typeof StoredProtectionParticipantSchema>;

/**
 * Validates a non-empty collection of uniquely identified stored protection participants.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionParticipantsSchema = z.array( StoredProtectionParticipantSchema ).min( 1 ).superRefine(
	( participants, context ) => {
		const participantIds = new Set<string>();
		const pageIds = new Set<string>();

		participants.forEach( ( participant, index ) => {
			if ( participantIds.has( participant.participantId ) ) {
				context.addIssue( {
					code: 'custom',
					message: 'Stored participant identifiers must be unique.',
					path: [ index, 'participantId' ],
				} );
			}

			if ( pageIds.has( participant.pageId ) ) {
				context.addIssue( {
					code: 'custom',
					message: 'Stored page identifiers must be unique.',
					path: [ index, 'pageId' ],
				} );
			}

			participantIds.add( participant.participantId );
			pageIds.add( participant.pageId );
		} );
	},
);

/**
 * Non-empty collection of uniquely identified stored protection participants.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionParticipants = z.infer<typeof StoredProtectionParticipantsSchema>;
