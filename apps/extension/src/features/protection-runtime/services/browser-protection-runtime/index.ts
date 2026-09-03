import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { DepartureCause, ProtectionEventType } from '../../../../domains/protection/types/protection-event';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import {
	ScheduleEvaluationStatus,
	type ScheduleEvaluationResult,
} from '../../../../domains/protection/types/schedule-evaluation';
import {
	ProtectionCoordinatorDispatchStatus,
	type ProtectionCoordinatorDispatchResult,
} from '../../../../domains/protection/services/protection-coordinator';
import { evaluateSchedule } from '../../../../domains/protection/utils/schedule-evaluator';
import {
	InterruptionPageResponseSchema,
	InterruptionPageResponseState,
	type InterruptionPageResponse,
} from '../../types/runtime-message';
import {
	createRuntimeStateTarget,
} from '../../utils/runtime-page-context';
import { createAllowanceExpiryReconciler } from '../allowance-expiry-reconciler';
import { createBrowserProtectionProjector } from '../browser-protection-projector';
import { createInterruptionRequestHandler } from '../interruption-request-handler';
import { createProtectionFocusReconciler } from '../protection-focus-reconciler';
import { createProtectionNavigationHandler } from '../protection-navigation-handler';
import { createProtectionParticipantReconciler } from '../protection-participant-reconciler';
import { createProtectionRuntimeRestorer } from '../protection-runtime-restorer';
import {
	type BrowserProtectionRuntime,
	type BrowserProtectionRuntimeOptions,
} from './types';

/**
 * Evaluates the current schedule for one configured protection scope.
 * @param configuration - Current validated protection configuration.
 * @param scopeId - Protection scope being evaluated.
 * @param nowEpochMilliseconds - Current wall-clock time.
 * @param timeZone - Current IANA time-zone identifier.
 * @return Active, inactive, or failed current schedule evaluation.
 * @since 0.1.0 Initial implementation.
 */
function evaluateScopeSchedule(
	configuration: ProtectionConfigurationDocument,
	scopeId: string,
	nowEpochMilliseconds: number,
	timeZone: string,
): ScheduleEvaluationResult {
	const scopeIsConfigured = configuration.sites.some( ( site ) => site.rule.scopeId === scopeId );
	const schedule = scopeIsConfigured ? configuration.schedulesByScope[ scopeId ] : undefined;

	return schedule === undefined
		? { status: ScheduleEvaluationStatus.INACTIVE }
		: evaluateSchedule( schedule, nowEpochMilliseconds, timeZone );
}

/**
 * Creates a validated unavailable interruption-page response.
 * @return Authoritative unavailable page projection.
 * @since 0.1.0 Initial implementation.
 */
function createUnavailablePageResponse(): InterruptionPageResponse {
	return InterruptionPageResponseSchema.parse( { state: InterruptionPageResponseState.UNAVAILABLE } );
}

/**
 * Creates one browser runtime that serializes navigation, focus, progress, and toolbar effects.
 * @param options - Domain, configuration, browser, clock, and identity dependencies.
 * @return Browser protection runtime operations.
 * @since 0.1.0 Initial implementation.
 */
