import { reconcileProtectionScopeSchedules } from '../../../../domains/protection/utils/reconcile-protection-scope-schedules';
import { retainActiveProtectionScopeMeasurementRevisions } from '../../../../domains/protection/utils/reconcile-protection-scope-measurement-revisions';
import {
	createSitePermissionOrigins,
	isSitePermissionOriginCovered,
} from '../../utils/site-permission-origins';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionDescriptor,
	type SitePermissionManager,
	type SitePermissionManagerOptions,
} from './types';

/**
 * Browser permission required to observe protected-site navigations.
 * @since 0.1.0 Initial implementation.
 */
const NAVIGATION_PERMISSION = 'webNavigation';

/**
 * Creates the complete browser permission request for one protected-site rule.
 * @param origins - Exact host origins derived from the canonical rule.
 * @return Named and origin permissions required for navigation protection.
 * @since 0.1.0 Initial implementation.
 */
function createRequestDescriptor( origins: string[] ): SitePermissionDescriptor {
	return {
		permissions: [ NAVIGATION_PERMISSION ],
		origins,
	};
}

/**
 * Creates browser permission coordination for protected-site settings.
 * @param options - Browser permissions dependency.
 * @return Protected-site permission operations.
 * @since 0.1.0 Initial implementation.
 */
export function createSitePermissionManager( options: SitePermissionManagerOptions ): SitePermissionManager {
	/**
	 * Reports whether one rule has its complete current browser access.
	 * @param rule - Canonical protected-site rule to inspect.
	 * @return Whether navigation observation and every required origin are granted.
	 * @since 0.1.0 Initial implementation.
	 */
	async function hasAccess( rule: Parameters<SitePermissionManager[ 'hasAccess' ]>[ 0 ] ): Promise<boolean> {
		try {
			return await options.permissions.contains(
				createRequestDescriptor( createSitePermissionOrigins( rule ) ),
			);
		} catch {
			return false;
		}
	}

	/**
	 * Removes sites whose browser access is incomplete from one runtime projection.
	 * @param configuration - Validated persisted protection configuration.
	 * @return Valid runtime configuration containing only currently accessible sites.
	 * @since 0.1.0 Initial implementation.
	 */
	async function filterConfiguration(
		configuration: Parameters<SitePermissionManager[ 'filterConfiguration' ]>[ 0 ],
	): ReturnType<SitePermissionManager[ 'filterConfiguration' ]> {
		let grantedPermissions: Awaited<ReturnType<SitePermissionManagerOptions[ 'permissions' ][ 'getAll' ]>>;

		try {
			grantedPermissions = await options.permissions.getAll();
		} catch {
			grantedPermissions = {};
		}

		const grantedOrigins = grantedPermissions.origins ?? [];
		const hasNavigationPermission = grantedPermissions.permissions?.includes( NAVIGATION_PERMISSION ) ?? false;
		const sites = hasNavigationPermission
			? configuration.sites.filter( ( site ) =>
				createSitePermissionOrigins( site.rule ).every( ( origin ) =>
					isSitePermissionOriginCovered( origin, grantedOrigins ),
				),
			)
			: [];

		return {
			...configuration,
			sites,
			schedulesByScope: reconcileProtectionScopeSchedules( sites, configuration.schedulesByScope ),
			measurementRevisionsByScope: retainActiveProtectionScopeMeasurementRevisions(
				sites,
				configuration.measurementRevisionsByScope,
			),
		};
	}

	/**
	 * Requests the exact browser capabilities required by one rule.
	 * @param rule - Canonical protected-site rule selected by the user.
	 * @return Explicit grant, denial, or browser-error result.
	 * @since 0.1.0 Initial implementation.
	 */
	async function request( rule: Parameters<SitePermissionManager[ 'request' ]>[ 0 ] ) {
		const descriptor = createRequestDescriptor( createSitePermissionOrigins( rule ) );
		let existingGrantResultPromise: Promise<PromiseSettledResult<boolean>>;

		try {
			existingGrantResultPromise = options.permissions.contains( descriptor ).then(
				( value ) => ( { status: 'fulfilled', value } as const ),
				( reason: unknown ) => ( { status: 'rejected', reason } as const ),
			);
		} catch ( reason ) {
			existingGrantResultPromise = Promise.resolve( { status: 'rejected', reason } );
		}

		try {
			const permissionRequestResultPromise = options.permissions.request( descriptor ).then(
				( value ) => ( { status: 'fulfilled', value } as const ),
				( reason: unknown ) => ( { status: 'rejected', reason } as const ),
			);
			const [ existingGrantResult, permissionRequestResult ] = await Promise.all( [
				existingGrantResultPromise,
				permissionRequestResultPromise,
			] );

			if ( permissionRequestResult.status === 'rejected' ) {
				return { status: SitePermissionRequestStatus.ERROR } as const;
			}

			const provenance = existingGrantResult.status === 'rejected'
				? SitePermissionGrantProvenance.UNKNOWN
				: existingGrantResult.value
					? SitePermissionGrantProvenance.EXISTING
					: SitePermissionGrantProvenance.NEW;

			return permissionRequestResult.value
				? {
					status: SitePermissionRequestStatus.GRANTED,
					provenance,
				} as const
				: { status: SitePermissionRequestStatus.DENIED } as const;
		} catch {
			return { status: SitePermissionRequestStatus.ERROR } as const;
		}
	}

	/**
	 * Releases one rule's origins and the shared navigation capability when no sites remain.
	 * @param rule - Removed canonical protected-site rule.
	 * @param hasRemainingSites - Whether another configured protected site remains.
	 * @return Explicit released, retained, or browser-error result.
	 * @since 0.1.0 Initial implementation.
	 */
	async function release(
		rule: Parameters<SitePermissionManager[ 'release' ]>[ 0 ],
		hasRemainingSites: boolean,
	) {
		const descriptor: SitePermissionDescriptor = {
			...( hasRemainingSites ? {} : { permissions: [ NAVIGATION_PERMISSION ] } ),
			origins: createSitePermissionOrigins( rule ),
		};

		try {
			return await options.permissions.remove( descriptor )
				? SitePermissionReleaseStatus.RELEASED
				: SitePermissionReleaseStatus.RETAINED;
		} catch {
			return SitePermissionReleaseStatus.ERROR;
		}
	}

	return { filterConfiguration, hasAccess, release, request };
}

export * from './types';
