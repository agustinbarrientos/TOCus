import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor/types';
import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment/types';
import { OnboardingFailure } from '../../types/flow';
import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	TestEmptyProtectionConfiguration,
	createTestProtectionMeasurementRevision,
} from '../../../../domains/protection/types/__fixtures__';
import { createProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import {
	canonicalizeProtectedSite,
	ProtectedSiteCanonicalizationStatus,
} from '../../../../domains/protection/utils/protected-site-canonicalizer';
import { pendingSiteDrafts, mergeOnboardingSites, enrollmentFailureKey, getSiteDraftInput } from './index';

/**
 * Creates a canonical test site with the same default scope as onboarding drafts.
 * @param host - Canonical identity host.
 * @return Minimal complete protected-site configuration.
 */
function site( host: string ): ProtectedSiteConfiguration {
	return { identityHost: host, rule: { host, includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
}

/**
 * Creates the public editor with deterministic local persistence for enrollment handoff tests.
 * @param sites - Previously persisted canonical targets.
 * @return Real editor and its current persisted configuration reader.
 */
function createEditor( sites: ProtectedSiteConfiguration[] = [] ) {
	let configuration = { ...TestEmptyProtectionConfiguration, sites };
	const editor = createProtectionConfigurationEditor( {
		storage: {
			/** @return Current persisted configuration. */
			load: () => Promise.resolve( configuration ),
			/**
			 * Saves one validated edit.
			 * @param input - Candidate configuration to persist.
			 * @return Completion after the in-memory write.
			 */
			save: ( input ) => {
				configuration = ProtectionConfigurationDocumentSchema.parse( input );
				return Promise.resolve();
			},
		},
		/**
		 * Executes one isolated test edit.
		 * @param mutation - Editor mutation.
		 * @return The authoritative mutation result.
		 */
		coordinateMutation: ( mutation ) => mutation(),
		createMeasurementRevision: createTestProtectionMeasurementRevision,
	} );
	return {
		editor,
		/** @return Current persisted configuration. */
		read: () => configuration,
	};
}

describe( 'onboarding site draft boundaries', () => {
	it.each( [
		{ ...site( 'github.com' ), rule: { ...site( 'github.com' ).rule, pathPrefix: '/team' } },
		{ ...site( 'example.com' ), identityHost: 'www.example.com',
			rule: { ...site( 'example.com' ).rule, pathPrefix: '/team%2Fprivate' } },
		{ ...site( 'mail.google.com' ),
			rule: { ...site( 'mail.google.com' ).rule, includeSubdomains: false, pathPrefix: '/inbox' } },
		{ ...site( '[::1]' ), rule: { ...site( '[::1]' ).rule, includeSubdomains: false, pathPrefix: '/team' } },
		site( 'example.com' ),
	] )( 'retains the canonical target when submitting $identityHost', ( draft ) => {
		expect( canonicalizeProtectedSite( getSiteDraftInput( draft ), DefaultProtectionScopeId ) ).toEqual( {
			status: ProtectedSiteCanonicalizationStatus.ACCEPTED,
			identityHost: draft.identityHost,
			rule: draft.rule,
		} );
	} );
	it( 'enrolls a first path with a paused path and a real no-pause parent', async () => {
		const draft = { ...site( 'github.com' ), rule: { ...site( 'github.com' ).rule, pathPrefix: '/team' } };
		const { editor, read } = createEditor();
		await editor.addMany( pendingSiteDrafts( [], [ draft ] ).map( getSiteDraftInput ) );
		expect( read().sites ).toEqual( [ draft, {
			...site( 'github.com' ), rule: { ...site( 'github.com' ).rule, behavior: 'allow' },
		} ] );
	} );
	it.each( [ false, true ] )( 'preserves a selected paused parent in the same batch, reversed: %s', async ( reversed ) => {
		const parent = site( 'github.com' );
		const child = { ...parent, rule: { ...parent.rule, pathPrefix: '/team' } };
		const drafts = reversed ? [ child, parent ] : [ parent, child ];
		const { editor, read } = createEditor();
		await editor.addMany( pendingSiteDrafts( [], drafts ).map( getSiteDraftInput ) );
		expect( read().sites ).toEqual( drafts );
	} );
	it.each( [ undefined, '/other' ] )( 'retains a new path beside an existing same-host target: %s', async ( pathPrefix ) => {
		const parent = site( 'github.com' );
		const saved = pathPrefix === undefined ? parent : { ...parent, rule: { ...parent.rule, pathPrefix } };
		const child = { ...parent, rule: { ...parent.rule, pathPrefix: '/team' } };
		expect( pendingSiteDrafts( [ saved ], [ child ] ) ).toEqual( [ child ] );
		expect( mergeOnboardingSites( [ saved ], [ child ] ) ).toEqual( [ saved, child ] );
		const { editor, read } = createEditor( [ saved ] );
		await editor.addMany( pendingSiteDrafts( [ saved ], [ child ] ).map( getSiteDraftInput ) );
		expect( read().sites ).toContainEqual( saved );
		expect( read().sites ).toContainEqual( child );
	} );
	it.each( [ undefined, '/team' ] )( 'omits the same canonical target across www identities: %s', ( pathPrefix ) => {
		const parent = site( 'github.com' );
		const saved = pathPrefix === undefined ? parent : { ...parent, rule: { ...parent.rule, pathPrefix } };
		const draft = { ...saved, identityHost: 'www.github.com' };
		expect( pendingSiteDrafts( [ saved ], [ draft ] ) ).toEqual( [] );
		expect( mergeOnboardingSites( [ saved ], [ draft ] ) ).toEqual( [ saved ] );
	} );
	it( 'keeps distinct exact-host and subdomain coverage targets', () => {
		const broad = site( 'github.com' );
		const exact = { ...broad, rule: { ...broad.rule, includeSubdomains: false } };
		expect( pendingSiteDrafts( [ broad ], [ exact ] ) ).toEqual( [ exact ] );
	} );
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
