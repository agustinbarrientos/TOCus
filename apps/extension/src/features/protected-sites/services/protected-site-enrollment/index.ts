import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditFinalizer,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationRemovalFinalizer,
} from '../../../../domains/protection/services/protection-configuration-editor';
import {
	ProtectedSiteConfigurationSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	ProtectedSiteCanonicalizationStatus,
	canonicalizeProtectedSite,
} from '../../../../domains/protection/utils/protected-site-canonicalizer';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
} from '../site-permission-manager';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
	type ProtectedSiteEnrollmentService,
	type ProtectedSiteEnrollmentServiceOptions,
	type ProtectedSiteRemovalResult,
} from './types';

/**
 * Checks whether an authoritative configuration still requires one rule's browser access.
 * @param configuration - Fresh configuration loaded inside mutation coordination.
 * @param rule - Rule whose permission would otherwise be released.
 * @return Whether a configured site still owns the same browser access.
 * @since 0.1.0 Initial implementation.
 */
function requiresRulePermission(
	configuration: ProtectionConfigurationDocument,
	rule: ProtectedSiteRule,
): boolean {
	return configuration.sites.some( ( site ) =>
		site.rule.host === rule.host &&
		site.rule.includeSubdomains === rule.includeSubdomains,
	);
}

/**
 * Reconciles browser access after a failed enrollment.
 * @param options - Protected-site enrollment dependencies.
 * @param rule - Canonical rule whose newly granted access may need release.
 * @param provenance - Whether access existed, was newly granted, or could not be determined.
 * @param configuration - Fresh configuration observed inside mutation coordination.
 * @return Whether browser access was retained or its ownership remains uncertain.
 * @since 0.1.0 Initial implementation.
 */
async function reconcilePermissionAfterFailure(
	options: ProtectedSiteEnrollmentServiceOptions,
	rule: ProtectedSiteRule,
	provenance: SitePermissionGrantProvenance,
	configuration: Parameters<ProtectionConfigurationEditFinalizer>[ 0 ][ 'configuration' ],
): Promise<boolean> {
	if ( provenance === SitePermissionGrantProvenance.EXISTING ) {
		return false;
	}

	if ( provenance === SitePermissionGrantProvenance.UNKNOWN ) {
		return true;
	}

	if ( configuration === null ) {
		return true;
	}

	if ( requiresRulePermission( configuration, rule ) ) {
		return false;
	}

	const releaseStatus = await options.permissionManager.release(
		rule,
		configuration.sites.length > 0,
	);

	return releaseStatus !== SitePermissionReleaseStatus.RELEASED;
}

