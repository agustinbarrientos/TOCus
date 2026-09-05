import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type PropertyValues,
	type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	StatisticsProjectionSchema,
	StatisticsProjectionStatus,
	type AvailableStatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import styles from './web-component-style.scss?inline';
import {
	StatisticsRecoveryReason,
	StatisticsScreenLoadStatus,
	type StatisticsRecoveryReason as StatisticsRecoveryReasonValue,
	type StatisticsScreenLoadStatus as StatisticsScreenLoadStatusValue,
	type StatisticsSettingsScreenCopy,
	type StatisticsSource,
} from './types';

/**
 * Renders private all-time statistics in extension settings.
 * @element tocus-f-statistics-settings-screen
 * @summary Statistics settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-statistics-settings-screen' )
export class ComponentStatisticsSettingsScreen extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Authoritative all-time statistics source used by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor source: StatisticsSource | null = null;

	/**
	 * Complete localizable messages and value formatters rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<StatisticsSettingsScreenCopy>;

	/**
	 * Current authoritative projection shown by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor projection: AvailableStatisticsProjection | null = null;

	/**
	 * Current asynchronous loading or recovery state.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor loadStatus: StatisticsScreenLoadStatusValue = StatisticsScreenLoadStatus.LOADING;

	/**
	 * Whether the inline reset confirmation is currently visible.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor confirmingReset = false;

	/**
	 * Whether one reset request is currently pending.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor resetting = false;

	/**
	 * Presentation-neutral polite status presented to assistive technology.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor resetSuccessAnnouncementVisible = false;

	/**
	 * Monotonic key that recreates repeated live-region messages.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor announcementSequence = 0;

	/**
	 * Operation represented by the current unavailable state.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor recoveryReason: StatisticsRecoveryReasonValue = StatisticsRecoveryReason.LOAD;

	/**
	 * Whether the first Lit update has completed.
	 * @since 0.1.0 Initial implementation.
	 */
	private hasCompletedInitialUpdate = false;

	/**
	 * Monotonic generation used to ignore obsolete asynchronous operations.
	 * @since 0.1.0 Initial implementation.
	 */
	private operationGeneration = 0;

	/**
	 * Statistics source currently observed for authoritative local changes.
	 * @since 0.1.0 Initial implementation.
	 */
	private observedSource: StatisticsSource | null = null;

	/**
	 * Reloads an open screen after authoritative statistics change elsewhere.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleStatisticsChange = (): void => {
		if ( ! this.resetting ) {
			void this.loadStatistics( true );
		}
	};

	/**
	 * Replaces the statistics source observed by this connected screen.
	 * @param source - Current statistics source, or null while disconnected.
	 * @since 0.1.0 Initial implementation.
	 */
	private observeSource( source: StatisticsSource | null ): void {
		if ( this.observedSource === source ) {
			return;
		}

		this.observedSource?.removeStatisticsChangeListener( this.handleStatisticsChange );
		this.observedSource = source;
		this.observedSource?.addStatisticsChangeListener( this.handleStatisticsChange );
	}

	/**
	 * Refreshes statistics when an existing screen reconnects.
	 * @since 0.1.0 Initial implementation.
	 */
	override connectedCallback(): void {
		super.connectedCallback();
		this.observeSource( this.source );

		if ( this.hasCompletedInitialUpdate ) {
			void this.loadStatistics();
		}
	}

	/**
	 * Loads the authoritative projection after template properties are assigned.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override firstUpdated(): void {
		void this.loadStatistics();
	}

	/**
	 * Reloads statistics when the shell replaces its source dependency.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override updated( changedProperties: PropertyValues<this> ): void {
		if ( changedProperties.has( 'source' ) ) {
			this.observeSource( this.source );
		}

		if ( ! this.hasCompletedInitialUpdate ) {
			this.hasCompletedInitialUpdate = true;
			return;
		}

		if ( changedProperties.has( 'source' ) ) {
			void this.loadStatistics();
		}
	}

	/**
	 * Invalidates pending reads when the screen leaves the document.
	 * @since 0.1.0 Initial implementation.
	 */
	override disconnectedCallback(): void {
		this.operationGeneration += 1;
		this.observeSource( null );
		super.disconnectedCallback();
	}

	/**
	 * Loads and validates the current all-time projection.
	 * @param preserveInteraction - Whether a background refresh should preserve the current ready interaction.
	 * @return Promise resolved after the screen state is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	private async loadStatistics( preserveInteraction = false ): Promise<void> {
		const operationGeneration = ++this.operationGeneration;
		const source = this.source;
		const focusedControl = this.shadowRoot?.activeElement;
		const restoreRecoveryFocus = preserveInteraction &&
			focusedControl instanceof HTMLElement &&
			focusedControl.matches(
				'.reset-action, .cancel-reset-action, .confirm-reset-action',
			);

		if ( ! preserveInteraction ) {
			this.loadStatus = StatisticsScreenLoadStatus.LOADING;
			this.projection = null;
			this.recoveryReason = StatisticsRecoveryReason.LOAD;
			this.confirmingReset = false;
			this.resetting = false;
			this.resetSuccessAnnouncementVisible = false;
		}

		try {
			if ( source === null ) {
				this.projection = null;
				this.loadStatus = StatisticsScreenLoadStatus.UNAVAILABLE;
				this.recoveryReason = StatisticsRecoveryReason.LOAD;
				this.confirmingReset = false;
				return;
			}

			const result = StatisticsProjectionSchema.safeParse( await source.readStatistics() );

			if ( operationGeneration !== this.operationGeneration ) {
				return;
			}

			if ( result.success && result.data.status === StatisticsProjectionStatus.AVAILABLE ) {
				this.projection = result.data;
				this.loadStatus = StatisticsScreenLoadStatus.READY;
				this.recoveryReason = StatisticsRecoveryReason.LOAD;
				return;
			}
		} catch {
			// Transport failures share the same non-fabricating recovery state.
		}

		if ( operationGeneration === this.operationGeneration ) {
			this.projection = null;
			this.loadStatus = StatisticsScreenLoadStatus.UNAVAILABLE;
			this.recoveryReason = StatisticsRecoveryReason.LOAD;
			this.confirmingReset = false;

			if ( restoreRecoveryFocus ) {
				await this.updateComplete;
				if ( operationGeneration === this.operationGeneration ) {
					this.shadowRoot?.querySelector<HTMLButtonElement>( '.retry-action' )?.focus();
				}
			}
		}
	}

	/**
	 * Retries an unavailable authoritative statistics read.
	 * @return Promise resolved after the retry state is rendered.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = async (): Promise<void> => {
		await this.loadStatistics();
		await this.updateComplete;

		this.shadowRoot?.querySelector<HTMLElement>(
			this.loadStatus === StatisticsScreenLoadStatus.READY ? 'h1' : '.retry-action',
		)?.focus();
	};

	/**
	 * Renders the current loading or recovery state.
	 * @return Loading, recovery, or empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderLoadState(): TemplateResult {
		if ( this.loadStatus === StatisticsScreenLoadStatus.LOADING ) {
			return html`<p class="loading-status" role="status">${ this.copy.loading }</p>`;
		}

		if ( this.loadStatus === StatisticsScreenLoadStatus.UNAVAILABLE ) {
			const resetFailed = this.recoveryReason === StatisticsRecoveryReason.RESET;

			return html`
				<div class="load-error" role="alert">
					<div>
						<h2>${ resetFailed ? this.copy.resetErrorTitle : this.copy.unavailableTitle }</h2>
						<p>${ resetFailed ? this.copy.resetErrorDescription : this.copy.unavailableDescription }</p>
					</div>
					<div class="load-error-actions">
						<button class="retry-action" type="button" @click=${ this.handleRetry }>
							${ this.copy.retry }
						</button>
						${ this.source === null ? html`` : html`
							<button
								class="reset-action"
								type="button"
								aria-expanded=${ this.confirmingReset ? 'true' : 'false' }
								aria-controls="reset-confirmation"
								@click=${ this.handleShowResetConfirmation }
							>${ this.copy.resetAction }</button>
						` }
					</div>
					${ this.confirmingReset ? this.renderResetConfirmation() : html`` }
				</div>
			`;
		}

		return html``;
	}

	/**
	 * Reveals inline reset confirmation and moves focus to its primary action.
	 * @return Promise resolved after confirmation is rendered.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleShowResetConfirmation = async (): Promise<void> => {
		this.confirmingReset = true;
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLButtonElement>( '.confirm-reset-action' )?.focus();
	};

	/**
	 * Dismisses inline reset confirmation and restores focus to its trigger.
	 * @return Promise resolved after confirmation is removed.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleCancelReset = async (): Promise<void> => {
		this.confirmingReset = false;
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLButtonElement>( '.reset-action' )?.focus();
	};

	/**
	 * Renders the shared inline reset confirmation.
	 * @return Reset explanation and confirmation actions.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderResetConfirmation(): TemplateResult {
		return html`
			<div
				class="reset-confirmation"
				id="reset-confirmation"
				role="group"
				aria-labelledby="reset-confirmation-title"
				aria-describedby="reset-confirmation-description"
			>
				<h3 id="reset-confirmation-title">${ this.copy.resetConfirmationTitle }</h3>
				<p id="reset-confirmation-description">${ this.copy.resetConfirmationDescription }</p>
				<div class="reset-confirmation-actions">
					<button
						class="cancel-reset-action"
						type="button"
						?disabled=${ this.resetting }
						@click=${ this.handleCancelReset }
					>
						${ this.copy.cancelReset }
					</button>
					<button
						class="confirm-reset-action"
						type="button"
						?disabled=${ this.resetting }
						@click=${ this.handleConfirmReset }
					>
						${ this.resetting ? this.copy.resetting : this.copy.confirmReset }
					</button>
				</div>
			</div>
		`;
	}

	/**
	 * Replaces the live-region content so repeated messages remain announceable.
	 * @since 0.1.0 Initial implementation.
	 */
	private announceResetSuccess(): void {
		this.resetSuccessAnnouncementVisible = true;
		this.announcementSequence += 1;
	}

	/**
	 * Replaces visible statistics with the non-fabricating reset recovery state.
	 * @since 0.1.0 Initial implementation.
	 */
	private showResetFailure(): void {
		this.projection = null;
		this.loadStatus = StatisticsScreenLoadStatus.UNAVAILABLE;
		this.recoveryReason = StatisticsRecoveryReason.RESET;
		this.confirmingReset = false;
	}

	/**
	 * Requests one authoritative statistics reset and adopts its returned projection.
	 * @return Promise resolved after the reset response is rendered.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleConfirmReset = async (): Promise<void> => {
		if ( this.resetting || this.source === null ) {
			return;
		}

		const operationGeneration = ++this.operationGeneration;
		const source = this.source;
		this.resetting = true;
		this.resetSuccessAnnouncementVisible = false;
		let succeeded = false;

		try {
			const result = StatisticsProjectionSchema.safeParse( await source.resetStatistics() );

			if ( operationGeneration !== this.operationGeneration ) {
				return;
			}

			if ( result.success && result.data.status === StatisticsProjectionStatus.AVAILABLE ) {
				this.projection = result.data;
				this.loadStatus = StatisticsScreenLoadStatus.READY;
				this.confirmingReset = false;
				this.announceResetSuccess();
				succeeded = true;
			} else {
				this.showResetFailure();
			}
		} catch {
			if ( operationGeneration === this.operationGeneration ) {
				this.showResetFailure();
			}
		} finally {
			if ( operationGeneration === this.operationGeneration ) {
				this.resetting = false;
			}
		}

		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLButtonElement>(
			succeeded ? '.reset-action' : '.retry-action',
		)?.focus();
	};

	/**
	 * Renders local statistics data controls.
	 * @return Local-data explanation and reset controls.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderDataControls(): TemplateResult {
		return html`
			<section class="data-controls" aria-labelledby="local-data-title">
				<div>
					<h2 id="local-data-title">${ this.copy.localDataTitle }</h2>
					<p>${ this.copy.localDataDescription }</p>
				</div>
				<button
					class="reset-action"
					type="button"
					aria-expanded=${ this.confirmingReset ? 'true' : 'false' }
					aria-controls="reset-confirmation"
					@click=${ this.handleShowResetConfirmation }
				>${ this.copy.resetAction }</button>
				${ this.confirmingReset ? this.renderResetConfirmation() : html`` }
			</section>
		`;
	}

	/**
	 * Renders the five approved all-time metrics.
	 * @param projection - Available authoritative statistics projection.
	 * @return Metric definition list and estimation note.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderMetrics( projection: AvailableStatisticsProjection ): TemplateResult {
		const empty = ( projection.estimatedReclaimedMilliseconds ?? 0 ) === 0 &&
			projection.focusedPauseMilliseconds === 0 &&
			projection.reconsideredVisitCount === 0 &&
			projection.completedWaitCount === 0 &&
			projection.allowanceGrantedCount === 0;

		return html`
			<section class="statistics-summary" aria-labelledby="all-time-title">
				<h2 class="section-title" id="all-time-title">${ this.copy.allTimeTitle }</h2>
				${ empty ? html`<p class="empty-message">${ this.copy.emptyMessage }</p>` : html`` }
				<dl class="metrics">
					<div class="metric metric-featured">
						<dt>${ this.copy.estimatedReclaimedLabel }</dt>
						<dd>${ projection.estimatedReclaimedMilliseconds === null
							? this.copy.notEnoughHistory
							: this.copy.formatEstimatedDuration( projection.estimatedReclaimedMilliseconds ) }</dd>
					</div>
					<div class="metric">
						<dt>${ this.copy.focusedPauseLabel }</dt>
						<dd>${ this.copy.formatDuration( projection.focusedPauseMilliseconds ) }</dd>
					</div>
					<div class="metric">
						<dt>${ this.copy.reconsideredVisitsLabel }</dt>
						<dd>${ this.copy.formatCount( projection.reconsideredVisitCount ) }</dd>
					</div>
					<div class="metric">
						<dt>${ this.copy.completedWaitsLabel }</dt>
						<dd>${ this.copy.formatCount( projection.completedWaitCount ) }</dd>
					</div>
					<div class="metric">
						<dt>${ this.copy.allowancesGrantedLabel }</dt>
						<dd>${ this.copy.formatCount( projection.allowanceGrantedCount ) }</dd>
					</div>
				</dl>
				<p class="method-note">${ this.copy.estimationDescription }</p>
			</section>
		`;
	}

	/**
	 * Renders Statistics settings in the current loading state.
	 * @return Statistics screen template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		const announcement = this.resetSuccessAnnouncementVisible ? this.copy.resetSuccess : '';

		return html`
			<main
				aria-labelledby="statistics-title"
				aria-busy=${ this.loadStatus === StatisticsScreenLoadStatus.LOADING ? 'true' : 'false' }
			>
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="statistics-title" tabindex="-1">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				${ this.projection === null ? html`` : this.renderMetrics( this.projection ) }
				${ this.loadStatus === StatisticsScreenLoadStatus.READY ? this.renderDataControls() : html`` }
				${ this.renderLoadState() }
				<p class="announcement" role="status" aria-live="polite">
					${ keyed(
						this.announcementSequence,
						html`<span>${ announcement }</span>`,
					) }
				</p>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the Statistics settings-screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-statistics-settings-screen': ComponentStatisticsSettingsScreen;
	}
}
