import { type Language } from '../../../../domains/preferences/types';
import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor';
import { type LocalizationBundle } from '../../../../localization';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import {
	PopupAddSiteRequestEventName,
	PopupOperationError,
	type PopupOperationError as PopupOperationErrorValue,
	PopupRetryRequestEventName,
} from '../../components/shell/types';
import { type PopupCurrentTabContext } from '../../types/current-tab-context';
import {
	PopupCurrentSiteStatus,
	PopupProjectionStatus,
	PopupTimerPhase,
	type PopupProjection,
} from '../../types/popup-projection';
import { type PopupPageOptions } from './types';

const COUNTDOWN_INTERVAL_MILLISECONDS = 1_000;

/**
 * Reveals the popup after its initial state becomes coherent.
 * @param options - Popup page dependencies containing the owned document.
 * @since 0.1.0 Initial implementation.
 */
function revealPopupPage( options: PopupPageOptions ): void {
	options.document.documentElement.style.removeProperty( 'color-scheme' );
	options.document.documentElement.style.removeProperty( 'background' );
	options.document.documentElement.style.removeProperty( 'visibility' );
}

/**
 * Projects one complete localization snapshot into the popup.
 * @param options - Popup presentation dependencies.
 * @param localization - Validated packaged localization bundle.
 * @since 0.1.0 Initial implementation.
 */
function applyLocalization(
	options: PopupPageOptions,
	localization: Readonly<LocalizationBundle>,
): void {
	options.document.documentElement.setAttribute( 'lang', localization.languageTag );
	options.document.title = localization.document.popupTitle;
	options.shell.copy = localization.popup;
}

/**
 * Returns the current website host eligible for a cached favicon.
 * @param projection - Current semantic popup projection.
 * @return Current website identity host or null when unavailable.
 * @since 0.1.0 Initial implementation.
 */
function getCurrentIdentityHost( projection: PopupProjection ): string | null {
	if ( projection.status !== PopupProjectionStatus.AVAILABLE ) {
		return null;
	}

	if ( projection.currentSite.status === PopupCurrentSiteStatus.UNPROTECTED ) {
		return projection.currentSite.identityHost;
	}

	return projection.currentSite.status === PopupCurrentSiteStatus.PROTECTED
		? projection.currentSite.site.identityHost
		: null;
}

/**
 * Maps one enrollment result to stable popup recovery copy.
 * @param result - Protected-site enrollment result.
 * @return Popup operation error or null after successful enrollment.
 * @since 0.1.0 Initial implementation.
 */
function getEnrollmentError(
	result: ProtectedSiteEnrollmentResult,
): PopupOperationErrorValue | null {
	if ( result.status === ProtectedSiteEnrollmentStatus.ADDED ) {
		return null;
	}

	if (
		result.status === ProtectedSiteEnrollmentStatus.REJECTED &&
		result.reason === ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED
	) {
		return null;
	}

	if ( result.status === ProtectedSiteEnrollmentStatus.PERMISSION_DENIED ) {
		return PopupOperationError.PERMISSION_DENIED;
	}

	if ( result.status === ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED ) {
		return PopupOperationError.PERMISSION_RETAINED;
	}

	return result.status === ProtectedSiteEnrollmentStatus.PERMISSION_ERROR
		? PopupOperationError.PERMISSION_ERROR
		: PopupOperationError.SAVE_ERROR;
}

/**
 * Starts the complete popup page and its popup-lifetime observers.
 * @param options - Local services, browser lifecycle, and popup presentation dependencies.
 * @return Promise resolved after initial preferences, copy, and status are visible.
 * @since 0.1.0 Initial implementation.
 */
