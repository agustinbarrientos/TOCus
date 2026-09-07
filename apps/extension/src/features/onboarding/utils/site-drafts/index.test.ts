import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor/types';
import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment/types';
import { OnboardingFailure } from '../../types/flow';
import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import type { ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { pendingSiteDrafts, mergeOnboardingSites, enrollmentFailureKey } from './index';

/**
 * Creates a canonical test site with the same default scope as onboarding drafts.
 * @param host - Canonical identity host.
 * @return Minimal complete protected-site configuration.
 */
function site( host: string ): ProtectedSiteConfiguration {
	return { identityHost: host, rule: { host, includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
}

describe( 'onboarding site draft boundaries', () => {
	it( 'omits a draft once another surface has persisted that site', () => {
		const github = site( 'github.com' );
		const reddit = site( 'reddit.com' );
		expect( pendingSiteDrafts( [], [ github, reddit ] ) ).toEqual( [ github, reddit ] );
		expect( pendingSiteDrafts( [ github ], [ github, reddit ] ) ).toEqual( [ reddit ] );
		expect( mergeOnboardingSites( [ github ], [ github, reddit ] ) ).toEqual( [ github, reddit ] );
	} );
	it.each( [
		[ ProtectedSiteEnrollmentStatus.PERMISSION_DENIED, OnboardingFailure.PERMISSION_DENIED ],
		[ ProtectedSiteEnrollmentStatus.PERMISSION_ERROR, OnboardingFailure.PERMISSION_REQUEST ],
		[ ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED, OnboardingFailure.PERMISSION_RETAINED ],
		[ ProtectedSiteEnrollmentStatus.SAVE_ERROR, OnboardingFailure.SAVE ],
	] as const )( 'retains the distinct meaning of %s', ( status, expected ) => {
		expect( enrollmentFailureKey( { status } ) ).toBe( expected );
	} );
	it( 'distinguishes invalid and duplicate sites from other rejected writes', () => {
		expect( enrollmentFailureKey( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
		} ) ).toBe( OnboardingFailure.INVALID_SITE );
		expect( enrollmentFailureKey( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} ) ).toBe( OnboardingFailure.ALREADY_PROTECTED );
		expect( enrollmentFailureKey( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
		} ) ).toBe( OnboardingFailure.SAVE );
	} );
} );
