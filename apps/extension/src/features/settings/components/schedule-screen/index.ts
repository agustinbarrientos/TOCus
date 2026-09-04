import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditor,
} from '../../../../domains/protection/services/protection-configuration-editor';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	ScheduleMode,
	ScheduleSchema,
	Weekday,
	WeekdaySchema,
	NormalizedScheduleSchema,
	type NormalizedScheduleWindow,
	type Schedule,
} from '../../../../domains/protection/types/protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
	type ProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import styles from './web-component-style.scss?inline';
import {
	ScheduleSaveErrorReason,
	ScheduleScreenLoadStatus,
	ScheduleWindowEndErrorReason,
	type ScheduleButtonEvent,
	type ScheduleInputEvent,
	type ScheduleSelectChangeEvent,
	type PresentedScheduleScope,
	type ScheduleSaveErrorReason as ScheduleSaveErrorReasonValue,
	type ScheduleScreenCopy,
	type ScheduleWindowDraft,
	type ScheduleWindowDraftErrors,
} from './types';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;

/**
 * Formats one minute offset as an HTML time-input value.
 * @param minute - Local minute offset, including the end-of-day boundary.
 * @return Zero-padded local time.
 * @since 0.1.0 Initial implementation.
 */
function formatTime( minute: number ): string {
	const normalizedMinute = minute === MINUTES_PER_DAY ? 0 : minute;
	const hour = Math.floor( normalizedMinute / MINUTES_PER_HOUR );
	const minuteWithinHour = normalizedMinute % MINUTES_PER_HOUR;

	return `${ String( hour ).padStart( 2, '0' ) }:${ String( minuteWithinHour ).padStart( 2, '0' ) }`;
}

/**
 * Parses one HTML time-input value into a minute offset.
 * @param value - Candidate zero-padded local time.
 * @return Local minute offset or null for an incomplete value.
 * @since 0.1.0 Initial implementation.
 */
function parseTime( value: string ): number | null {
	if ( value === '' ) {
		return null;
	}

	const [ hourInput, minuteInput ] = value.split( ':' );
	const hour = Number( hourInput );
	const minute = Number( minuteInput );

	return hour * MINUTES_PER_HOUR + minute;
}