/**
 * Creates protected-site enrollment with browser-permission rollback.
 * @param options - Editor and browser permission dependencies.
 * @return Protected-site enrollment operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedSiteEnrollmentService(
	options: ProtectedSiteEnrollmentServiceOptions,
): ProtectedSiteEnrollmentService {
	/**
	 * Adds one protected site after securing its required browser access.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own protection scope.
	 * @return Successful enrollment or a presentation-neutral failure.
	 * @since 0.1.0 Initial implementation.
	 */
	async function add(
		siteInput: unknown,
		independent: boolean,
	): Promise<ProtectedSiteEnrollmentResult> {
		const canonicalSite = canonicalizeProtectedSite( siteInput, DefaultProtectionScopeId );

		if ( canonicalSite.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			return {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
			};
		}
		const canonicalRule = canonicalSite.rule;

		const permissionResult = await options.permissionManager.request( canonicalRule );

		if ( permissionResult.status !== SitePermissionRequestStatus.GRANTED ) {
			return permissionResult.status === SitePermissionRequestStatus.DENIED
				? { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED }
				: { status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR };
		}

		let mutationFinalized = false;
		let permissionVerificationFailed = false;
		let permissionRetained = false;

		/**
		 * Verifies the complete grant again while configuration mutation coordination is held.
		 * @return Promise resolved only while the site remains protectable.
		 * @since 0.1.0 Initial implementation.
		 */
		async function verifyPermissionBeforePersistence(): Promise<void> {
			if ( await options.permissionManager.hasAccess( canonicalRule ) ) {
				return;
			}

			permissionVerificationFailed = true;
			throw new Error( 'Browser access changed before protected-site persistence.' );
		}

		/**
		 * Reports whether the configuration mutation reached its coordinated finalizer.
		 * @return Whether authoritative finalization completed.
		 * @since 0.1.0 Initial implementation.
		 */
		function wasMutationFinalized(): boolean {
			return mutationFinalized;
		}

		/**
		 * Reports whether the coordinated pre-persist permission verification failed.
		 * @return Whether permission access changed before persistence.
		 * @since 0.1.0 Initial implementation.
		 */
		function didPermissionVerificationFail(): boolean {
			return permissionVerificationFailed;
		}

		/**
		 * Reports whether failed enrollment left unnecessary browser access behind.
		 * @return Whether the browser retained an unnecessary grant.
		 * @since 0.1.0 Initial implementation.
		 */
		function wasPermissionRetained(): boolean {
			return permissionRetained;
		}

		/**
		 * Restores a new grant after a rejected or failed edit while authoritative coordination is held.
		 * @param settlement - Fresh edit settlement from the configuration editor.
		 * @return Promise resolved after any required permission release.
		 * @since 0.1.0 Initial implementation.
		 */
		const finalizeEdit: ProtectionConfigurationEditFinalizer = async ( settlement ): Promise<void> => {
			mutationFinalized = true;

			if ( settlement.result?.status === ProtectionConfigurationEditStatus.UPDATED ) {
				return;
			}

			permissionRetained = await reconcilePermissionAfterFailure(
				options,
				canonicalRule,
				permissionResult.provenance,
				settlement.configuration,
			);
		};

		let editResult: ProtectionConfigurationEditResult;

		try {
			editResult = await options.editor.add(
				siteInput,
				independent,
				verifyPermissionBeforePersistence,
				finalizeEdit,
			);
		} catch {
			if ( didPermissionVerificationFail() ) {
				return {
					status: wasPermissionRetained()
						? ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED
						: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
				};
			}

			return {
				status: wasPermissionRetained() ||
					( permissionResult.provenance !== SitePermissionGrantProvenance.EXISTING &&
						! wasMutationFinalized() )
					? ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED
					: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
			};
		}

		if ( editResult.status === ProtectionConfigurationEditStatus.REJECTED ) {
			return wasPermissionRetained()
				? { status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED }
				: {
					status: ProtectedSiteEnrollmentStatus.REJECTED,
					reason: editResult.reason,
				};
		}

		return {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			configuration: editResult.configuration,
			site: ProtectedSiteConfigurationSchema.parse(
				editResult.configuration.sites.find(
					( site ) => site.identityHost === canonicalSite.identityHost,
				),
			),
		};
	}

	/**
	 * Removes one protected site and reconciles its browser access inside configuration coordination.
	 * @param site - Protected-site configuration selected for removal.
	 * @return Successful removal and permission outcome, or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function remove(
		site: Parameters<ProtectedSiteEnrollmentService[ 'remove' ]>[ 0 ],
	): Promise<ProtectedSiteRemovalResult> {
		let permissionReleaseStatus: SitePermissionReleaseStatus = SitePermissionReleaseStatus.RELEASED;
		let removedSite: ProtectedSiteConfiguration | null = null;

		/**
		 * Releases obsolete browser access before the coordinated removal lock is released.
		 * @param settlement - Fresh edit settlement from the configuration editor.
		 * @return Promise resolved after any required permission release.
		 * @since 0.1.0 Initial implementation.
		 */
		const finalizeEdit: ProtectionConfigurationRemovalFinalizer = async (
			settlement,
		): Promise<void> => {
			removedSite = settlement.removedSite;

			if ( settlement.result?.status !== ProtectionConfigurationEditStatus.UPDATED ) {
				return;
			}

			const authoritativeRemovedSite = ProtectedSiteConfigurationSchema.parse(
				settlement.removedSite,
			);

			permissionReleaseStatus = await options.permissionManager.release(
				authoritativeRemovedSite.rule,
				settlement.result.configuration.sites.length > 0,
			);
		};
		const editResult = await options.editor.remove( site.identityHost, finalizeEdit );

		return editResult.status === ProtectionConfigurationEditStatus.REJECTED
			? editResult
			: {
				status: ProtectedSiteEnrollmentStatus.REMOVED,
				configuration: editResult.configuration,
				permissionReleaseStatus,
				site: ProtectedSiteConfigurationSchema.parse( removedSite ),
			};
	}

	return { add, remove };
}

export * from './types';
