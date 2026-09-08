import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor/types';
import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment/types';
import type { ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import type { UnsuccessfulProtectedSiteEnrollmentResult } from '../../../protected-sites/services/protected-site-enrollment';
import { OnboardingFailure } from '../../types/flow';

/**
 * Filters drafts against the latest persisted collection before enrollment.
 * @since 0.1.0
 * @param persisted - Current page-port sites, which may have changed in another surface.
 * @param drafts - Unsaved local additions.
 * @return Only additions that still need browser access and persistence.
 */
export function pendingSiteDrafts(
	persisted: readonly ProtectedSiteConfiguration[], drafts: readonly ProtectedSiteConfiguration[],
): ProtectedSiteConfiguration[] {
	const savedHosts = new Set( persisted.map( ( site ) => site.identityHost ) );
	return drafts.filter( ( draft ) => ! savedHosts.has( draft.identityHost ) );
}

/**
 * Combines authoritative sites and unique local additions for display and validation.
 * @since 0.1.0
 * @param persisted - Current saved configurations.
 * @param drafts - Local additions retained across earlier-step navigation.
 * @return Saved sites followed by additions absent from persistence.
 */
export function mergeOnboardingSites(
	persisted: readonly ProtectedSiteConfiguration[], drafts: readonly ProtectedSiteConfiguration[],
): ProtectedSiteConfiguration[] {
	return [ ...persisted, ...pendingSiteDrafts( persisted, drafts ) ];
}

/**
 * Preserves enrollment failure distinctions as language-independent copy keys.
 * @since 0.1.0
 * @param result - Unsuccessful result from the existing enrollment service.
 * @return The corresponding localized failure key.
 */
export function enrollmentFailureKey( result: UnsuccessfulProtectedSiteEnrollmentResult ): OnboardingFailure {
	switch ( result.status ) {
		case ProtectedSiteEnrollmentStatus.PERMISSION_DENIED: return OnboardingFailure.PERMISSION_DENIED;
		case ProtectedSiteEnrollmentStatus.PERMISSION_ERROR: return OnboardingFailure.PERMISSION_REQUEST;
		case ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED: return OnboardingFailure.PERMISSION_RETAINED;
		case ProtectedSiteEnrollmentStatus.SAVE_ERROR: return OnboardingFailure.SAVE;
		case ProtectedSiteEnrollmentStatus.REJECTED:
			if ( result.reason === ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED ) {
				return OnboardingFailure.ALREADY_PROTECTED;
			}
			if ( result.reason === ProtectionConfigurationEditRejectionReason.INVALID_SITE ) {
				return OnboardingFailure.INVALID_SITE;
			}
			return OnboardingFailure.SAVE;
	}
}