export function createBrowserProtectionRuntime( options: BrowserProtectionRuntimeOptions ): BrowserProtectionRuntime {
	let operationQueue: Promise<void> = Promise.resolve();
	let available = false;
	const projector = createBrowserProtectionProjector( {
		browser: options.browser,
		coordinator: options.coordinator,
		interruptionPageUrl: options.interruptionPageUrl,
		getTimeZone: options.getTimeZone,
		now: options.now,
		...( options.toolbarBadgeCopy === undefined ? {} : { toolbarBadgeCopy: options.toolbarBadgeCopy } ),
	} );

	const allowanceExpiryReconciler = createAllowanceExpiryReconciler( {
		browser: options.browser,
		coordinator: options.coordinator,
		applyDispatchResult,
		createStableId: options.createStableId,
		getTimeZone: options.getTimeZone,
		now: options.now,
	} );
	const participantReconciler = createProtectionParticipantReconciler( {
		browser: options.browser,
		coordinator: options.coordinator,
		interruptionPageUrl: options.interruptionPageUrl,
		applyDispatchResult,
		releaseInjectedInterruption: projector.releaseInjectedInterruption,
		releaseNavigationIfInterrupted: projector.releaseNavigationIfInterrupted,
		now: options.now,
	} );
	const navigationHandler = createProtectionNavigationHandler( {
		browser: options.browser,
		coordinator: options.coordinator,
		interruptionPageUrl: options.interruptionPageUrl,
		applyDispatchResult,
		createStableId: options.createStableId,
		departTab: participantReconciler.departTab,
		evaluateScopeSchedule,
		getTimeZone: options.getTimeZone,
		loadConfiguration,
		now: options.now,
		reconcileBrowserState: projector.reconcile,
		reconcileExpiredAllowances: allowanceExpiryReconciler.reconcile,
		reconcileSchedules,
		reconcileUnavailableConfiguration,
		releaseNavigationIfInterrupted: projector.releaseNavigationIfInterrupted,
	} );

	const interruptionRequestHandler = createInterruptionRequestHandler( {
		browser: options.browser,
		coordinator: options.coordinator,
		applyDispatchResult,
		createStableId: options.createStableId,
		getTimeZone: options.getTimeZone,
		loadConfiguration,
		now: options.now,
		reconcileExpiredAllowances: allowanceExpiryReconciler.reconcile,
		reconcileUnavailableConfiguration,
		releaseInterruptionPresentation: projector.releaseInterruptionPresentation,
		refreshToolbarBadge: projector.refreshToolbarBadge,
	} );
	const focusReconciler = createProtectionFocusReconciler( {
		browser: options.browser,
		coordinator: options.coordinator,
		interruptionPageUrl: options.interruptionPageUrl,
		loadConfiguration,
		reconcileExpiredAllowances: allowanceExpiryReconciler.reconcile,
		reconcileParticipants: participantReconciler.reconcile,
		reconcileSchedules,
		reconcileUnavailableConfiguration,
		refreshFocusEffects: projector.refreshFocusEffects,
		synchronizeParticipantFocus: interruptionRequestHandler.synchronizeParticipantFocus,
	} );
	const restorer = createProtectionRuntimeRestorer( {
		coordinator: options.coordinator,
		interruptionPageUrl: options.interruptionPageUrl,
		applyDecisions: projector.applyDecisions,
		applyDispatchResult,
		getTimeZone: options.getTimeZone,
		listTabs: options.browser.listTabs,
		loadConfiguration,
		now: options.now,
	} );

	/**
	 * Serializes a runtime operation without poisoning later work after a rejection.
	 * @param operation - Deferred runtime operation.
	 * @return Promise for the operation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueue<T>( operation: () => Promise<T> ): Promise<T> {
		const result = operationQueue.then( operation, operation );

		operationQueue = result.then( () => undefined, () => undefined );

		return result;
	}

	/**
	 * Loads and validates the current local protection configuration.
	 * @return Current configuration or null when storage is unavailable or malformed.
	 * @since 0.1.0 Initial implementation.
	 */
	async function loadConfiguration(): Promise<ProtectionConfigurationDocument | null> {
		try {
			const configuration = await options.configurationStorage.load();
			const result = ProtectionConfigurationDocumentSchema.safeParse( configuration );

			if ( ! result.success ) {
				return null;
			}

			const filteredConfiguration = await options.filterConfiguration( result.data );
			const filteredResult = ProtectionConfigurationDocumentSchema.safeParse( filteredConfiguration );

			return filteredResult.success ? filteredResult.data : null;
		} catch {
			return null;
		}
	}

	/**
	 * Removes every browser effect owned by the runtime and marks it unavailable.
	 * @return Promise resolved after cleanup, or rejected when redirect removal fails.
	 * @since 0.1.0 Initial implementation.
	 */
	async function failOpenOperation(): Promise<void> {
		available = false;
		await projector.failOpen();
		await participantReconciler.departAll( DepartureCause.PERMISSION_LOSS, null );
	}

	/**
	 * Removes protected browser projections when configuration cannot be trusted.
	 * @return Promise resolved after fail-open browser projection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileUnavailableConfiguration(): Promise<void> {
		available = false;
		await projector.failOpen();
		await participantReconciler.departAll( DepartureCause.STORAGE_FAILURE, null );
	}

	/**
	 * Applies a coordinator result or disables browser protection after rejected persistence.
	 * @param result - Coordinator dispatch result.
	 * @param configuration - Current validated local configuration or unavailable marker.
	 * @return Promise resolved after supported browser effects are applied.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyDispatchResult(
		result: ProtectionCoordinatorDispatchResult,
		configuration: ProtectionConfigurationDocument | null,
	): Promise<void> {
		if ( result.status === ProtectionCoordinatorDispatchStatus.REJECTED ) {
			available = false;
		}

		return projector.applyDispatchResult( result, configuration );
	}

	/**
	 * Reconciles active transactions whose schedule is no longer active or configured.
	 * @param configuration - Current validated local protection configuration.
	 * @return Promise resolved after non-active scopes fail open.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileSchedules( configuration: ProtectionConfigurationDocument ): Promise<void> {
		const statesByScope = await options.coordinator.getStates();

		if ( statesByScope === null ) {
			return;
		}

		for ( const state of Object.values( statesByScope ) ) {
			if ( state.type === ProtectionStateType.IDLE ) {
				continue;
			}

			const schedule = evaluateScopeSchedule(
				configuration,
				state.scopeId,
				options.now(),
				options.getTimeZone(),
			);

			if ( schedule.status === ScheduleEvaluationStatus.ACTIVE ) {
				continue;
			}

			const result = await options.coordinator.dispatch( () => ( {
				type: ProtectionEventType.SCHEDULE_REEVALUATION,
				scopeId: state.scopeId,
				target: createRuntimeStateTarget( state ),
				schedule,
			} ) );

			await applyDispatchResult( result, configuration );
		}
	}

	/**
	 * Reconciles configuration, schedules, elapsed allowances, and browser projections.
	 * @return Promise resolved after current runtime state is projected.
	 * @since 0.1.0 Initial implementation.
	 */
	async function reconcileOperation(): Promise<void> {
		if ( ! available ) {
			return;
		}

		const configuration = await loadConfiguration();

		if ( configuration === null ) {
			await reconcileUnavailableConfiguration();
			return;
		}

		await participantReconciler.reconcile( configuration );
		await reconcileSchedules( configuration );
		await allowanceExpiryReconciler.reconcile( configuration );
		await projector.reconcile( configuration );
	}

	/**
	 * Restores authoritative state before any queued browser event is processed.
	 * @return Promise resolved after startup reconciliation or fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	async function initializeOperation(): Promise<void> {
		if ( available ) {
			await reconcileOperation();
			return;
		}

		if ( ! await restorer.restore() ) {
			await failOpenOperation();
			return;
		}

		available = true;
		await reconcileOperation();
	}

	/**
	 * Starts runtime browser-state reconciliation through the serialized queue.
	 * @return Promise resolved after startup reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	function start(): Promise<void> {
		return enqueue( initializeOperation );
	}

	/**
	 * Removes runtime-owned browser effects through the serialized queue.
	 * @return Promise resolved after fail-open cleanup.
	 * @since 0.1.0 Initial implementation.
	 */
	function failOpen(): Promise<void> {
		return enqueue( failOpenOperation );
	}

	/**
	 * Handles one observed navigation through the serialized queue.
	 * @param navigation - Browser navigation details.
	 * @return Promise resolved after navigation handling.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleNavigation(
		navigation: Parameters<BrowserProtectionRuntime[ 'handleNavigation' ]>[ 0 ],
	): Promise<void> {
		return enqueue( async () => {
			if ( available ) {
				await navigationHandler.handle( navigation );
			}
		} );
	}

	/**
	 * Handles one interruption-page message through the serialized queue.
	 * @param input - Unknown runtime message payload.
	 * @param senderTabId - Browser-provided sender tab identifier.
	 * @return Authoritative interruption-page response.
	 * @since 0.1.0 Initial implementation.
	 */
	function handlePageRequest(
		input: unknown,
		senderTabId: number | null,
	): Promise<InterruptionPageResponse> {
		return enqueue( async () => {
			if ( ! available ) {
				return createUnavailablePageResponse();
			}

			return interruptionRequestHandler.handle( input, senderTabId );
		} );
	}

	/**
	 * Removes one closed-tab participant through the serialized queue.
	 * @param tabId - Closed browser tab identifier.
	 * @return Promise resolved after runtime reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleTabRemoved( tabId: number ): Promise<void> {
		return enqueue( async () => {
			if ( ! available ) {
				return;
			}

			const configuration = await loadConfiguration();

			if ( configuration === null ) {
				await reconcileUnavailableConfiguration();
				return;
			}

			await participantReconciler.departTab(
				tabId,
				DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
				configuration,
			);
			await projector.reconcile( configuration );
		} );
	}

	/**
	 * Reconciles browser focus through the serialized queue.
	 * @return Promise resolved after focus reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleFocusChanged(): Promise<void> {
		return enqueue( async () => {
			if ( available ) {
				await focusReconciler.reconcile();
			}
		} );
	}

	/**
	 * Processes elapsed wall-clock state through the serialized queue.
	 * @return Promise resolved after clock reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleClockTick(): Promise<void> {
		return enqueue( reconcileOperation );
	}

	/**
	 * Reconciles changed local configuration through the serialized queue.
	 * @return Promise resolved after configuration reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleConfigurationChanged(): Promise<void> {
		return enqueue( initializeOperation );
	}

	return {
		failOpen,
		start,
		handleNavigation,
		handlePageRequest,
		handleTabRemoved,
		handleFocusChanged,
		handleClockTick,
		handleConfigurationChanged,
	};
}

export * from './types';
