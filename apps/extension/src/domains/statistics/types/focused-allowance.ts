import type { CanonicalHost } from '../../protection/types/protected-site-rule';
import type {
	AllowanceId,
	ProtectionMeasurementRevision,
	ProtectionScopeId,
} from '../../protection/types/protection-value';

/**
 * Privacy-safe identity of one allowance currently receiving confirmed focus.
 * @since 0.1.0 Initial implementation.
 */
export interface FocusedAllowanceIdentity {
	scopeId: ProtectionScopeId;
	measurementRevision: ProtectionMeasurementRevision;
	allowanceId: AllowanceId;
	/**
	 * Matched protected-rule host used to identify focus continuity.
	 * @since 0.1.0 Initial implementation.
	 */
	siteHost: CanonicalHost;
}
