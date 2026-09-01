import {
	StoredProtectionParticipantOrigin,
	StoredProtectionParticipantSchema,
} from '../stored-protection-participant';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredDurableProtectionStateSchema,
	StoredProtectionScopeStateType,
	StoredSessionProtectionStateSchema,
} from '../stored-protection-state';

/**
 * Valid durable protection state with one scope.
 * @since 0.1.0 Initial implementation.
 */
export const Mock_StoredProtectionState_Durable = StoredDurableProtectionStateSchema.parse( {
	schemaVersion: DurableStoredProtectionStateVersion,
	scopes: {
		'scope-a': {
			ladder: {
				completedWaits: 2,
				greatestObservedLocalDate: '2026-08-31',
			},
		},
	},
} );

/**
 * Valid stored navigation participant.
 * @since 0.1.0 Initial implementation.
 */
export const Mock_StoredProtectionParticipant_Navigation = StoredProtectionParticipantSchema.parse( {
	origin: StoredProtectionParticipantOrigin.NAVIGATION,
	participantId: 'participant-a',
	pageId: 'page-a',
	retainedDestination: 'https://example.com/a',
	joinSequence: 0,
} );

/**
 * Valid session protection state with one Ready scope.
 * @since 0.1.0 Initial implementation.
 */
export const Mock_StoredProtectionState_Session = StoredSessionProtectionStateSchema.parse( {
	schemaVersion: SessionStoredProtectionStateVersion,
	sessionContinuityId: 'session-current',
	scopes: {
		'scope-a': {
			type: StoredProtectionScopeStateType.READY,
			allowanceId: 'allowance-a',
			completedWaitId: 'wait-a',
			participants: [ Mock_StoredProtectionParticipant_Navigation ],
		},
	},
} );
