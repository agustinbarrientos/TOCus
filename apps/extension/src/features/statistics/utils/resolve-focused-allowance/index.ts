import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { type FocusedAllowanceIdentity } from '../../../../domains/statistics/types/focused-allowance';
import { getRuntimeTabId } from '../../../protection-runtime/utils/runtime-page-context';
import { type ResolveFocusedAllowanceInput } from './types';

/**
 * Selects the effective URL for one focused tab observation.
 * @param input - Current browser and protection observations.
 * @param focusedTabId - Browser-assigned focused tab identifier.
 * @return Explicit navigating, pending, or committed URL when observable.
 * @since 0.1.0 Initial implementation.
 */
function getFocusedTabUrl(
	input: ResolveFocusedAllowanceInput,
	focusedTabId: number,
): string | undefined {
	const focusedTab = input.tabs.find( ( tab ) => tab.id === focusedTabId );

	if ( focusedTab?.incognito !== false ) {
		return undefined;
	}

	const navigation = input.navigation;

	return navigation?.frameId === 0 && navigation.tabId === focusedTabId
		? navigation.url
		: focusedTab.pendingUrl ?? focusedTab.url;
}

/**
 * Resolves the allowance receiving confirmed focus without retaining browsing details.
 * @param input - Current browser, configuration, state, and clock observations.
 * @return Current allowance measurement identity, or null when focus is ineligible.
 * @since 0.1.0 Initial implementation.
 */
export function resolveFocusedAllowance(
	input: ResolveFocusedAllowanceInput,
): FocusedAllowanceIdentity | null {
	const focusedTabId = input.focusedTabId;

	if ( focusedTabId === null ) {
		return null;
	}

	const focusedUrl = getFocusedTabUrl( input, focusedTabId );

	if ( focusedUrl === undefined ) {
		return null;
	}

	const match = matchProtectedUrl(
		focusedUrl,
		input.configuration.sites.map( ( site ) => site.rule ),
	);

	if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
		return null;
	}

	const scopeId = match.rule.scopeId;
	const state = Object.hasOwn( input.statesByScope, scopeId )
		? input.statesByScope[ scopeId ]
		: undefined;
	const measurementRevision = Object.hasOwn(
		input.configuration.measurementRevisionsByScope,
		scopeId,
	)
		? input.configuration.measurementRevisionsByScope[ scopeId ]
		: undefined;
	const statisticsScope = Object.hasOwn( input.statisticsDocument.scopes, scopeId )
		? input.statisticsDocument.scopes[ scopeId ]
		: undefined;
	const activeMeasurement = statisticsScope?.activeAllowance;
	const focusedTabAwaitsContinuation = state?.type === ProtectionStateType.ALLOWANCE &&
		state.readyParticipants.some(
			( participant ) => getRuntimeTabId( participant.pageId ) === focusedTabId,
		);

	if (
		state?.type !== ProtectionStateType.ALLOWANCE ||
		focusedTabAwaitsContinuation ||
		input.nowEpochMilliseconds >= state.expiresAtEpochMilliseconds ||
		measurementRevision === undefined ||
		statisticsScope?.currentMeasurementRevision !== measurementRevision ||
		activeMeasurement?.measurementRevision !== measurementRevision ||
		activeMeasurement.allowanceId !== state.allowanceId ||
		input.nowEpochMilliseconds >= activeMeasurement.expiresAtEpochMilliseconds
	) {
		return null;
	}

	return {
		scopeId,
		measurementRevision,
		allowanceId: state.allowanceId,
	};
}

export * from './types';