export async function startPopupPage( options: PopupPageOptions ): Promise<void> {
	let active = true;
	let currentTab: PopupCurrentTabContext | null = null;
	let countdownIntervalId: number | null = null;
	let localizationRevision = 0;
	let retryPending = false;
	let statusRevision = 0;

	/**
	 * Reports whether this popup instance still owns asynchronous work.
	 * @return Whether the popup lifecycle remains active.
	 * @since 0.1.0 Initial implementation.
	 */
	function isActive(): boolean {
		return active;
	}

	/**
	 * Reports whether one status request still owns the current projection.
	 * @param requestedRevision - Revision captured before asynchronous work.
	 * @return Whether the request can safely project its result.
	 * @since 0.1.0 Initial implementation.
	 */
	function isCurrentStatusRequest( requestedRevision: number ): boolean {
		return isActive() && requestedRevision === statusRevision;
	}

	/**
	 * Stops the current allowance display interval when present.
	 * @since 0.1.0 Initial implementation.
	 */
	function clearCountdown(): void {
		if ( countdownIntervalId === null ) {
			return;
		}

		options.pageWindow.clearInterval( countdownIntervalId );
		countdownIntervalId = null;
	}

	/**
	 * Applies a local cached-favicon source without allowing provider failure to hide status.
	 * @param projection - Current validated semantic projection.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyFavicon( projection: PopupProjection ): void {
		const identityHost = getCurrentIdentityHost( projection );

		if ( identityHost === null ) {
			options.shell.faviconSource = null;
			return;
		}

		try {
			options.shell.faviconSource = options.faviconProvider.getSource( identityHost );
		} catch {
			options.shell.faviconSource = null;
		}
	}

	/**
	 * Returns the earliest wall-clock Allowance expiry in one projection.
	 * @param projection - Current semantic popup projection.
	 * @return Earliest expiry or null when no Allowance is open.
	 * @since 0.1.0 Initial implementation.
	 */
	function getNextAllowanceExpiry( projection: PopupProjection ): number | null {
		if ( projection.status !== PopupProjectionStatus.AVAILABLE ) {
			return null;
		}

		let expiry: number | null = null;

		for ( const scope of projection.activeScopes ) {
			if ( scope.phase !== PopupTimerPhase.ALLOWANCE ) {
				continue;
			}

			expiry = expiry === null
				? scope.expiresAtEpochMilliseconds
				: Math.min( expiry, scope.expiresAtEpochMilliseconds );
		}

		return expiry;
	}

	/**
	 * Refreshes status after one wall-clock Allowance expires.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleCountdownExpiry(): void {
		void refreshProjection( false );
	}

	/**
	 * Starts local display updates only for absolute Allowance expiry.
	 * @param projection - Current semantic popup projection.
	 * @since 0.1.0 Initial implementation.
	 */
	function configureCountdown( projection: PopupProjection ): void {
		clearCountdown();
		const nextExpiry = getNextAllowanceExpiry( projection );

		if ( nextExpiry === null ) {
			return;
		}

		countdownIntervalId = options.pageWindow.setInterval( () => {
			const currentTime = options.now();

			options.shell.nowEpochMilliseconds = currentTime;

			if ( currentTime >= nextExpiry ) {
				clearCountdown();
				handleCountdownExpiry();
			}
		}, COUNTDOWN_INTERVAL_MILLISECONDS );
	}

	/**
	 * Projects one authoritative status into all popup presentation properties.
	 * @param projection - Current validated semantic projection.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyProjection( projection: PopupProjection ): void {
		options.shell.projection = projection;
		options.shell.nowEpochMilliseconds = projection.status === PopupProjectionStatus.AVAILABLE
			? projection.capturedAtEpochMilliseconds
			: options.now();
		applyFavicon( projection );
		configureCountdown( projection );
	}

	/**
	 * Loads and applies one packaged localization if it remains current.
	 * @param language - Effective selected or browser-derived language.
	 * @return Promise resolved after this localization request settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function requestLocalization( language: Language ): Promise<void> {
		localizationRevision += 1;
		const requestedRevision = localizationRevision;
		const localization = await options.loadLocalization( language );

		if ( active && requestedRevision === localizationRevision ) {
			applyLocalization( options, localization );
		}
	}

	/**
	 * Applies live language changes while retaining the last usable copy on failure.
	 * @param language - Newly effective preference language.
	 * @return Promise resolved after the live localization request settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function applyLiveLocalization( language: Language ): Promise<void> {
		try {
			await requestLocalization( language );
		} catch {
			return;
		}
	}

	/**
	 * Starts one non-blocking live localization projection.
	 * @param language - Newly effective preference language.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleLanguageChange( language: Language ): void {
		void applyLiveLocalization( language );
	}

	/**
	 * Waits until the most recently requested startup localization is projected.
	 * @return Promise resolved when no newer language request is pending.
	 * @since 0.1.0 Initial implementation.
	 */
	async function synchronizeLocalization(): Promise<void> {
		let requestedRevision: number;

		do {
			requestedRevision = localizationRevision + 1;
			await requestLocalization( options.preferencesController.language );
		} while ( active && requestedRevision !== localizationRevision );
	}

	/**
	 * Refreshes the current status while discarding stale asynchronous results.
	 * @param rereadCurrentTab - Whether to read current active-tab metadata first.
	 * @return Whether a fresh projection was applied.
	 * @since 0.1.0 Initial implementation.
	 */
	async function refreshProjection( rereadCurrentTab: boolean ): Promise<boolean> {
		statusRevision += 1;
		const requestedRevision = statusRevision;

		try {
			const nextTab = rereadCurrentTab
				? await options.currentTabReader.read()
				: currentTab;

			if ( ! isCurrentStatusRequest( requestedRevision ) ) {
				return false;
			}

			if ( rereadCurrentTab ) {
				currentTab = nextTab;
			}
			const projection = await options.statusClient.refreshStatus( nextTab );

			if ( ! isCurrentStatusRequest( requestedRevision ) ) {
				return false;
			}

			applyProjection( projection );
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Completes one direct-gesture enrollment request.
	 * @param request - Enrollment operation already started by the click handler.
	 * @since 0.1.0 Initial implementation.
	 */
	async function completeEnrollment(
		request: Promise<ProtectedSiteEnrollmentResult>,
	): Promise<void> {
		try {
			const result = await request;

			if ( ! active ) {
				return;
			}

			const operationError = getEnrollmentError( result );

			if ( operationError !== null ) {
				options.shell.operationError = operationError;
				return;
			}

			if ( await refreshProjection( false ) ) {
				await options.shell.focusManageAction();
			}
		} catch {
			if ( active ) {
				options.shell.operationError = PopupOperationError.SAVE_ERROR;
			}
		} finally {
			if ( active ) {
				options.shell.adding = false;
			}
		}
	}

	/**
	 * Starts enrollment synchronously from the user's click before any asynchronous work.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleAddSite(): void {
		if ( ! active || options.shell.adding || currentTab === null ) {
			return;
		}

		options.shell.adding = true;
		options.shell.operationError = null;

		try {
			const request = options.enrollment.add( currentTab.url, false );

			void completeEnrollment( request );
		} catch {
			options.shell.adding = false;
			options.shell.operationError = PopupOperationError.SAVE_ERROR;
		}
	}

	/**
	 * Completes one user-requested status recovery and restores focus after rerendering.
	 * @return Promise resolved after recovery settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function completeRetry(): Promise<void> {
		const refreshed = await refreshProjection( true );

		retryPending = false;

		if ( ! active ) {
			return;
		}

		options.shell.retrying = false;

		if ( refreshed ) {
			await options.shell.focusAfterRetry();
		}
	}

	/**
	 * Re-reads the active tab and refreshes status after a user recovery request.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleRetry(): void {
		if ( retryPending ) {
			return;
		}

		retryPending = true;
		options.shell.retrying = true;
		options.shell.operationError = null;
		void completeRetry();
	}

	/**
	 * Releases every observer and interval owned by this popup instance.
	 * @since 0.1.0 Initial implementation.
	 */
	function stop(): void {
		if ( ! active ) {
			return;
		}

		active = false;
		statusRevision += 1;
		localizationRevision += 1;
		clearCountdown();
		options.preferencesController.removeLanguageChangeListener( handleLanguageChange );
		options.preferencesController.stop();
		options.shell.removeEventListener( PopupAddSiteRequestEventName, handleAddSite );
		options.shell.removeEventListener( PopupRetryRequestEventName, handleRetry );
		options.pageWindow.removeEventListener( 'pagehide', handlePageHide );
	}

	/**
	 * Stops popup-lifetime work when the browser dismisses the popup.
	 * @since 0.1.0 Initial implementation.
	 */
	function handlePageHide(): void {
		stop();
	}

	options.shell.settingsPageUrl = options.settingsPageUrl;
	options.shell.statisticsPageUrl = options.statisticsPageUrl;
	options.preferencesController.addLanguageChangeListener( handleLanguageChange );
	options.shell.addEventListener( PopupAddSiteRequestEventName, handleAddSite );
	options.shell.addEventListener( PopupRetryRequestEventName, handleRetry );
	options.pageWindow.addEventListener( 'pagehide', handlePageHide );

	try {
		await options.preferencesController.start();

		if ( ! isActive() ) {
			return;
		}

		await synchronizeLocalization();

		if ( ! isActive() ) {
			return;
		}

		currentTab = await options.currentTabReader.read();

		if ( ! isActive() ) {
			return;
		}

		const projection = await options.statusClient.readStatus( currentTab );

		if ( isActive() ) {
			applyProjection( projection );
			revealPopupPage( options );
		}
	} catch ( error ) {
		stop();
		throw error;
	}
}

/**
 * Starts the popup while presenting branded local recovery after terminal failure.
 * @param options - Local services, browser lifecycle, and popup presentation dependencies.
 * @return Promise resolved after ordinary startup or recovery becomes visible.
 * @since 0.1.0 Initial implementation.
 */
export async function bootstrapPopupPage( options: PopupPageOptions ): Promise<void> {
	try {
		await startPopupPage( options );
	} catch {
		applyLocalization( options, options.fallbackLocalization );
		options.shell.projection = { status: PopupProjectionStatus.UNAVAILABLE };
		options.shell.faviconSource = null;
		options.shell.nowEpochMilliseconds = options.now();

		/**
		 * Completes a full popup restart and restores focus to its resulting action.
		 * @return Promise resolved after startup and focus restoration settle.
		 * @since 0.1.0 Initial implementation.
		 */
		async function completeRecoveryRetry(): Promise<void> {
			try {
				await bootstrapPopupPage( options );
			} finally {
				options.shell.retrying = false;
				await options.shell.focusAfterRetry();
			}
		}

		/**
		 * Retries complete popup startup from the visible recovery action.
		 * @since 0.1.0 Initial implementation.
		 */
		function handleRecoveryRetry(): void {
			options.shell.retrying = true;
			options.shell.removeEventListener( PopupRetryRequestEventName, handleRecoveryRetry );
			void completeRecoveryRetry();
		}

		options.shell.addEventListener( PopupRetryRequestEventName, handleRecoveryRetry );
		revealPopupPage( options );
	}
}

export * from './types';
