import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment/types';
import { useRef, useState } from 'react';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	ProtectedSiteConfigurationSetSchema,
	type ProtectedSiteConfiguration,
} from '../../../../domains/protection/types/protected-site-configuration';
import { canonicalizeProtectedSiteInputs, splitProtectedSiteInputs } from '../../../../domains/protection/utils/protected-site-input-list';
import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { SitePermissionReleaseStatus } from '../../../protected-sites/services/site-permission-manager';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import type { OnboardingPageShell } from '../onboarding-page/types';
import { enrollmentFailureKey, getSiteDraftInput, mergeOnboardingSites, pendingSiteDrafts } from '../../utils/site-drafts';
import { OnboardingAnnouncementKind,
	type OnboardingAnnouncement, OnboardingFailure, type OnboardingOperationGate,
	type OnboardingSitesController, type OnboardingState,
	type OnboardingPendingRemoval,
} from '../../types/flow';

/**
 * Manages local site additions while delegating permission and persistence to existing services.
 * @since 1.0.0
 * @param state - Current render projection from the page service.
 * @param port - Live mutable page-service port, authoritative at mutation time.
 * @param operation - Shared synchronous pending gate.
 * @param complete - Emits completion once all additions are persisted.
 * @return Site presentation state and guarded operations.
 */
