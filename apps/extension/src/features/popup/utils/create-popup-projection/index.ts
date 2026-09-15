import { resolveSiteSchedule } from '../../../../domains/protection/utils/resolve-site-schedule';
import { isInterruptionDocumentUrl } from '../../../../shared/utils/interruption-document-url';
import {
	ProtectedSiteConfigurationSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { ProtectionStateType, type ProtectionState } from '../../../../domains/protection/types/protection-state';
import {
	DefaultProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { synchronizeDailyLadder } from '../../../../domains/protection/utils/daily-ladder-progression';
import { getNextWaitDuration } from '../../../../domains/protection/utils/wait-duration-calculator';
import {
	ProtectableUrlNormalizationStatus,
	normalizeProtectableUrl,
} from '../../../../domains/protection/utils/protectable-url-normalizer';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { findRuntimeParticipantContext } from '../../../protection-runtime/utils/runtime-page-context';
import { createRuntimeLocalDate } from '../../../protection-runtime/utils/runtime-local-date';
import {
	PopupCurrentSiteAccess,
	PopupCurrentSiteStatus,
	PopupActiveScopeSchema,
	PopupProjectionSchema,
	PopupProjectionStatus,
	PopupScheduleStatus,
	PopupScopeKind,
	PopupTimerPhase,
	type PopupActiveScope,
	type PopupCurrentSite,
	type PopupProjection,
} from '../../types/popup-projection';
import type {
	CreatePopupProjectionAvailableOptions,
	CreatePopupProjectionCurrentTabOptions,
	CreatePopupProjectionOptions,
	PopupActiveProtectionState,
	PopupWaitingProtectionState,
} from './types';

/**
 * Finds the stored website configuration that matches one protectable URL.
 * @param url - Current protectable top-level URL.
 * @param configuration - Persisted or permission-filtered configuration.
 * @return Matching website configuration, or null when the URL is not configured.
 * @since 0.1.0 Initial implementation.
 */
function findMatchingSite(
	url: string,
	configuration: ProtectionConfigurationDocument,
): ProtectionConfigurationDocument[ 'sites' ][ number ] | null {
	const result = matchProtectedUrl( url, configuration.sites.map( ( site ) => site.rule ) );

	if ( result.status !== ProtectedUrlMatchStatus.PROTECTED ) {
		return null;
	}

	return ProtectedSiteConfigurationSchema.parse( configuration.sites.find( ( site ) => (
		site.rule.host === result.rule.host &&
		site.rule.includeSubdomains === result.rule.includeSubdomains &&
		site.rule.scopeId === result.rule.scopeId
	) ) );
}

/**
 * Resolves the current website URL, including a destination retained by the interruption page.
 * @param options - Popup projection inputs.
 * @return Current protectable destination candidate, or null when no metadata is available.
 * @since 0.1.0 Initial implementation.
 */
function resolveCurrentUrl( options: CreatePopupProjectionCurrentTabOptions ): string {
	if ( ! isInterruptionDocumentUrl( options.currentTab.url, options.interruptionPageUrl ) ) {
		return options.currentTab.url;
	}

	const context = findRuntimeParticipantContext( options.snapshot.statesByScope, options.currentTab.id );

	return context?.participant.retainedDestination ?? options.currentTab.url;
}

/**
 * Converts one schedule evaluation into its popup presentation state.
 * @param configuration - Current active protection configuration.
 * @param ruleHost - Matching host whose active hours apply.
 * @param capturedAtEpochMilliseconds - Snapshot wall-clock instant.
 * @param timeZone - Snapshot IANA time zone.
 * @return Current schedule state for presentation.
 * @since 0.1.0 Initial implementation.
 */
function resolveScheduleStatus(
	configuration: ProtectionConfigurationDocument,
	ruleHost: string,
	capturedAtEpochMilliseconds: number,
	timeZone: string,
): PopupScheduleStatus {
	const schedule = resolveSiteSchedule( configuration, ruleHost );
	const result = evaluateSchedule( schedule, capturedAtEpochMilliseconds, timeZone );

	if ( result.status === ScheduleEvaluationStatus.ACTIVE ) {
		return PopupScheduleStatus.ACTIVE;
	}

	return result.status === ScheduleEvaluationStatus.INACTIVE
		? PopupScheduleStatus.INACTIVE
		: PopupScheduleStatus.UNAVAILABLE;
}

/**
 * Returns whether one runtime state contains a timer that remains active in the snapshot.
 * @param state - Current state for one configured scope.
 * @param capturedAtEpochMilliseconds - Snapshot wall-clock instant.
 * @return Whether the state contains a visible active timer.
 * @since 0.1.0 Initial implementation.
 */
function hasActiveTimer(
	state: ProtectionState,
	capturedAtEpochMilliseconds: number,
): state is PopupActiveProtectionState {
	return state.type === ProtectionStateType.WAITING || (
		state.type === ProtectionStateType.ALLOWANCE &&
		state.expiresAtEpochMilliseconds > capturedAtEpochMilliseconds
	);
}

/**
 * Returns the focused duration remaining for one Waiting timer.
 * @param state - Current Waiting state.
 * @return Nonnegative remaining focused duration.
 * @since 0.1.0 Initial implementation.
 */
function getRemainingMilliseconds(
	state: PopupWaitingProtectionState,
): number {
	return Math.max( 0, state.capturedWaitDurationMilliseconds - state.confirmedFocusedDurationMilliseconds );
}

/**
 * Calculates the next daily-ladder wait at the snapshot's local date.
 * @param options - Popup projection inputs with an available runtime snapshot.
 * @param state - Current scope state, or undefined before the scope creates state.
 * @return Next wait duration for the current local date.
 * @since 0.1.0 Initial implementation.
 */
function resolveNextWaitMilliseconds(
	options: CreatePopupProjectionAvailableOptions,
	state: ProtectionState | undefined,
): number {
	const localDate = createRuntimeLocalDate(
		options.snapshot.capturedAtEpochMilliseconds,
		options.snapshot.timeZone,
	);
	const ladder = state === undefined
		? { completedWaits: 0, greatestObservedLocalDate: localDate }
		: synchronizeDailyLadder( state.ladder, localDate );

	return getNextWaitDuration( options.snapshot.configuration.timingConfiguration, ladder );
}

/**
 * Projects the one shared countdown when it has an active timer.
 * @param options - Popup projection inputs with an available runtime snapshot.
 * @param isCurrentScope - Whether the current website belongs to the shared countdown.
 * @return The shared Waiting or Allowance timer, or an empty list.
 * @since 0.1.0 Initial implementation.
 */
function createActiveScopes(
	options: CreatePopupProjectionAvailableOptions,
	isCurrentScope: boolean,
): PopupActiveScope[] {
	const { activeConfiguration, capturedAtEpochMilliseconds, statesByScope } = options.snapshot;
	if ( activeConfiguration === null || activeConfiguration.sites.length === 0 ) {
		return [];
	}

	const state = statesByScope[ DefaultProtectionScopeId ];
	if ( state === undefined || ! hasActiveTimer( state, capturedAtEpochMilliseconds ) ) {
		return [];
	}
	const commonProjection = {
		scopeId: state.scopeId, kind: PopupScopeKind.SHARED,
		siteCount: activeConfiguration.sites.length, site: null, isCurrentScope,
	};
	return [ PopupActiveScopeSchema.parse( state.type === ProtectionStateType.WAITING ? {
		...commonProjection, phase: PopupTimerPhase.WAITING,
		remainingMilliseconds: getRemainingMilliseconds( state ),
	} : {
		...commonProjection, phase: PopupTimerPhase.ALLOWANCE,
		expiresAtEpochMilliseconds: state.expiresAtEpochMilliseconds,
	} ) ];
}

/**
 * Projects the current website from persisted configuration and active runtime state.
 * @param options - Popup projection inputs with an available runtime snapshot.
 * @param currentUrl - Current or recovered top-level destination.
 * @return Current website presentation state.
 * @since 0.1.0 Initial implementation.
 */
function createCurrentSite(
	options: CreatePopupProjectionCurrentTabOptions,
	currentUrl: string,
): PopupCurrentSite {
	if ( options.currentTab.incognito ) {
		return { status: PopupCurrentSiteStatus.UNSUPPORTED };
	}

	const normalizedUrl = normalizeProtectableUrl( currentUrl );

	if ( normalizedUrl.status !== ProtectableUrlNormalizationStatus.NORMALIZED ) {
		return { status: PopupCurrentSiteStatus.UNSUPPORTED };
	}

	const configuredSite = findMatchingSite( currentUrl, options.snapshot.configuration );

	if ( configuredSite === null ) {
		return {
			status: PopupCurrentSiteStatus.UNPROTECTED,
			identityHost: normalizedUrl.host,
		};
	}

	const activeConfiguration = options.snapshot.activeConfiguration;
	const activeSite = activeConfiguration === null
		? null
		: findMatchingSite( currentUrl, activeConfiguration );
	const access = activeSite === null ? PopupCurrentSiteAccess.MISSING : PopupCurrentSiteAccess.GRANTED;
	const schedule = activeConfiguration === null || activeSite === null
		? PopupScheduleStatus.UNAVAILABLE
		: resolveScheduleStatus(
			activeConfiguration,
			configuredSite.rule.host,
			options.snapshot.capturedAtEpochMilliseconds,
			options.snapshot.timeZone,
		);
	const state = options.snapshot.statesByScope[ configuredSite.rule.scopeId ];
	const nextWaitMilliseconds = access === PopupCurrentSiteAccess.GRANTED &&
		schedule === PopupScheduleStatus.ACTIVE &&
		state?.type !== ProtectionStateType.READY &&
		( state === undefined || ! hasActiveTimer( state, options.snapshot.capturedAtEpochMilliseconds ) )
		? resolveNextWaitMilliseconds( options, state )
		: null;

	return {
		status: PopupCurrentSiteStatus.PROTECTED,
		site: {
			...configuredSite,
			identityHost: normalizedUrl.host,
		},
		scopeId: configuredSite.rule.scopeId,
		access,
		schedule,
		nextWaitMilliseconds,
	};
}

/**
 * Creates one validated, privacy-safe popup projection from current runtime state.
 * @param options - Runtime snapshot, current tab metadata, and interruption page identity.
 * @return Deterministic popup presentation without retained navigation URLs.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupProjection( options: CreatePopupProjectionOptions ): PopupProjection {
	if ( options.snapshot === null ) {
		return PopupProjectionSchema.parse( { status: PopupProjectionStatus.UNAVAILABLE } );
	}

	const availableOptions: CreatePopupProjectionAvailableOptions = {
		...options,
		snapshot: options.snapshot,
	};
	let currentSite: PopupCurrentSite;

	if ( options.currentTab === null ) {
		currentSite = { status: PopupCurrentSiteStatus.UNAVAILABLE };
	} else {
		const currentTabOptions: CreatePopupProjectionCurrentTabOptions = {
			...availableOptions,
			currentTab: options.currentTab,
		};

		currentSite = createCurrentSite( currentTabOptions, resolveCurrentUrl( currentTabOptions ) );
	}
	return PopupProjectionSchema.parse( {
		status: PopupProjectionStatus.AVAILABLE,
		capturedAtEpochMilliseconds: options.snapshot.capturedAtEpochMilliseconds,
		currentSite,
		activeScopes: createActiveScopes( availableOptions, currentSite.status === PopupCurrentSiteStatus.PROTECTED ),
	} );
}

export type {
	CreatePopupProjectionOptions,
} from './types';
