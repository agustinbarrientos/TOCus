import { ProtectionStorageEnvelopeSchema } from '../../../../domains/protection/services/protection-storage';
import {
	StoredDurableProtectionStateSchema,
	type StoredProtectionAllowance,
} from '../../../../domains/protection/types/stored-protection-state';

/**
 * Projects a durable storage envelope to its running allowance intervals.
 * @param input - Unknown previous or current durable storage value.
 * @return Intervals indexed by scope, or null when a present value is invalid.
 * @since 0.1.0 Initial implementation.
 */
function getAllowanceIntervals( input: unknown ): Map<string, StoredProtectionAllowance> | null {
	if ( input === undefined ) {
		return new Map();
	}

	const envelope = ProtectionStorageEnvelopeSchema.safeParse( input );
	if ( ! envelope.success ) {
		return null;
	}

	const document = StoredDurableProtectionStateSchema.safeParse( envelope.data.document );
	if ( ! document.success ) {
		return null;
	}

	const intervals = new Map<string, StoredProtectionAllowance>();
	for ( const [ scopeId, scope ] of Object.entries( document.data.scopes ) ) {
		if ( scope.allowance !== undefined ) {
			intervals.set( scopeId, scope.allowance );
		}
	}

	return intervals;
}

/**
 * Reports whether a durable write changed any actual running allowance interval.
 * @param oldValue - Previous durable storage envelope, or undefined before creation.
 * @param newValue - Current durable storage envelope, or undefined after removal.
 * @return Whether allowance identity, scope, start, or expiry changed between valid values.
 * @since 0.1.0 Initial implementation.
 */
export function hasAllowanceIntervalChange( oldValue: unknown, newValue: unknown ): boolean {
	const previous = getAllowanceIntervals( oldValue );
	const current = getAllowanceIntervals( newValue );
	if ( previous === null || current === null ) {
		return false;
	}

	if ( previous.size !== current.size ) {
		return true;
	}

	return [ ...current ].some( ( [ scopeId, interval ] ) => {
		const prior = previous.get( scopeId );
		return prior === undefined ||
			prior.allowanceId !== interval.allowanceId ||
			prior.startedAtEpochMilliseconds !== interval.startedAtEpochMilliseconds ||
			prior.expiresAtEpochMilliseconds !== interval.expiresAtEpochMilliseconds;
	} );
}
