import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditor,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultTimingConfiguration, type TimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import styles from './web-component-style.scss?inline';
import {
	TimingScreenLoadStatus,
	TimingScreenSaveErrorReason,
	type TimingFormEvent,
	type TimingScreenCopy,
	type TimingScreenLoadStatus as TimingScreenLoadStatusValue,
	type TimingScreenSaveErrorReason as TimingScreenSaveErrorReasonValue,
} from './types';

const SECOND_MILLISECONDS = 1_000;
const MINUTE_MILLISECONDS = 60_000;

/**
 * Creates one inclusive ordered numeric range for native timing options.
 * @param start - First allowed value.
 * @param end - Final allowed value.
 * @param step - Difference between adjacent values.
 * @return Inclusive ordered values.
 * @since 0.1.0 Initial implementation.
 */
function createTimingOptionRange( start: number, end: number, step: number ): ReadonlyArray<number> {
	const values: number[] = [];

	for ( let value = start; value <= end; value += step ) {
		values.push( value );
	}

	return values;
}

const WAIT_SECONDS_OPTIONS = createTimingOptionRange( 10, 60, 5 );
const WAIT_INCREASE_SECONDS_OPTIONS = createTimingOptionRange( 5, 60, 5 );
const ALLOWANCE_MINUTES_OPTIONS = createTimingOptionRange( 1, 60, 1 );

