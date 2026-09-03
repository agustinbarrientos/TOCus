import { AllowanceWarningDecisionType } from '../../../../domains/protection/types/allowance-warning';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { type NormalizedSchedule } from '../../../../domains/protection/types/protection-schedule';
import {
	calculateAllowanceWarningInterval,
	type AllowanceWarningInterval,
} from '../../../../domains/protection/utils/allowance-warning-interval';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { selectAllowanceWarningDecision } from '../../../../domains/protection/utils/select-allowance-warning-decision';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import {
	ProtectedPageMessageType,
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from '../../types/protected-page-message';
import { createRuntimePageId } from '../../utils/runtime-page-context';
import {
	type AllowanceWarningReconciler,
	type AllowanceWarningReconcilerOptions,
} from './types';

/**
 * Returns the committed URL currently owned by one tab document.
 * @param tab - Fresh browser tab observation.
 * @return Committed URL, or undefined when browser access hides it.
 * @since 0.1.0 Initial implementation.
 */
function getObservedTabUrl( tab: ProtectionRuntimeTab ): string | undefined {
	return tab.url;
}

/**
 * Creates quiet allowance-warning reconciliation around browser observations and page effects.
 * @param options - Browser, clock, and schedule dependencies.
 * @return Allowance-warning reconciler.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceWarningReconciler(
	options: AllowanceWarningReconcilerOptions,
): AllowanceWarningReconciler {
	let cachedWarningIntervalKey: string | null = null;
	let cachedWarningInterval: AllowanceWarningInterval | null = null;

	/**
	 * Reuses the fixed warning interval while the allowance, schedule, and time zone remain unchanged.
	 * @param schedule - Validated normalized schedule for the protected scope.
	 * @param expiresAtEpochMilliseconds - Exact allowance expiry.
	 * @param timeZone - Current local IANA time-zone identifier.
	 * @return Inclusive start and exclusive end, or null when the warning is never eligible.
	 * @since 0.1.0 Initial implementation.
	 */
	function getAllowanceWarningInterval(
		schedule: NormalizedSchedule,
		expiresAtEpochMilliseconds: number,
		timeZone: string,
	): AllowanceWarningInterval | null {
		const cacheKey = JSON.stringify( [ schedule, expiresAtEpochMilliseconds, timeZone ] );

		if ( cacheKey !== cachedWarningIntervalKey ) {
			cachedWarningIntervalKey = cacheKey;
			cachedWarningInterval = calculateAllowanceWarningInterval(
				schedule,
				expiresAtEpochMilliseconds,
				timeZone,
			);
		}

		return cachedWarningInterval;
	}

	/**
	 * Sends one protected-page command without allowing an ancillary failure to block later effects.
	 * @param tabId - Browser tab receiving the command.
	 * @param message - Validated warning command.
	 * @return Whether the browser accepted the command.
	 * @since 0.1.0 Initial implementation.
	 */
	async function updatePresentation( tabId: number, message: ProtectedPageMessage ): Promise<boolean> {
		try {
			await options.browser.updateProtectedPagePresentation( tabId, message );
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Removes a warning identity already reported by a page.
	 * @param tabId - Browser tab containing the warning.
	 * @param allowanceId - Exact displayed allowance identity.
	 * @return Promise resolved after best-effort removal.
	 * @since 0.1.0 Initial implementation.
	 */
	async function removeWarning(
		tabId: number,
		allowanceId: NonNullable<ProtectedPagePresentationStatus[ 'allowanceWarningId' ]>,
	): Promise<void> {
		await updatePresentation( tabId, {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
			allowanceId,
		} );
	}

	/**
	 * Clears every allowance-owned page effect from an already injected document.
	 * @param tabId - Browser tab containing the protected page.
	 * @param presentation - Current presentation reported by the page.
	 * @return Promise resolved after every best-effort cleanup attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function clearAllowancePresentation(
		tabId: number,
		presentation: ProtectedPagePresentationStatus | null,
	): Promise<void> {
		const allowanceWarningId = presentation?.allowanceWarningId ?? null;

		if ( allowanceWarningId !== null ) {
			await removeWarning( tabId, allowanceWarningId );
		}

		await updatePresentation( tabId, {
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
		} );
	}

	/**
	 * Reconciles one tab from a single browser and state snapshot.
	 * @param tab - Fresh browser tab observation.
	 * @param focusedTabId - Active tab in the focused browser window.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @param nowEpochMilliseconds - Shared wall-clock reconciliation instant.
	 * @return Promise resolved after the tab effect settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileTab(
		tab: ProtectionRuntimeTab,
		focusedTabId: number | null,
		configuration: Parameters<AllowanceWarningReconciler[ 'reconcile' ]>[ 0 ],
		statesByScope: Parameters<AllowanceWarningReconciler[ 'reconcile' ]>[ 1 ],
		nowEpochMilliseconds: number,
	): Promise<void> {
		if ( configuration === null || statesByScope === null ) {
			await updatePresentation( tab.id, {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			} );
			return;
		}

		const observedUrl = getObservedTabUrl( tab );

		if ( observedUrl === undefined ) {
			await updatePresentation( tab.id, {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			} );
			return;
		}

		const presentation = await options.browser.getProtectedPagePresentation( tab.id );
		const existingAllowanceId = presentation?.allowanceWarningId ?? null;

		const match = matchProtectedUrl(
			observedUrl,
			configuration.sites.map( ( site ) => site.rule ),
		);

		if ( match.status !== ProtectedUrlMatchStatus.PROTECTED ) {
			await clearAllowancePresentation( tab.id, presentation );
			return;
		}

		const state = statesByScope[ match.rule.scopeId ];
		const schedule = configuration.schedulesByScope[ match.rule.scopeId ];

		if (
			state?.type !== ProtectionStateType.ALLOWANCE ||
			schedule === undefined ||
			state.expiresAtEpochMilliseconds <= nowEpochMilliseconds
		) {
			await clearAllowancePresentation( tab.id, presentation );
			return;
		}

		const timeZone = options.getTimeZone();
		const scheduleEvaluation = evaluateSchedule(
			schedule,
			nowEpochMilliseconds,
			timeZone,
		);
		const warningInterval = tab.id === focusedTabId
			? getAllowanceWarningInterval(
				schedule,
				state.expiresAtEpochMilliseconds,
				timeZone,
			)
			: null;

		const guardSynchronized = await updatePresentation( tab.id, {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: state.allowanceId,
			expiresAtEpochMilliseconds: state.expiresAtEpochMilliseconds,
			warningStartsAtEpochMilliseconds: warningInterval?.startsAtEpochMilliseconds ?? null,
			warningEndsAtEpochMilliseconds: warningInterval?.endsAtEpochMilliseconds ?? null,
		} );

		const warningIsCurrent = existingAllowanceId === state.allowanceId;

		if ( existingAllowanceId !== null && ! warningIsCurrent ) {
			await removeWarning( tab.id, existingAllowanceId );
		}

		const decision = selectAllowanceWarningDecision( state, {
			scopeId: state.scopeId,
			allowanceId: state.allowanceId,
			pageId: createRuntimePageId( tab.id, 'allowance_warning' ),
			nowEpochMilliseconds,
			focusEligible: tab.id === focusedTabId,
			match,
			schedule: scheduleEvaluation,
			isWarningPresented: warningIsCurrent,
		} );

		if (
			guardSynchronized &&
			decision?.type === AllowanceWarningDecisionType.PRESENT_ALLOWANCE_WARNING
		) {
			await updatePresentation( tab.id, {
				type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
				allowanceId: decision.allowanceId,
				expiresAtEpochMilliseconds: decision.expiresAtEpochMilliseconds,
			} );
		} else if ( decision?.type === AllowanceWarningDecisionType.REMOVE_ALLOWANCE_WARNING ) {
			await removeWarning( tab.id, decision.allowanceId );
		}
	}

	/**
	 * Reconciles local expiry guards and warning presentation without blocking protection state.
	 * @param configuration - Current validated configuration or unavailable marker.
	 * @param statesByScope - Current authoritative states or unavailable marker.
	 * @return Promise resolved after every observable page attempt settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcile(
		configuration: Parameters<AllowanceWarningReconciler[ 'reconcile' ]>[ 0 ],
		statesByScope: Parameters<AllowanceWarningReconciler[ 'reconcile' ]>[ 1 ],
	): Promise<void> {
		try {
			const [ tabs, focusedTabId ] = await Promise.all( [
				options.browser.listTabs(),
				options.browser.getFocusedTabId(),
			] );
			const nowEpochMilliseconds = options.now();

			await Promise.allSettled( tabs.map( ( tab ) => reconcileTab(
				tab,
				focusedTabId,
				configuration,
				statesByScope,
				nowEpochMilliseconds,
			) ) );
		} catch {
			return;
		}
	}

	return { reconcile };
}

export * from './types';
