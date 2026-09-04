import {
	StoredProtectionStatisticsDeliveryStatus,
} from '../../types/stored-protection-statistics-delivery';
import {
	DurableStoredProtectionStateVersion,
	SessionStoredProtectionStateVersion,
	StoredDurableProtectionStateSchema,
	StoredSessionProtectionStateSchema,
	type StoredDurableProtectionState,
} from '../../types/stored-protection-state';
import {
	DurableStoredProtectionStateVersionOne,
	StoredDurableProtectionStateVersionOneSchema,
	ParsedDurableStoredProtectionStateSchema,
	ParsedSessionStoredProtectionStateSchema,
	ParsedStoredProtectionStateSchema,
	ParseStoredProtectionStateInputSchema,
	StoredProtectionStateFailureReason,
	StoredProtectionStateParseStatus,
	StoredProtectionStateVersionProbeSchema,
	StoredProtectionStateVersionSchema,
	type ParsedDurableStoredProtectionState,
	type ParsedSessionStoredProtectionState,
	type ParsedStoredProtectionState,
} from './types';

/**
 * Statistics delivery used when protection state is valid but its observational data is not.
 * @since 0.1.0 Initial implementation.
 */
const IncompleteStatisticsDelivery = Object.freeze( {
	status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
	outbox: [],
} as const );

/**
 * Recovers valid protection fields while replacing untrusted statistics delivery.
 * @param input - Unknown durable document whose complete parse failed.
 * @return Current protection state with incomplete statistics, or null when protection is invalid.
 * @since 0.1.0 Initial implementation.
 */
function recoverDurableProtectionWithoutStatistics(
	input: unknown,
): StoredDurableProtectionState | null {
	if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
		return null;
	}

	const recoveredState = StoredDurableProtectionStateSchema.safeParse( {
		...input,
		statisticsDelivery: IncompleteStatisticsDelivery,
	} );

	return recoveredState.success ? recoveredState.data : null;
}

/**
 * Parses one unknown durable stored value without exposing raw failure details.
 * @param input - Unknown durable stored value.
 * @return Typed durable parse result.
 * @since 0.1.0 Initial implementation.
 */
function parseDurableStoredProtectionState( input: unknown ): ParsedDurableStoredProtectionState {
	if ( input === undefined ) {
		return ParsedDurableStoredProtectionStateSchema.parse( {
			status: StoredProtectionStateParseStatus.ABSENT,
		} );
	}

	const versionProbe = StoredProtectionStateVersionProbeSchema.safeParse( input );

	if ( versionProbe.success ) {
		const version = StoredProtectionStateVersionSchema.safeParse( versionProbe.data.schemaVersion );

		if ( version.success && version.data === DurableStoredProtectionStateVersionOne ) {
			const versionOneState = StoredDurableProtectionStateVersionOneSchema.safeParse( input );

			if ( ! versionOneState.success ) {
				return ParsedDurableStoredProtectionStateSchema.parse( {
					status: StoredProtectionStateParseStatus.FAILED,
					reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
				} );
			}

			return ParsedDurableStoredProtectionStateSchema.parse( {
				status: StoredProtectionStateParseStatus.CURRENT,
				state: {
					...versionOneState.data,
					schemaVersion: DurableStoredProtectionStateVersion,
					statisticsDelivery: {
						status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
						outbox: [],
					},
				},
			} );
		}

		if ( version.success && version.data !== DurableStoredProtectionStateVersion ) {
			return ParsedDurableStoredProtectionStateSchema.parse( {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.UNSUPPORTED_VERSION,
			} );
		}
	}

	const state = StoredDurableProtectionStateSchema.safeParse( input );

	if ( ! state.success ) {
		const recoveredState = recoverDurableProtectionWithoutStatistics( input );

		if ( recoveredState !== null ) {
			return ParsedDurableStoredProtectionStateSchema.parse( {
				status: StoredProtectionStateParseStatus.CURRENT,
				state: recoveredState,
			} );
		}

		return ParsedDurableStoredProtectionStateSchema.parse( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	}

	return ParsedDurableStoredProtectionStateSchema.parse( {
		status: StoredProtectionStateParseStatus.CURRENT,
		state: state.data,
	} );
}

/**
 * Parses one unknown session stored value without exposing raw failure details.
 * @param input - Unknown session stored value.
 * @return Typed session parse result.
 * @since 0.1.0 Initial implementation.
 */
function parseSessionStoredProtectionState( input: unknown ): ParsedSessionStoredProtectionState {
	if ( input === undefined ) {
		return ParsedSessionStoredProtectionStateSchema.parse( {
			status: StoredProtectionStateParseStatus.ABSENT,
		} );
	}

	const versionProbe = StoredProtectionStateVersionProbeSchema.safeParse( input );

	if ( versionProbe.success ) {
		const version = StoredProtectionStateVersionSchema.safeParse( versionProbe.data.schemaVersion );

		if ( version.success && version.data !== SessionStoredProtectionStateVersion ) {
			return ParsedSessionStoredProtectionStateSchema.parse( {
				status: StoredProtectionStateParseStatus.FAILED,
				reason: StoredProtectionStateFailureReason.UNSUPPORTED_VERSION,
			} );
		}
	}

	const state = StoredSessionProtectionStateSchema.safeParse( input );

	if ( ! state.success ) {
		return ParsedSessionStoredProtectionStateSchema.parse( {
			status: StoredProtectionStateParseStatus.FAILED,
			reason: StoredProtectionStateFailureReason.INVALID_STORED_STATE,
		} );
	}

	return ParsedSessionStoredProtectionStateSchema.parse( {
		status: StoredProtectionStateParseStatus.CURRENT,
		state: state.data,
	} );
}

/**
 * Parses durable and session stored protection state independently.
 * @param input - Optional unknown durable and session stored values.
 * @return Typed independent parse results.
 * @throws {import('zod').ZodError} When the input wrapper or a computed result violates its contract.
 * @since 0.1.0 Initial implementation.
 */
export function parseStoredProtectionState( input: unknown ): ParsedStoredProtectionState {
	const parsedInput = ParseStoredProtectionStateInputSchema.parse( input );

	return ParsedStoredProtectionStateSchema.parse( {
		durable: parseDurableStoredProtectionState( parsedInput.durable ),
		session: parseSessionStoredProtectionState( parsedInput.session ),
	} );
}

export * from './types';