/**
 * Renders editable global wait, allowance, and completion timing settings.
 * @element tocus-f-timing-screen
 * @summary Global Timing settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-timing-screen' )
export class ComponentTimingScreen extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Domain editor responsible for validated local configuration persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: ProtectionConfigurationEditor | null = null;

	/**
	 * Complete localizable messages rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<TimingScreenCopy>;

	@state()
	private accessor configuration: ProtectionConfigurationDocument | null = null;

	@state()
	private accessor timingConfiguration: TimingConfiguration = DefaultTimingConfiguration;

	@state()
	private accessor loadStatus: TimingScreenLoadStatusValue = TimingScreenLoadStatus.LOADING;

	@state()
	private accessor saving = false;

	@state()
	private accessor maximumWaitInvalid = false;

	@state()
	private accessor saveErrorReason: TimingScreenSaveErrorReasonValue | null = null;

	@state()
	private accessor savedAnnouncementVisible = false;

	@state()
	private accessor announcementSequence = 0;

	/**
	 * Loads local timing configuration after all template properties are assigned.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override firstUpdated(): void {
		void this.loadConfiguration();
	}

	/**
	 * Loads validated local configuration without replacing malformed data.
	 * @return Promise resolved after the screen state is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	private async loadConfiguration(): Promise<void> {
		this.loadStatus = TimingScreenLoadStatus.LOADING;

		if ( this.editor === null ) {
			this.configuration = null;
			this.loadStatus = TimingScreenLoadStatus.FAILED;
			return;
		}

		try {
			const configuration = await this.editor.load();

			if ( configuration === null ) {
				this.configuration = null;
				this.loadStatus = TimingScreenLoadStatus.MALFORMED;
				return;
			}

			this.configuration = configuration;
			this.timingConfiguration = configuration.timingConfiguration;
			this.loadStatus = TimingScreenLoadStatus.READY;
		} catch {
			this.configuration = null;
			this.loadStatus = TimingScreenLoadStatus.FAILED;
		}
	}

	/**
	 * Retries the current local configuration read and restores useful focus.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = async (): Promise<void> => {
		await this.loadConfiguration();
		await this.updateComplete;

		const focusTarget = this.loadStatus === TimingScreenLoadStatus.READY
			? '#initial-wait'
			: '.retry-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Renders the current loading or local recovery state.
	 * @return Loading, recovery, or empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderLoadState(): TemplateResult {
		if ( this.loadStatus === TimingScreenLoadStatus.LOADING ) {
			return html`<p class="loading-status" role="status">${ this.copy.loading }</p>`;
		}

		if (
			this.loadStatus === TimingScreenLoadStatus.MALFORMED ||
			this.loadStatus === TimingScreenLoadStatus.FAILED
		) {
			const malformed = this.loadStatus === TimingScreenLoadStatus.MALFORMED;

			return html`
				<div class="load-error" role="alert">
					<div>
						<h2>${ malformed ? this.copy.malformedDataTitle : this.copy.loadErrorTitle }</h2>
						<p>${ malformed ? this.copy.malformedDataDescription : this.copy.loadErrorDescription }</p>
					</div>
					<button class="retry-action" type="button" @click=${ this.handleRetry }>
						${ this.copy.retry }
					</button>
				</div>
			`;
		}

		return html``;
	}

	/**
	 * Replaces the polite live-region content so repeated messages are announced.
	 * @since 0.1.0 Initial implementation.
	 */
	private announceSaved(): void {
		this.savedAnnouncementVisible = true;
		this.announcementSequence += 1;
	}

	/**
	 * Resolves the retained save failure through the latest localized copy.
	 * @return Current localized save error, or an empty string when no failure is active.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolveSaveError(): string {
		if ( this.saveErrorReason === null ) {
			return '';
		}

		const messages: Record<TimingScreenSaveErrorReasonValue, string> = {
			[ TimingScreenSaveErrorReason.INVALID_CONFIGURATION ]: this.copy.invalidConfigurationError,
			[ TimingScreenSaveErrorReason.INVALID_TIMING_CONFIGURATION ]:
				this.copy.invalidTimingConfigurationError,
			[ TimingScreenSaveErrorReason.PERSISTENCE ]: this.copy.saveError,
		};

		return messages[ this.saveErrorReason ];
	}

	/**
	 * Reads one complete global timing candidate from native form controls.
	 * @param form - Rendered global timing form.
	 * @return Global timing candidate expressed in persisted units.
	 * @since 0.1.0 Initial implementation.
	 */
	private readTimingConfiguration( form: HTMLFormElement ): TimingConfiguration {
		const formData = new FormData( form );
		const completionActionInput = formData.get( 'completion-action' );

		return {
			initialWaitMilliseconds: Number( formData.get( 'initial-wait' ) ) * SECOND_MILLISECONDS,
			ladderIncreaseMilliseconds: Number( formData.get( 'wait-increase' ) ) * SECOND_MILLISECONDS,
			maximumWaitMilliseconds: Number( formData.get( 'maximum-wait' ) ) * SECOND_MILLISECONDS,
			allowanceMilliseconds: Number( formData.get( 'allowance' ) ) * MINUTE_MILLISECONDS,
			completionAction: completionActionInput === CompletionAction.OPEN_AUTOMATICALLY
				? CompletionAction.OPEN_AUTOMATICALLY
				: CompletionAction.SHOW_CONTINUE,
		};
	}

	/**
	 * Keeps the reactive timing draft aligned with native control changes.
	 * @param event - Bubbling timing form change event.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleFormChange = ( event: TimingFormEvent ): void => {
		const timingConfiguration = this.readTimingConfiguration( event.currentTarget );
		this.timingConfiguration = timingConfiguration;
		this.maximumWaitInvalid =
			timingConfiguration.maximumWaitMilliseconds < timingConfiguration.initialWaitMilliseconds;
		this.saveErrorReason = null;
	};

	/**
	 * Persists one complete valid global timing draft through the domain editor.
	 * @param event - Timing form submission event.
	 * @return Promise resolved after persistence finishes.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSubmit = async ( event: TimingFormEvent ): Promise<void> => {
		event.preventDefault();

		if (
			this.saving ||
			this.editor === null ||
			this.configuration === null ||
			this.loadStatus !== TimingScreenLoadStatus.READY
		) {
			return;
		}

		const timingConfiguration = this.readTimingConfiguration( event.currentTarget );
		this.timingConfiguration = timingConfiguration;
		this.maximumWaitInvalid = false;
		this.saveErrorReason = null;

		if ( timingConfiguration.maximumWaitMilliseconds < timingConfiguration.initialWaitMilliseconds ) {
			this.maximumWaitInvalid = true;
			await this.updateComplete;
			this.shadowRoot?.querySelector<HTMLSelectElement>( '#maximum-wait' )?.focus();
			return;
		}

		this.saving = true;

		try {
			const result = await this.editor.updateTiming( timingConfiguration );

			if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
				this.saveErrorReason = result.reason ===
					ProtectionConfigurationEditRejectionReason.INVALID_TIMING_CONFIGURATION
					? TimingScreenSaveErrorReason.INVALID_TIMING_CONFIGURATION
					: TimingScreenSaveErrorReason.INVALID_CONFIGURATION;
				return;
			}

			this.configuration = result.configuration;
			this.timingConfiguration = result.configuration.timingConfiguration;
			this.announceSaved();
		} catch {
			this.saveErrorReason = TimingScreenSaveErrorReason.PERSISTENCE;
		} finally {
			this.saving = false;
		}
	};

	/**
	 * Renders the global timing form in its current load state.
	 * @return Timing settings template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		const loading = this.loadStatus === TimingScreenLoadStatus.LOADING;
		const formDisabled = this.loadStatus !== TimingScreenLoadStatus.READY || this.saving;
		const initialWaitSeconds = this.timingConfiguration.initialWaitMilliseconds / SECOND_MILLISECONDS;
		const waitIncreaseSeconds = this.timingConfiguration.ladderIncreaseMilliseconds / SECOND_MILLISECONDS;
		const maximumWaitSeconds = this.timingConfiguration.maximumWaitMilliseconds / SECOND_MILLISECONDS;
		const allowanceMinutes = this.timingConfiguration.allowanceMilliseconds / MINUTE_MILLISECONDS;
		const maximumWaitError = this.maximumWaitInvalid ? this.copy.maximumWaitError : '';
		const saveError = this.resolveSaveError();
		const announcement = this.savedAnnouncementVisible ? this.copy.savedAnnouncement : '';

		return html`
			<main aria-labelledby="timing-title" aria-busy=${ loading ? 'true' : 'false' }>
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="timing-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				${ this.loadStatus === TimingScreenLoadStatus.READY ? html`
				<form
					class="timing-form"
					aria-label=${ this.copy.formLabel }
					@change=${ this.handleFormChange }
					@submit=${ this.handleSubmit }
				>
					<div class="timing-fields">
						<div class="timing-field">
							<label for="initial-wait">${ this.copy.initialWaitLabel }</label>
							<select
								id="initial-wait"
								name="initial-wait"
								aria-describedby="initial-wait-help"
								?disabled=${ formDisabled }
							>
								${ WAIT_SECONDS_OPTIONS.map( ( seconds ) => html`
									<option
										value=${ seconds }
										.selected=${ seconds === initialWaitSeconds }
									>${ this.copy.formatSecondsOption( seconds ) }</option>
								` ) }
							</select>
							<p id="initial-wait-help" class="field-help">${ this.copy.initialWaitHelp }</p>
						</div>
						<div class="timing-field">
							<label for="wait-increase">${ this.copy.waitIncreaseLabel }</label>
							<select
								id="wait-increase"
								name="wait-increase"
								aria-describedby="wait-increase-help"
								?disabled=${ formDisabled }
							>
								${ WAIT_INCREASE_SECONDS_OPTIONS.map( ( seconds ) => html`
									<option
										value=${ seconds }
										.selected=${ seconds === waitIncreaseSeconds }
									>${ this.copy.formatSecondsOption( seconds ) }</option>
								` ) }
							</select>
							<p id="wait-increase-help" class="field-help">${ this.copy.waitIncreaseHelp }</p>
						</div>
						<div class="timing-field">
							<label for="maximum-wait">${ this.copy.maximumWaitLabel }</label>
							<select
								id="maximum-wait"
								name="maximum-wait"
								aria-describedby="maximum-wait-help maximum-wait-error"
								aria-invalid=${ this.maximumWaitInvalid ? 'true' : 'false' }
								?disabled=${ formDisabled }
							>
								${ WAIT_SECONDS_OPTIONS.map( ( seconds ) => html`
									<option
										value=${ seconds }
										.selected=${ seconds === maximumWaitSeconds }
									>${ this.copy.formatSecondsOption( seconds ) }</option>
								` ) }
							</select>
							<p id="maximum-wait-help" class="field-help">${ this.copy.maximumWaitHelp }</p>
							<p id="maximum-wait-error" class="maximum-wait-error" role="alert">
								${ maximumWaitError }
							</p>
						</div>
						<div class="timing-field">
							<label for="allowance">${ this.copy.allowanceLabel }</label>
							<select
								id="allowance"
								name="allowance"
								aria-describedby="allowance-help"
								?disabled=${ formDisabled }
							>
								${ ALLOWANCE_MINUTES_OPTIONS.map( ( minutes ) => html`
									<option
										value=${ minutes }
										.selected=${ minutes === allowanceMinutes }
									>${ this.copy.formatMinutesOption( minutes ) }</option>
								` ) }
							</select>
							<p id="allowance-help" class="field-help">${ this.copy.allowanceHelp }</p>
						</div>
					</div>
					<fieldset class="completion-action" ?disabled=${ formDisabled }>
						<legend>${ this.copy.completionActionLegend }</legend>
						<div class="completion-options">
							<label class="completion-option">
								<input
									type="radio"
									name="completion-action"
									value=${ CompletionAction.SHOW_CONTINUE }
									.checked=${ this.timingConfiguration.completionAction === CompletionAction.SHOW_CONTINUE }
								>
								<span class="completion-selection" aria-hidden="true"></span>
								<span>
									<strong>${ this.copy.showContinueLabel }</strong>
									<small>${ this.copy.showContinueDescription }</small>
								</span>
							</label>
							<label class="completion-option">
								<input
									type="radio"
									name="completion-action"
									value=${ CompletionAction.OPEN_AUTOMATICALLY }
									.checked=${ this.timingConfiguration.completionAction === CompletionAction.OPEN_AUTOMATICALLY }
								>
								<span class="completion-selection" aria-hidden="true"></span>
								<span>
									<strong>${ this.copy.openAutomaticallyLabel }</strong>
									<small>${ this.copy.openAutomaticallyDescription }</small>
								</span>
							</label>
						</div>
					</fieldset>
					<section class="timing-summary" aria-labelledby="timing-summary-title">
						<h2 id="timing-summary-title">${ this.copy.summaryTitle }</h2>
						<p>${ this.copy.formatSummary(
							initialWaitSeconds,
							waitIncreaseSeconds,
							maximumWaitSeconds,
							allowanceMinutes,
							this.timingConfiguration.completionAction,
						) }</p>
					</section>
					<div class="form-actions">
						<button class="save-action" type="submit" ?disabled=${ formDisabled }>
							${ this.saving ? this.copy.savingTiming : this.copy.saveTiming }
						</button>
						<p class="form-error" role="alert">${ saveError }</p>
					</div>
				</form>
				` : html`` }
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
	 * Maps the Timing screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-timing-screen': ComponentTimingScreen;
	}
}
