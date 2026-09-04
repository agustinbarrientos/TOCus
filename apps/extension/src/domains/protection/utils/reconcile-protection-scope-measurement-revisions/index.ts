import {
	ProtectionScopeMeasurementRevisionMapSchema,
	type ProtectedSiteConfigurationSet,
	type ProtectionScopeMeasurementRevisionMap,
} from '../../types/protected-site-configuration';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	type ProtectionMeasurementRevision,
	type ProtectionScopeId,
} from '../../types/protection-value';
import { type ReconcileProtectionScopeMeasurementRevisionsOptions } from './types';

/**
 * Collects every active protection scope from one protected-site set.
 * @param sites - Protected-site configurations whose scopes are active.
 * @return Unique active scope identifiers, including the shared default scope.
 * @since 0.1.0 Initial implementation.
 */
function collectActiveProtectionScopeIds(
	sites: ProtectedSiteConfigurationSet,
): ReadonlySet<ProtectionScopeId> {
	return new Set<ProtectionScopeId>( [
		DefaultProtectionScopeId,
		...sites.map( ( site ) => site.rule.scopeId ),
	] );
}

/**
 * Retains measurement revisions for the scopes active in a projected site set.
 * @param sites - Projected protected-site configurations.
 * @param currentRevisionsByScope - Complete revisions for the source configuration.
 * @return Source revisions restricted to projected active scopes.
 * @throws {Error} When the source configuration omits an active scope revision.
 * @since 0.1.0 Initial implementation.
 */
export function retainActiveProtectionScopeMeasurementRevisions(
	sites: ProtectedSiteConfigurationSet,
	currentRevisionsByScope: ProtectionScopeMeasurementRevisionMap,
): ProtectionScopeMeasurementRevisionMap {
	return ProtectionScopeMeasurementRevisionMapSchema.parse( Object.fromEntries(
		[ ...collectActiveProtectionScopeIds( sites ) ].map( ( scopeId ) => {
			const currentRevision = Object.hasOwn( currentRevisionsByScope, scopeId )
				? currentRevisionsByScope[ scopeId ]
				: undefined;

			return [ scopeId, ProtectionMeasurementRevisionSchema.parse( currentRevision ) ];
		} ),
	) );
}

/**
 * Reconciles measurement revisions with active scopes and requested invalidations.
 * @param options - Active sites, current revisions, invalidated scopes, and revision factory.
 * @return Reconciled revisions or null when the factory returns an invalid value.
 * @since 0.1.0 Initial implementation.
 */
export function reconcileProtectionScopeMeasurementRevisions(
	options: ReconcileProtectionScopeMeasurementRevisionsOptions,
): ProtectionScopeMeasurementRevisionMap | null {
	const activeScopeIds = collectActiveProtectionScopeIds( options.sites );
	const entries: Array<readonly [ProtectionScopeId, ProtectionMeasurementRevision]> = [];
	const unavailableRevisions = new Set<ProtectionMeasurementRevision>(
		Object.values( options.currentRevisionsByScope ),
	);

	for ( const scopeId of activeScopeIds ) {
		const currentRevision = Object.hasOwn( options.currentRevisionsByScope, scopeId )
			? options.currentRevisionsByScope[ scopeId ]
			: undefined;

		if ( ! options.rotatedScopeIds.has( scopeId ) && currentRevision !== undefined ) {
			entries.push( [ scopeId, currentRevision ] );
			continue;
		}

		const revision = ProtectionMeasurementRevisionSchema.safeParse(
			options.createMeasurementRevision(),
		);

		if ( ! revision.success || unavailableRevisions.has( revision.data ) ) {
			return null;
		}

		unavailableRevisions.add( revision.data );
		entries.push( [ scopeId, revision.data ] );
	}

	return ProtectionScopeMeasurementRevisionMapSchema.parse( Object.fromEntries( entries ) );
}

export * from './types';
