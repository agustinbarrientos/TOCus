import {
	type ProtectedSiteConfigurationSet,
	type ProtectionScopeMeasurementRevisionMap,
} from '../../types/protected-site-configuration';
import {
	type ProtectionMeasurementRevisionFactory,
	type ProtectionScopeId,
} from '../../types/protection-value';

/**
 * Inputs used to reconcile active protection scope measurement revisions.
 * @since 0.1.0 Initial implementation.
 */
export interface ReconcileProtectionScopeMeasurementRevisionsOptions {
	/** Candidate protected-site configurations. */
	sites: ProtectedSiteConfigurationSet;
	/** Existing measurement revisions indexed by scope. */
	currentRevisionsByScope: ProtectionScopeMeasurementRevisionMap;
	/** Active scopes whose measurement contract changed. */
	rotatedScopeIds: ReadonlySet<ProtectionScopeId>;
	/** Factory for globally unique stable measurement revisions. */
	createMeasurementRevision: ProtectionMeasurementRevisionFactory;
}
