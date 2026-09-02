import {
	ProtectionScopeScheduleMapSchema,
	type ProtectedSiteConfigurationSet,
	type ProtectionScopeScheduleMap,
} from '../../types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../types/protection-schedule';
import { DefaultProtectionScopeId } from '../../types/protection-value';

/**
 * Reconciles persisted schedules with the scopes owned by a protected-site set.
 * @param sites - Candidate protected-site configurations.
 * @param schedulesByScope - Existing normalized schedules indexed by scope.
 * @return Existing schedules for active scopes and Always defaults for newly active scopes.
 * @since 0.1.0 Initial implementation.
 */
export function reconcileProtectionScopeSchedules(
	sites: ProtectedSiteConfigurationSet,
	schedulesByScope: ProtectionScopeScheduleMap,
): ProtectionScopeScheduleMap {
	const activeScopeIds = new Set( [
		DefaultProtectionScopeId,
		...sites.map( ( site ) => site.rule.scopeId ),
	] );

	return ProtectionScopeScheduleMapSchema.parse( Object.fromEntries(
		[ ...activeScopeIds ].map( ( scopeId ) => [
			scopeId,
			schedulesByScope[ scopeId ] ?? DefaultProtectionSchedule,
		] ),
	) );
}