export function useOnboardingSites(
	state: Readonly<OnboardingState>, port: OnboardingPageShell, operation: OnboardingOperationGate,
	complete: () => void,
): OnboardingSitesController {
	const [ drafts, setDrafts ] = useState<ProtectedSiteConfiguration[]>( [] );
	const draftRef = useRef<ProtectedSiteConfiguration[]>( [] );
	const [ address, setAddressValue ] = useState( '' );
	const [ failure, setFailure ] = useState<OnboardingFailure | null>( null );
	const [ invalidInputs, setInvalidInputs ] = useState<string[]>( [] );
	const [ announcement, setAnnouncement ] = useState<OnboardingAnnouncement | null>( null );
	const [ pendingRemoval, setPendingRemoval ] = useState<OnboardingPendingRemoval | null>( null );
	const addressInputRef = useRef<HTMLInputElement>( null );
	const sites = mergeOnboardingSites( state.protectedSites, drafts );
	if ( pendingRemoval && ! sites.some( ( site ) =>
		getProtectedSiteRuleKey( site.rule ) === getProtectedSiteRuleKey( pendingRemoval.site.rule ) ) ) {
		sites.splice( pendingRemoval.index, 0, pendingRemoval.site );
	}

	/**
	 * Keeps local draft reads current even before React's next render.
	 * @param next - Complete next local draft collection.
	 */
	function replaceDrafts( next: ProtectedSiteConfiguration[] ): void {
		draftRef.current = next;
		setDrafts( next );
	}

	/**
	 * Drops any local draft for a removed saved site or unsaved addition.
	 * @param site - Canonical target to remove from local drafts.
	 */
	function removeDraft( site: ProtectedSiteConfiguration ): void {
		const key = getProtectedSiteRuleKey( site.rule );
		replaceDrafts( draftRef.current.filter( ( candidate ) => getProtectedSiteRuleKey( candidate.rule ) !== key ) );
	}

	/**
	 * Produces replayable, language-independent status feedback.
	 * @param kind - Semantic result of the site action.
	 * @param name - Existing display identity for the affected site.
	 * @param count - Number of newly added sites for an optional batch announcement.
	 */
	function announce( kind: OnboardingAnnouncement['kind'], name: string, count = 1 ): void {
		setAnnouncement( ( previous ) => ( { kind, name, count, sequence: ( previous?.sequence ?? 0 ) + 1 } ) );
	}

	/**
	 * Updates address input only while the form is editable.
	 * @param value - Current address field value.
	 */
	function setAddress( value: string ): void {
		if ( ! operation.isPending() ) {
			setAddressValue( value );
		}
	}

	/**
	 * Validates a complete address batch before adding unique local drafts without browser permission.
	 * @param input - Comma-separated addresses entered manually, or one selected suggestion.
	 */
	function addSite( input: string ): void {
		if ( operation.isPending() ) {
			return;
		}
		setFailure( null );
		setInvalidInputs( [] );
		setAnnouncement( null );
		const result = canonicalizeProtectedSiteInputs( input, DefaultProtectionScopeId );
		if ( result.invalidInputs.length > 0 || result.sites.length === 0 ) {
			setFailure( OnboardingFailure.INVALID_SITE );
			setInvalidInputs( splitProtectedSiteInputs( input ).length > 1 ? result.invalidInputs : [] );
			return;
		}
		const current = mergeOnboardingSites( port.protectedSites, draftRef.current );
		const additions = pendingSiteDrafts( current, result.sites );
		const firstSite = additions[ 0 ];
		if ( ! firstSite || ! ProtectedSiteConfigurationSetSchema.safeParse( [ ...current, ...additions ] ).success ) {
			setFailure( OnboardingFailure.ALREADY_PROTECTED );
			return;
		}
		replaceDrafts( [ ...draftRef.current, ...additions ] );
		setAddressValue( '' );
		announce( OnboardingAnnouncementKind.ADDED, resolveSiteDisplayIdentity( firstSite ).name, additions.length );
	}

	/**
	 * Restores removed-row focus inside this onboarding form after React updates its rows.
	 * @param index - Original row index before removal.
	 * @param source - Original action, used to avoid reclaiming focus from another control.
	 */
	function restoreRowFocus( index: number, source: HTMLButtonElement ): void {
		requestAnimationFrame( () => {
			const active = source.ownerDocument.activeElement;
			if ( active !== source && active !== source.ownerDocument.body ) {
				return;
			}
			const form = addressInputRef.current?.closest( '.onboarding-form' );
			const buttons = form?.querySelectorAll<HTMLButtonElement>( '.onboarding-remove' );
			const next = buttons?.item( Math.max( 0, Math.min( index, buttons.length - 1 ) ) );
			( next ?? addressInputRef.current )?.focus();
		} );
	}

	/**
	 * Removes one local or persisted site while preserving permission-release feedback.
	 * @param site - Selected current site configuration.
	 * @param source - Optional focused removal action for scoped focus restoration.
	 * @return Completion of the existing enrollment operation and its state projection.
	 */
	async function removeSite( site: ProtectedSiteConfiguration, source?: HTMLButtonElement ): Promise<void> {
		if ( operation.isPending() ) {
			return;
		}
		const current = mergeOnboardingSites( port.protectedSites, draftRef.current );
		const key = getProtectedSiteRuleKey( site.rule );
		const index = current.findIndex( ( candidate ) => getProtectedSiteRuleKey( candidate.rule ) === key );
		const restoreFocus = source !== undefined && source === source.ownerDocument.activeElement;
		const name = resolveSiteDisplayIdentity( site ).name;
		const persisted = port.protectedSites.some( ( candidate ) =>
			getProtectedSiteRuleKey( candidate.rule ) === key );
		setFailure( null );
		if ( ! persisted ) {
			removeDraft( site );
			announce( OnboardingAnnouncementKind.REMOVED, name );
		} else {
			if ( ! port.enrollment || ! operation.begin() ) {
				return;
			}
			setPendingRemoval( { site, index } );
			try {
				const result = await port.enrollment.remove( site );
				if ( result.status !== ProtectedSiteEnrollmentStatus.REMOVED ) {
					setFailure( OnboardingFailure.REMOVAL );
					return;
				}
				port.protectedSites = result.configuration.sites;
				removeDraft( site );
				const kind = result.permissionReleaseStatus === SitePermissionReleaseStatus.RELEASED
					? OnboardingAnnouncementKind.REMOVED : OnboardingAnnouncementKind.RETAINED;
				announce( kind, name );
			} catch {
				setFailure( OnboardingFailure.REMOVAL );
				return;
			} finally {
				setPendingRemoval( null );
				operation.end();
			}
		}
		if ( restoreFocus ) {
			restoreRowFocus( index, source );
		}
	}

	/**
	 * Batches remaining drafts from the live port without losing the initiating user gesture.
	 * @return Completion after enrollment succeeds, or retained drafts plus failure feedback.
	 */
	async function finish(): Promise<void> {
		if ( operation.isPending() ) {
			return;
		}
		const additions = pendingSiteDrafts( port.protectedSites, draftRef.current );
		if ( additions.length === 0 ) {
			if ( port.protectedSites.length > 0 ) {
				complete();
			}
			return;
		}
		if ( ! port.enrollment || ! operation.begin() ) {
			return;
		}
		setFailure( null );
		try {
			// addMany must begin synchronously here, before the first await, to retain browser user activation.
			const result = await port.enrollment.addMany( additions.map( getSiteDraftInput ) );
			if ( result.status === ProtectedSiteEnrollmentStatus.ADDED ) {
				port.protectedSites = result.configuration.sites;
				replaceDrafts( [] );
				complete();
			} else {
				setFailure( enrollmentFailureKey( result ) );
			}
		} catch {
			setFailure( OnboardingFailure.UNEXPECTED );
		} finally {
			operation.end();
		}
	}

	return { sites, drafts, address, failure, invalidInputs, announcement, addressInputRef,
		setAddress, addSite, removeSite, finish };
}
