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
	type SitePermissionBatchRequestResult,
	type SitePermissionGrantSnapshot,
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
	 * Requests selected rule origins together without awaiting work before browser consent.
	 * @param rules - Canonical protected-site rules selected by the user.
	 * @return Batch grant and its prior access snapshot, denial, or browser error.
	 * @since 0.1.0 Initial implementation.
	 */
	async function requestMany(
		rules: Parameters<SitePermissionManager[ 'requestMany' ]>[ 0 ],
	): Promise<SitePermissionBatchRequestResult> {
		const origins = [ ...new Set( rules.flatMap( createSitePermissionOrigins ) ) ];
		let previousGrantPromise: Promise<SitePermissionGrantSnapshot | null>;

		try {
			previousGrantPromise = options.permissions.getAll().catch( () => null );
		} catch {
			previousGrantPromise = Promise.resolve( null );
		}

		if ( origins.length === 0 ) {
			return { status: SitePermissionRequestStatus.GRANTED, previousGrant: await previousGrantPromise };
		}

		try {
			const requestPromise = options.permissions.request( createRequestDescriptor( origins ) );
			const [ granted, previousGrant ] = await Promise.all( [ requestPromise, previousGrantPromise ] );

			return granted
				? { status: SitePermissionRequestStatus.GRANTED, previousGrant }
				: { status: SitePermissionRequestStatus.DENIED };
		} catch {
			return { status: SitePermissionRequestStatus.ERROR };
		}
	}

	/**
	 * Removes only new batch permissions unowned by the authoritative configuration.
	 * @param rules - Canonical rules included in the batch request.
	 * @param previousGrant - Original access snapshot, or null when unavailable.
	 * @param configuration - Current configuration held inside mutation coordination.
	 * @return Released, retained, or browser-error result.
	 * @since 0.1.0 Initial implementation.
	 */
	async function releaseNewAccess(
		rules: Parameters<SitePermissionManager[ 'releaseNewAccess' ]>[ 0 ],
		previousGrant: SitePermissionGrantSnapshot | null,
		configuration: Parameters<SitePermissionManager[ 'releaseNewAccess' ]>[ 2 ],
	): Promise<SitePermissionReleaseStatus> {
		if ( previousGrant === null || configuration === null ) {
			return SitePermissionReleaseStatus.RETAINED;
		}

		const retainedOrigins = [
			...( previousGrant.origins ?? [] ),
			...configuration.sites.flatMap( ( site ) => createSitePermissionOrigins( site.rule ) ),
		];
		const newOrigins = [ ...new Set( rules.flatMap( createSitePermissionOrigins ) ) ].filter(
			( origin ) => ! isSitePermissionOriginCovered( origin, retainedOrigins ),
		);
		const origins = newOrigins.filter( ( origin ) => ! retainedOrigins.some(
			( retainedOrigin ) => isSitePermissionOriginCovered( retainedOrigin, [ origin ] ),
		) );
		const hasOverlappingGrants = origins.length !== newOrigins.length;
		const removeNavigation = configuration.sites.length === 0 &&
			! previousGrant.permissions?.includes( NAVIGATION_PERMISSION );

		if ( origins.length === 0 && ! removeNavigation ) {
			return hasOverlappingGrants ? SitePermissionReleaseStatus.RETAINED : SitePermissionReleaseStatus.RELEASED;
		}

		try {
			return await options.permissions.remove( {
				origins,
				...( removeNavigation ? { permissions: [ NAVIGATION_PERMISSION ] } : {} ),
			} ) && ! hasOverlappingGrants
				? SitePermissionReleaseStatus.RELEASED
				: SitePermissionReleaseStatus.RETAINED;
		} catch {
			return SitePermissionReleaseStatus.ERROR;
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

	return { filterConfiguration, hasAccess, release, releaseNewAccess, request, requestMany };
}

export * from './types';
