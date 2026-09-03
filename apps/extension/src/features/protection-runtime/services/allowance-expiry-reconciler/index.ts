import {
	ProtectionEventType,
	AllowanceExpiryCandidateSource,
	type AllowanceExpiryCandidate,
} from '../../../../domains/protection/types/protection-event';
import { ProtectionStateType, type AllowanceProtectionState } from '../../../../domains/protection/types/protection-state';
import { ParticipantIdSchema, WaitIdSchema } from '../../../../domains/protection/types/protection-value';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { ScheduleEvaluationStatus } from '../../../../domains/protection/types/schedule-evaluation';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { createReadyRuntimeExpiryCandidates } from '../../utils/runtime-participant-observation';
import { createRuntimeLocalDate } from '../../utils/runtime-local-date';
import { createRuntimePageId, getRuntimeTabId } from '../../utils/runtime-page-context';
import {
	type AllowanceExpiryReconciler,
	type AllowanceExpiryReconcilerOptions,
} from './types';

/**
 * Creates fresh live-page candidates for one expiring allowance scope.
 * @param state - Expiring allowance state.
 * @param configuration - Current protected-site configuration.
 * @param options - Browser observations, clock, and identifier dependencies.
 * @param focusedTabId - Active tab in the focused browser window.
 * @param retainedTabIds - Browser tabs already represented by Ready participants.
 * @param tabs - Single open-tab snapshot shared by the expiry transaction.
 * @return Protected open pages that should enter the next gentle interruption.
 * @since 0.1.0 Initial implementation.
 */
function createLivePageCandidates(
	state: AllowanceProtectionState,
	configuration: Parameters<AllowanceExpiryReconciler[ 'reconcile' ]>[ 0 ],
	options: AllowanceExpiryReconcilerOptions,
	focusedTabId: number | null,
	retainedTabIds: ReadonlySet<number>,
	tabs: Awaited<ReturnType<AllowanceExpiryReconcilerOptions[ 'browser' ][ 'listTabs' ]>>,
): AllowanceExpiryCandidate[] {
	const rules = configuration.sites.map( ( site ) => site.rule );

	return tabs.flatMap( ( tab ) => {
		if ( tab.url === undefined || retainedTabIds.has( tab.id ) ) {
			return [];
		}

		const match = matchProtectedUrl( tab.url, rules );

		if ( match.status !== ProtectedUrlMatchStatus.PROTECTED || match.rule.scopeId !== state.scopeId ) {
			return [];
		}

		return [ {
			source: AllowanceExpiryCandidateSource.LIVE_PAGE,
			participantId: ParticipantIdSchema.parse( `participant_${ options.createStableId() }` ),
			pageId: createRuntimePageId( tab.id, options.createStableId() ),
			observedDestination: tab.url,
			focusEligible: tab.id === focusedTabId,
			match,
		} ];
	} );
}

/**
 * Creates allowance-expiry reconciliation with fresh browser observations.
 * @param options - State, browser, clock, and effect dependencies.
 * @return Elapsed allowance reconciler.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceExpiryReconciler(
	options: AllowanceExpiryReconcilerOptions,
): AllowanceExpiryReconciler {
	/**
	 * Reconciles every elapsed allowance found in the current state snapshot.
	 * @param configuration - Current validated local configuration.
	 * @return Promise resolved after every elapsed allowance is reconciled.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcile(
		configuration: Parameters<AllowanceExpiryReconciler[ 'reconcile' ]>[ 0 ],
	): Promise<void> {
		const statesByScope = await options.coordinator.getStates();

		if ( statesByScope === null ) {
			return;
		}

		const nowEpochMilliseconds = options.now();
		const elapsedStates = Object.values( statesByScope ).filter(
			( state ): state is AllowanceProtectionState =>
				state.type === ProtectionStateType.ALLOWANCE &&
				nowEpochMilliseconds >= state.expiresAtEpochMilliseconds,
		);

		if ( elapsedStates.length === 0 ) {
			return;
		}

		const [ focusedTabId, tabs ] = await Promise.all( [
			options.browser.getFocusedTabId(),
			options.browser.listTabs(),
		] );
		const liveDestinationsByTab = new Map(
			tabs.flatMap( ( tab ) => tab.url === undefined ? [] : [ [ tab.id, tab.url ] as const ] ),
		);

		for ( const observedState of elapsedStates ) {
			const retainedTabIds = new Set(
				observedState.readyParticipants
					.map( ( participant ) => getRuntimeTabId( participant.pageId ) )
					.filter( ( tabId ): tabId is number => tabId !== null ),
			);
			const liveCandidates = createLivePageCandidates(
				observedState,
				configuration,
				options,
				focusedTabId,
				retainedTabIds,
				tabs,
			);
			const result = await options.coordinator.dispatch( ( currentStatesByScope ) => {
				const currentState = currentStatesByScope[ observedState.scopeId ];
				const sourceState: AllowanceProtectionState = currentState?.type === ProtectionStateType.ALLOWANCE
					? currentState
					: observedState;
				const nowEpochMilliseconds = options.now();
				const timeZone = options.getTimeZone();
				const schedule = configuration.schedulesByScope[ observedState.scopeId ];

				return {
					type: ProtectionEventType.ALLOWANCE_EXPIRY,
					scopeId: observedState.scopeId,
					allowanceId: observedState.allowanceId,
					newWaitId: WaitIdSchema.parse( `wait_${ options.createStableId() }` ),
					nowEpochMilliseconds,
					observedLocalDate: createRuntimeLocalDate( nowEpochMilliseconds, timeZone ),
					timingConfiguration: configuration.timingConfiguration,
					schedule: schedule === undefined
						? { status: ScheduleEvaluationStatus.INACTIVE } as const
						: evaluateSchedule( schedule, nowEpochMilliseconds, timeZone ),
					candidates: [
						...createReadyRuntimeExpiryCandidates(
							sourceState,
							configuration,
							focusedTabId,
							liveDestinationsByTab,
						),
						...liveCandidates,
					],
				};
			} );

			await options.applyDispatchResult( result, configuration );
		}
	}

	return { reconcile };
}

export * from './types';
