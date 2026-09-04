import {
	type AllowanceId,
	type ProtectionMeasurementRevision,
	type ProtectionScopeId,
} from '../../protection/types/protection-value';

/**
 * Privacy-safe identity of one allowance currently receiving confirmed focus.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedAllowanceIdentity {
	scopeId: ProtectionScopeId;
	measurementRevision: ProtectionMeasurementRevision;
	allowanceId: AllowanceId;
}
