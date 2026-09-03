import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectionStateType, type ProtectionState } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import {
	createToolbarBadgeProjection,
	ToolbarBadgePhase,
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
} from '../../utils/toolbar-badge-projection';
import { findRuntimeParticipantContext } from '../../utils/runtime-page-context';
import {
	type ToolbarBadgeCoordinator,
	type ToolbarBadgeCoordinatorOptions,
	type ToolbarBadgeTab,
} from './types';

/**
 * Selects the active state represented by the current toolbar badge.
 * @param statesByScope - Current authoritative scope states.
 * @param configuration - Current local configuration.
 * @param tabs - Current browser tabs.
 * @param focusedTabId - Active tab in the focused browser window.
 * @param interruptionPageUrl - Extension-owned interruption page URL.
 * @param nowEpochMilliseconds - Current wall-clock time.
 * @return Selected active state, a multiple marker, or null when inactive.
 * @since 0.1.0 Initial implementation.
 */
function selectToolbarState(
	statesByScope: ProtectionCoordinatorStateSnapshot,
	configuration: ProtectionConfigurationDocument,
	tabs: ReadonlyArray<ToolbarBadgeTab>,
	focusedTabId: number | null,
	interruptionPageUrl: string,
	nowEpochMilliseconds: number,
): ProtectionState | number | null {
	const configuredScopeIds = new Set( configuration.sites.map( ( site ) => site.rule.scopeId ) );
	const activeStates = Object.values( statesByScope ).filter(
		( state ) => configuredScopeIds.has( state.scopeId ) && (
			state.type === ProtectionStateType.WAITING ||
			( state.type === ProtectionStateType.ALLOWANCE && nowEpochMilliseconds < state.expiresAtEpochMilliseconds )
		),
	);
	const [ firstActiveState ] = activeStates;

	if ( firstActiveState === undefined ) {
		return null;
	}

	if ( focusedTabId !== null ) {
		const participantContext = findRuntimeParticipantContext( statesByScope, focusedTabId );
		const focusedTab = tabs.find( ( tab ) => tab.id === focusedTabId );
		const focusedUrl = focusedTab?.pendingUrl ?? focusedTab?.url;
		const match = focusedUrl === undefined
			? null
			: matchProtectedUrl( focusedUrl, configuration.sites.map( ( site ) => site.rule ) );
		const focusedScopeId = match?.status === ProtectedUrlMatchStatus.PROTECTED
			? match.rule.scopeId
			: focusedUrl === undefined || focusedUrl === interruptionPageUrl
				? participantContext?.state.scopeId ?? null
				: null;
		const focusedState = activeStates.find( ( state ) => state.scopeId === focusedScopeId );

		if ( focusedState !== undefined ) {
			return focusedState;
		}
	}

	return activeStates.length === 1 ? firstActiveState : activeStates.length;
}

/**
 * Creates a browser-neutral badge for the selected toolbar state.
 * @param selectedState - Active state, multiple marker, or inactive marker.
 * @param nowEpochMilliseconds - Current wall-clock time.
 * @param copy - Localized toolbar copy, or undefined to use the default English copy.
 * @return Complete compact badge projection.
 * @since 0.1.0 Initial implementation.
 */
function createSelectedProjection(
	selectedState: ProtectionState | number | null,
	nowEpochMilliseconds: number,
	copy: ToolbarBadgeCopy | undefined,
): ToolbarBadgeProjection {
	if ( typeof selectedState === 'number' ) {
		return createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.MULTIPLE_ACTIVE,
			activeScopeCount: selectedState,
		}, copy );
	}

	if ( selectedState?.type === ProtectionStateType.WAITING ) {
		return createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.WAITING,
			remainingMilliseconds: selectedState.capturedWaitDurationMilliseconds -
				selectedState.confirmedFocusedDurationMilliseconds,
		}, copy );
	}

	if ( selectedState?.type === ProtectionStateType.ALLOWANCE ) {
		return createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			remainingMilliseconds: selectedState.expiresAtEpochMilliseconds - nowEpochMilliseconds,
		}, copy );
	}

	return createToolbarBadgeProjection( { phase: ToolbarBadgePhase.INACTIVE }, copy );
}

/**
 * Creates authoritative toolbar-badge coordination.
 * @param options - Browser tab, toolbar, and clock dependencies.
 * @return Toolbar badge refresh operation.
 * @since 0.1.0 Initial implementation.
 */
export function createToolbarBadgeCoordinator(
	options: ToolbarBadgeCoordinatorOptions,
): ToolbarBadgeCoordinator {
	/**
	 * Refreshes the global toolbar badge with the currently selected scope projection.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after the global toolbar badge is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refresh(
		configuration: ProtectionConfigurationDocument | null,
		statesByScope: ProtectionCoordinatorStateSnapshot | null,
	): Promise<void> {
		const [ tabsResult, focusedTabIdResult ] = await Promise.allSettled( [
			options.listTabs(),
			options.getFocusedTabId(),
		] );
		const tabs = tabsResult.status === 'fulfilled' ? tabsResult.value : [];
		const focusedTabId = tabsResult.status === 'fulfilled' && focusedTabIdResult.status === 'fulfilled'
			? focusedTabIdResult.value
			: null;
		const nowEpochMilliseconds = options.now();
		const selectedState = configuration === null || statesByScope === null
			? null
			: selectToolbarState(
				statesByScope,
				configuration,
				tabs,
				focusedTabId,
				options.interruptionPageUrl,
				nowEpochMilliseconds,
			);
		const projection = createSelectedProjection( selectedState, nowEpochMilliseconds, options.copy );

		await options.updateToolbarBadge( projection );
	}

	return { refresh };
}

export * from './types';