/**
 * Renders per-scope weekly schedule editing with local persistence and recovery states.
 * @element tocus-f-schedule-screen
 * @summary Protection schedule settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-schedule-screen' )
export class ComponentScheduleScreen extends LitElement {
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
	accessor copy!: Readonly<ScheduleScreenCopy>;

	@state()
	private accessor configuration: ProtectionConfigurationDocument | null = null;

	@state()
	private accessor loadStatus: ScheduleScreenLoadStatus = ScheduleScreenLoadStatus.LOADING;

	@state()
	private accessor selectedScopeId: ProtectionScopeId = DefaultProtectionScopeId;

	@state()
	private accessor scheduleMode: ScheduleMode = ScheduleMode.ALWAYS;

	@state()
	private accessor windows: ScheduleWindowDraft[] = [];

	@state()
	private accessor windowErrors: Record<number, ScheduleWindowDraftErrors> = {};

	@state()
	private accessor saveErrorReason: ScheduleSaveErrorReasonValue | null = null;

	@state()
	private accessor dirty = false;

	@state()
	private accessor saving = false;

	@state()
	private accessor savedAnnouncementVisible = false;

	@state()
	private accessor announcementSequence = 0;

	private nextWindowId = 0;

	/**
	 * Loads local schedule configuration after template properties are assigned.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override firstUpdated(): void {
		void this.loadConfiguration();
	}

	/**
	 * Creates one editable window identifier.
	 * @return Stable identifier within the current component session.
	 * @since 0.1.0 Initial implementation.
	 */
	private createWindowId(): number {
		const id = this.nextWindowId;
		this.nextWindowId += 1;

		return id;
	}

	/**
	 * Creates one blank custom time window.
	 * @return Editable default weekday with incomplete times.
	 * @since 0.1.0 Initial implementation.
	 */
	private createBlankWindow(): ScheduleWindowDraft {
		return {
			id: this.createWindowId(),
			weekday: Weekday.MONDAY,
			startTime: '',
			endTime: '',
			spansFullDay: false,
		};
	}

	/**
	 * Creates one editable window from a normalized persisted window.
	 * @param window - Persisted same-day schedule window.
	 * @return Editable local-time presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	private createWindowDraft( window: NormalizedScheduleWindow ): ScheduleWindowDraft {
		return {
			id: this.createWindowId(),
			weekday: window.weekday,
			startTime: formatTime( window.startMinute ),
			endTime: formatTime( window.endMinute ),
			spansFullDay: window.startMinute === 0 && window.endMinute === MINUTES_PER_DAY,
		};
	}

	/**
	 * Loads validated local configuration without replacing malformed data.
	 * @return Promise resolved after the screen state is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	private async loadConfiguration(): Promise<void> {
		this.loadStatus = ScheduleScreenLoadStatus.LOADING;
		this.saveErrorReason = null;

		if ( this.editor === null ) {
			this.configuration = null;
			this.loadStatus = ScheduleScreenLoadStatus.FAILED;
			return;
		}

		try {
			const configuration = await this.editor.load();

			if ( configuration === null ) {
				this.configuration = null;
				this.loadStatus = ScheduleScreenLoadStatus.MALFORMED;
				return;
			}

			this.configuration = configuration;
			this.selectedScopeId = DefaultProtectionScopeId;
			this.loadScheduleDraft( configuration );
			this.loadStatus = ScheduleScreenLoadStatus.READY;
		} catch {
			this.configuration = null;
			this.loadStatus = ScheduleScreenLoadStatus.FAILED;
		}
	}

	/**
	 * Replaces the editable draft with the selected persisted schedule.
	 * @param configuration - Complete current local configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	private loadScheduleDraft( configuration: ProtectionConfigurationDocument ): void {
		const schedule = NormalizedScheduleSchema.parse(
			configuration.schedulesByScope[ this.selectedScopeId ],
		);

		this.scheduleMode = schedule.mode;
		this.windows = schedule.mode === ScheduleMode.CUSTOM
			? schedule.windows.map( ( window ) => this.createWindowDraft( window ) )
			: [];
		this.windowErrors = {};
		this.saveErrorReason = null;
		this.dirty = false;
	}

	/**
	 * Creates ordered selector presentation for the shared scope and independent sites.
	 * @return Shared scope followed by readable independent scope labels.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentScopes(): ReadonlyArray<PresentedScheduleScope> {
		const independentScopes = new Map<ProtectionScopeId, PresentedScheduleScope>();
		const configuration = ProtectionConfigurationDocumentSchema.parse( this.configuration );

		for ( const site of configuration.sites ) {
			if ( site.rule.scopeId === DefaultProtectionScopeId || independentScopes.has( site.rule.scopeId ) ) {
				continue;
			}

			const identity = resolveSiteDisplayIdentity( site );
			independentScopes.set( site.rule.scopeId, {
				id: site.rule.scopeId,
				label: this.copy.formatIndependentScopeLabel( identity.name, site.identityHost ),
			} );
		}

		return [
			{ id: DefaultProtectionScopeId, label: this.copy.sharedScope },
			...[ ...independentScopes.values() ].sort( ( first, second ) =>
				this.copy.compareNames( first.label, second.label ),
			),
		];
	}

	/**
	 * Retries the local configuration read and restores useful focus.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = async (): Promise<void> => {
		await this.loadConfiguration();
		await this.updateComplete;

		const focusTarget = this.loadStatus === ScheduleScreenLoadStatus.READY
			? this.shadowRoot?.querySelector<HTMLElement>( '#schedule-scope, input[name="schedule-mode"]' )
			: this.shadowRoot?.querySelector<HTMLElement>( '.retry-action' );
		focusTarget?.focus();
	};

	/**
	 * Replaces live-region content so repeated messages are announced again.
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

		const messages: Record<ScheduleSaveErrorReasonValue, string> = {
			[ ScheduleSaveErrorReason.GENERIC ]: this.copy.saveError,
			[ ScheduleSaveErrorReason.INVALID_CONFIGURATION ]: this.copy.invalidConfigurationError,
			[ ScheduleSaveErrorReason.INVALID_SCHEDULE ]: this.copy.invalidScheduleError,
			[ ScheduleSaveErrorReason.SCOPE_NOT_FOUND ]: this.copy.scopeNotFoundError,
		};

		return messages[ this.saveErrorReason ];
	}

	/**
	 * Selects one pristine protection scope for editing.
	 * @param event - Native scope-selector change.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleScopeChange = ( event: ScheduleSelectChangeEvent ): void => {
		const select = event.currentTarget;
		this.selectedScopeId = ProtectionScopeIdSchema.parse( select.value );
		this.loadScheduleDraft( ProtectionConfigurationDocumentSchema.parse( this.configuration ) );
	};

	/**
	 * Changes the editable schedule mode.
	 * @param event - Native schedule-mode change.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleModeChange = ( event: ScheduleInputEvent ): void => {
		const input = event.currentTarget;
		this.scheduleMode = input.value === ScheduleMode.CUSTOM ? ScheduleMode.CUSTOM : ScheduleMode.ALWAYS;

		if ( this.scheduleMode === ScheduleMode.CUSTOM && this.windows.length === 0 ) {
			this.windows = [ this.createBlankWindow() ];
		}

		this.windowErrors = {};
		this.saveErrorReason = null;
		this.dirty = true;
	};

	/**
	 * Resolves one window identifier from an interactive control.
	 * @param target - Candidate schedule-window control.
	 * @return Window identifier or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolveWindowId( target: HTMLElement ): number {
		return Number( target.dataset.windowId );
	}

	/**
	 * Resolves one draft end time while preserving a loaded full-day boundary.
	 * @param window - Editable time-window draft.
	 * @return End minute or null for an incomplete time.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolveEndMinute( window: ScheduleWindowDraft ): number | null {
		const endMinute = parseTime( window.endTime );

		return window.spansFullDay && endMinute === 0 ? MINUTES_PER_DAY : endMinute;
	}

	/**
	 * Validates the editable fields in one time-window draft.
	 * @param window - Editable time-window draft.
	 * @return Current semantic field-error state.
	 * @since 0.1.0 Initial implementation.
	 */
	private createWindowErrors( window: ScheduleWindowDraft ): ScheduleWindowDraftErrors {
		const startMinute = parseTime( window.startTime );
		const endMinute = this.resolveEndMinute( window );

		return {
			startTimeRequired: startMinute === null,
			endTime: endMinute === null
				? ScheduleWindowEndErrorReason.REQUIRED
				: startMinute === endMinute
					? ScheduleWindowEndErrorReason.EQUAL_TIME
					: null,
		};
	}

	/**
	 * Updates one editable window without mutating its siblings.
	 * @param id - Stable editable window identifier.
	 * @param changes - Partial window values supplied by one native control.
	 * @since 0.1.0 Initial implementation.
	 */
	private updateWindow( id: number, changes: Partial<ScheduleWindowDraft> ): void {
		const currentErrors = this.windowErrors[ id ];
		this.windows = this.windows.map( ( window ) => {
			if ( window.id !== id ) {
				return window;
			}

			const updatedWindow = { ...window, ...changes };
			if ( currentErrors !== undefined ) {
				this.windowErrors = { ...this.windowErrors, [ id ]: this.createWindowErrors( updatedWindow ) };
			}

			return updatedWindow;
		} );
		this.saveErrorReason = null;
		this.dirty = true;
	}

	/**
	 * Updates one window weekday from its native selector.
	 * @param event - Native weekday change.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleWeekdayChange = ( event: ScheduleSelectChangeEvent ): void => {
		const select = event.currentTarget;
		const id = this.resolveWindowId( select );
		this.updateWindow( id, { weekday: WeekdaySchema.parse( select.value ) } );
	};

	/**
	 * Updates one window start time from its native input.
	 * @param event - Native start-time input.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleStartTimeInput = ( event: ScheduleInputEvent ): void => {
		const input = event.currentTarget;
		const id = this.resolveWindowId( input );
		this.updateWindow( id, { startTime: input.value, spansFullDay: false } );
	};

	/**
	 * Updates one window end time from its native input.
	 * @param event - Native end-time input.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleEndTimeInput = ( event: ScheduleInputEvent ): void => {
		const input = event.currentTarget;
		const id = this.resolveWindowId( input );
		this.updateWindow( id, { endTime: input.value, spansFullDay: false } );
	};

	/**
	 * Adds one blank schedule window and focuses its weekday selector.
	 * @return Promise resolved after focus moves to the new row.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAddWindow = async (): Promise<void> => {
		const window = this.createBlankWindow();
		this.windows = [ ...this.windows, window ];
		this.dirty = true;
		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLElement>(
			`[data-window-id="${ String( window.id ) }"][name="weekday"]`,
		)?.focus();
	};

	/**
	 * Removes one non-final schedule window and restores row-action focus.
	 * @param event - Native remove-window click.
	 * @return Promise resolved after focus restoration.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRemoveWindow = async (
		event: ScheduleButtonEvent,
	): Promise<void> => {
		const id = this.resolveWindowId( event.currentTarget );
		const index = this.windows.findIndex( ( window ) => window.id === id );

		if ( this.windows.length === 1 ) {
			return;
		}

		const remainingWindows = this.windows.filter( ( window ) => window.id !== id );
		this.windows = remainingWindows;
		this.dirty = true;
		await this.updateComplete;
		const removeActions = this.shadowRoot?.querySelectorAll<HTMLButtonElement>( '.remove-window-action' );
		removeActions?.item( Math.min( index, remainingWindows.length - 1 ) ).focus();
	};

	/**
	 * Restores the selected persisted schedule and clears unsaved feedback.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleDiscard = async (): Promise<void> => {
		this.loadScheduleDraft( ProtectionConfigurationDocumentSchema.parse( this.configuration ) );
		await this.updateComplete;
		const focusTarget = this.shadowRoot?.querySelector<HTMLElement>( '#schedule-scope' ) ??
			this.shadowRoot?.querySelector<HTMLElement>( 'input[name="schedule-mode"]:checked' );
		focusTarget?.focus();
	};

	/**
	 * Validates the current draft and creates one domain schedule input.
	 * @return Validated schedule or null after assigning field errors.
	 * @since 0.1.0 Initial implementation.
	 */
	private validateDraft(): Schedule | null {
		if ( this.scheduleMode === ScheduleMode.ALWAYS ) {
			this.windowErrors = {};

			return ScheduleSchema.parse( { mode: ScheduleMode.ALWAYS } );
		}

		const errors: Record<number, ScheduleWindowDraftErrors> = {};
		const windows = this.windows.map( ( window ) => {
			const startMinute = parseTime( window.startTime );
			const endMinute = this.resolveEndMinute( window );
			errors[ window.id ] = this.createWindowErrors( window );

			return {
				weekday: window.weekday,
				startMinute,
				endMinute,
			};
		} );
		this.windowErrors = errors;

		if ( windows.some( ( window ) => window.startMinute === null || window.endMinute === null ) ) {
			return null;
		}

		const schedule = ScheduleSchema.safeParse( {
			mode: ScheduleMode.CUSTOM,
			windows,
		} );

		return schedule.success ? schedule.data : null;
	}

	/**
	 * Saves the current schedule draft through the serialized domain editor.
	 * @param event - Native schedule-form submission.
	 * @return Promise resolved after validation and persistence finish.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleSave = async ( event: SubmitEvent ): Promise<void> => {
		event.preventDefault();

		if ( this.saving || this.editor === null || this.configuration === null ) {
			return;
		}

		const schedule = this.validateDraft();

		if ( schedule === null ) {
			await this.updateComplete;
			this.shadowRoot?.querySelector<HTMLElement>( '[aria-invalid="true"]' )?.focus();
			return;
		}

		this.saving = true;
		this.saveErrorReason = null;

		try {
			const result = await this.editor.updateSchedule( this.selectedScopeId, schedule );

			if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
				const reasons: Record<
					ProtectionConfigurationEditRejectionReason,
					ScheduleSaveErrorReasonValue
				> = {
					[ ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED ]:
						ScheduleSaveErrorReason.GENERIC,
					[ ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ]:
						ScheduleSaveErrorReason.INVALID_CONFIGURATION,
					[ ProtectionConfigurationEditRejectionReason.INVALID_DISPLAY_NAME ]:
						ScheduleSaveErrorReason.GENERIC,
					[ ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE ]:
						ScheduleSaveErrorReason.INVALID_SCHEDULE,
					[ ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID ]:
						ScheduleSaveErrorReason.GENERIC,
					[ ProtectionConfigurationEditRejectionReason.INVALID_SITE ]:
						ScheduleSaveErrorReason.GENERIC,
					[ ProtectionConfigurationEditRejectionReason.INVALID_TIMING_CONFIGURATION ]:
						ScheduleSaveErrorReason.GENERIC,
					[ ProtectionConfigurationEditRejectionReason.SCOPE_NOT_FOUND ]:
						ScheduleSaveErrorReason.SCOPE_NOT_FOUND,
					[ ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND ]:
						ScheduleSaveErrorReason.GENERIC,
				};
				this.saveErrorReason = reasons[ result.reason ];
				return;
			}

			this.configuration = result.configuration;
			this.loadScheduleDraft( result.configuration );
			this.announceSaved();
		} catch {
			this.saveErrorReason = ScheduleSaveErrorReason.GENERIC;
		} finally {
			this.saving = false;
		}
	};

	/**
	 * Renders the current loading failure and retry action.
	 * @return Recovery template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderLoadError(): TemplateResult {
		const malformed = this.loadStatus === ScheduleScreenLoadStatus.MALFORMED;

		return html`
			<div class="load-error" role="alert">
				<div>
					<h2>${ malformed ? this.copy.malformedDataTitle : this.copy.loadErrorTitle }</h2>
					<p>${ malformed ? this.copy.malformedDataDescription : this.copy.loadErrorDescription }</p>
				</div>
				<button class="retry-action secondary-action" type="button" @click=${ this.handleRetry }>
					${ this.copy.retry }
				</button>
			</div>
		`;
	}

	/**
	 * Renders the shared label or multi-scope selector.
	 * @param scopes - Ordered protection scope presentation.
	 * @return Current scope-control template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderScopeControl( scopes: ReadonlyArray<PresentedScheduleScope> ): TemplateResult {
		if ( scopes.length === 1 ) {
			return html`
				<p class="scope-summary">
					<span>${ this.copy.appliesToLabel }</span>
					<strong>${ this.copy.sharedScope }</strong>
				</p>
			`;
		}

		return html`
			<div class="scope-control">
				<label for="schedule-scope">${ this.copy.appliesToLabel }</label>
				<select
					id="schedule-scope"
					.value=${ this.selectedScopeId }
					?disabled=${ this.dirty || this.saving }
					@change=${ this.handleScopeChange }
				>
					${ scopes.map( ( scope ) => html`
						<option .value=${ scope.id }>${ scope.label }</option>
					` ) }
				</select>
			</div>
		`;
	}

	/**
	 * Renders one editable schedule window.
	 * @param window - Editable time window.
	 * @param index - Zero-based visual window position.
	 * @return Native weekday and time controls.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderWindow( window: ScheduleWindowDraft, index: number ): TemplateResult {
		const errors = this.windowErrors[ window.id ] ?? { startTimeRequired: false, endTime: null };
		const startError = errors.startTimeRequired ? this.copy.startTimeRequiredError : '';
		const endError = errors.endTime === ScheduleWindowEndErrorReason.REQUIRED
			? this.copy.endTimeRequiredError
			: errors.endTime === ScheduleWindowEndErrorReason.EQUAL_TIME
				? this.copy.equalTimeError
				: '';
		const startErrorId = `schedule-window-${ String( window.id ) }-start-error`;
		const endErrorId = `schedule-window-${ String( window.id ) }-end-error`;
		const position = index + 1;

		return html`
			<div class="schedule-window" role="group" aria-label=${ this.copy.formatWindowLabel( position ) }>
				<label>
					<span>${ this.copy.weekdayLabel }</span>
					<select
						name="weekday"
						data-window-id=${ window.id }
						?disabled=${ this.saving }
						@change=${ this.handleWeekdayChange }
					>
						${ Object.values( Weekday ).map( ( weekday ) => html`
							<option value=${ weekday } ?selected=${ weekday === window.weekday }>
								${ this.copy.formatWeekday( weekday ) }
							</option>
						` ) }
					</select>
				</label>
				<label>
					<span>${ this.copy.startTimeLabel }</span>
					<input
						name="start-time"
						type="time"
						step="60"
						data-window-id=${ window.id }
						.value=${ window.startTime }
						aria-describedby=${ startErrorId }
						aria-invalid=${ errors.startTimeRequired ? 'true' : 'false' }
						?disabled=${ this.saving }
						@input=${ this.handleStartTimeInput }
					>
					<small id=${ startErrorId } class="field-error" role="alert">${ startError }</small>
				</label>
				<label>
					<span>${ this.copy.endTimeLabel }</span>
					<input
						name="end-time"
						type="time"
						step="60"
						data-window-id=${ window.id }
						.value=${ window.endTime }
						aria-describedby=${ endErrorId }
						aria-invalid=${ errors.endTime === null ? 'false' : 'true' }
						?disabled=${ this.saving }
						@input=${ this.handleEndTimeInput }
					>
					<small id=${ endErrorId } class="field-error" role="alert">${ endError }</small>
				</label>
				<button
					class="remove-window-action secondary-action"
					type="button"
					data-action="remove-window"
					data-window-id=${ window.id }
					aria-disabled=${ this.windows.length === 1 ? 'true' : 'false' }
					aria-label=${ this.copy.formatRemoveWindowLabel( position ) }
					?disabled=${ this.saving }
					@click=${ this.handleRemoveWindow }
				>
					${ this.copy.removeWindow }
				</button>
			</div>
		`;
	}

	/**
	 * Renders the ready schedule-editing form.
	 * @return Current editable schedule template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderForm(): TemplateResult {
		const scopes = this.presentScopes();
		const saveError = this.resolveSaveError();

		return html`
			<form class="schedule-form" @submit=${ this.handleSave }>
				${ this.renderScopeControl( scopes ) }
				<fieldset class="mode-fieldset" ?disabled=${ this.saving }>
					<legend>${ this.copy.scheduleLegend }</legend>
					<div class="mode-options">
						<label class="mode-option">
							<input
								type="radio"
								name="schedule-mode"
								value=${ ScheduleMode.ALWAYS }
								.checked=${ this.scheduleMode === ScheduleMode.ALWAYS }
								@change=${ this.handleModeChange }
							>
							<span class="mode-selection" aria-hidden="true"></span>
							<span>
								<strong>${ this.copy.alwaysLabel }</strong>
								<small>${ this.copy.alwaysDescription }</small>
							</span>
						</label>
						<label class="mode-option">
							<input
								type="radio"
								name="schedule-mode"
								value=${ ScheduleMode.CUSTOM }
								.checked=${ this.scheduleMode === ScheduleMode.CUSTOM }
								@change=${ this.handleModeChange }
							>
							<span class="mode-selection" aria-hidden="true"></span>
							<span>
								<strong>${ this.copy.customLabel }</strong>
								<small>${ this.copy.customDescription }</small>
							</span>
						</label>
					</div>
				</fieldset>
				${ this.scheduleMode === ScheduleMode.CUSTOM ? html`
					<fieldset class="schedule-windows" ?disabled=${ this.saving }>
						<legend>${ this.copy.windowsLegend }</legend>
						<p class="windows-help">${ this.copy.windowsHelp }</p>
						<div class="window-list">
							${ repeat(
								this.windows,
								( window ) => window.id,
								( window, index ) => this.renderWindow( window, index ),
							) }
						</div>
						<button class="add-window-action secondary-action" type="button" @click=${ this.handleAddWindow }>
							${ this.copy.addWindow }
						</button>
					</fieldset>
				` : html`` }
				${ this.dirty && scopes.length > 1 ? html`
					<p class="dirty-notice">${ this.copy.dirtyScopeNotice }</p>
				` : html`` }
				<p class="save-error" role="alert">${ saveError }</p>
				<div class="form-actions">
					<button class="primary-action" type="submit" ?disabled=${ this.saving }>
						${ this.saving ? this.copy.saving : this.copy.save }
					</button>
					${ this.dirty ? html`
						<button class="secondary-action" type="button" ?disabled=${ this.saving } @click=${ this.handleDiscard }>
							${ this.copy.discard }
						</button>
					` : html`` }
				</div>
			</form>
		`;
	}

	/**
	 * Renders loading, recovery, or ready schedule content.
	 * @return Current Schedule screen-state template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderContent(): TemplateResult {
		if ( this.loadStatus === ScheduleScreenLoadStatus.LOADING ) {
			return html`<p class="loading-status" role="status">${ this.copy.loading }</p>`;
		}

		if (
			this.loadStatus === ScheduleScreenLoadStatus.MALFORMED ||
			this.loadStatus === ScheduleScreenLoadStatus.FAILED
		) {
			return this.renderLoadError();
		}

		return this.renderForm();
	}

	/**
	 * Renders the current per-scope schedule settings state.
	 * @return Schedule settings template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		const loading = this.loadStatus === ScheduleScreenLoadStatus.LOADING;
		const announcement = this.savedAnnouncementVisible ? this.copy.savedAnnouncement : '';

		return html`
			<main aria-labelledby="schedule-title" aria-busy=${ loading ? 'true' : 'false' }>
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="schedule-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				${ this.renderContent() }
				<p class="announcement" role="status" aria-live="polite">
					${ keyed( this.announcementSequence, html`<span>${ announcement }</span>` ) }
				</p>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the Schedule screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-schedule-screen': ComponentScheduleScreen;
	}
}
