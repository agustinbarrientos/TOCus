import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import type { SiteDisplayNameResolutionInput } from '../../../protected-sites/utils/site-display-name-resolver';
import { PopupOperationError, type PopupShellCopy } from '../../components/shell/types';
import { PopupTimerPhase, PopupScheduleStatus, PopupCurrentSiteAccess, PopupCurrentSiteStatus, type PopupActiveScope } from '../../types/popup-projection';
import type { PopupIdentifiedCurrentSite } from './types';

/**
 * Resolves identity metadata without creating or persisting a protection rule.
 * @param current - Current site with validated host metadata.
 * @return Name-resolution input using the existing rule or a display-only boundary.
 * @since 0.1.0
 */
export function getPopupSiteIdentityInput( current: PopupIdentifiedCurrentSite ): SiteDisplayNameResolutionInput {
	if ( current.status === PopupCurrentSiteStatus.PROTECTED ) {
		return current.site;
	}
	return {
		identityHost: current.identityHost,
		rule: { host: current.identityHost, includeSubdomains: false, scopeId: DefaultProtectionScopeId },
	};
}

/**
 * Finds the current site's authoritative timer without showing another site's countdown.
 * @param current - Current website identity and optional scope membership.
 * @param scopes - Active background-owned timers.
 * @return Current scope timer, or undefined when the current site has no active timer.
 * @since 0.1.0
 */
export function getPopupCurrentScope(
	current: PopupIdentifiedCurrentSite,
	scopes: readonly PopupActiveScope[],
): PopupActiveScope | undefined {
	if ( current.status !== PopupCurrentSiteStatus.PROTECTED ) {
		return undefined;
	}
	return scopes.find( ( scope ) => scope.isCurrentScope && scope.scopeId === current.scopeId );
}

/**
 * Explains current-site protection without repeating an allowance countdown.
 * @param current - Current site and its access/schedule status.
 * @param scope - Current site's active timer, when present.
 * @param copy - Active-language status messages.
 * @return Plain status copy, or null when the countdown already supplies the status.
 * @since 0.1.0
 */
export function getPopupSiteStatus(
	current: PopupIdentifiedCurrentSite,
	scope: PopupActiveScope | undefined,
	copy: Readonly<PopupShellCopy>,
): string | null {
	if ( current.status === PopupCurrentSiteStatus.UNPROTECTED ) {
		return copy.siteNotOnList;
	}
	if ( current.access === PopupCurrentSiteAccess.MISSING ) {
		return copy.browserAccessNeeded;
	}
	if ( scope?.phase === PopupTimerPhase.WAITING ) {
		return copy.pauseInProgress;
	}
	if ( scope?.phase === PopupTimerPhase.ALLOWANCE ) {
		return null;
	}
	if ( current.schedule === PopupScheduleStatus.INACTIVE ) {
		return copy.offRightNow;
	}
	if ( current.schedule === PopupScheduleStatus.UNAVAILABLE ) {
		return copy.statusUnavailable;
	}
	return copy.tocusActive;
}

/**
 * Projects timer text from the authoritative wait or allowance without advancing either.
 * @param scope - Current site's active timer, when present.
 * @param nowEpochMilliseconds - Controller-provided display clock.
 * @return Nonnegative remaining duration, or null when no timer is active.
 * @since 0.1.0
 */
export function getPopupRemainingTime(
	scope: PopupActiveScope | undefined,
	nowEpochMilliseconds: number,
): number | null {
	if ( scope?.phase === PopupTimerPhase.ALLOWANCE ) {
		return Math.max( 0, scope.expiresAtEpochMilliseconds - nowEpochMilliseconds );
	}
	return scope?.phase === PopupTimerPhase.WAITING ? scope.remainingMilliseconds : null;
}

/**
 * Maps a recoverable enrollment outcome to its actionable localized explanation.
 * @param error - Controller-owned enrollment failure.
 * @param copy - Active-language error messages.
 * @return Explanation appropriate to permission denial, retention, or persistence failure.
 * @since 0.1.0
 */
export function getPopupOperationMessage( error: PopupOperationError, copy: Readonly<PopupShellCopy> ): string {
	switch ( error ) {
		case PopupOperationError.PERMISSION_DENIED:
			return copy.permissionDeniedError;
		case PopupOperationError.PERMISSION_ERROR:
			return copy.permissionError;
		case PopupOperationError.PERMISSION_RETAINED:
			return copy.permissionRetainedError;
		case PopupOperationError.SAVE_ERROR:
			return copy.saveError;
	}
}

export * from './types';
