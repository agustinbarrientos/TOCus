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
	DefaultPreferencesDocument,
	PauseMode,
	PreferencesDocumentSchema,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
	type PreferencesUpdate,
} from '../../../../domains/preferences/services/preferences-editor';
import { arePreferencesEqual } from '../../../../domains/preferences/utils/are-preferences-equal';
import '../../../preferences/components/appearance-controls';
import type { AppearanceControlsChangeDetail } from '../../../preferences/components/appearance-controls/types';
import styles from './web-component-style.scss?inline';
import {
	AppearanceScreenLoadStatus,
	type AppearanceInputEvent,
	type AppearanceScreenCopy,
	type AppearanceScreenLoadStatus as AppearanceScreenLoadStatusValue,
	type PreferencesPreview,
	type PreferencesSource,
} from './types';

const PAUSE_MODE_OPTIONS = Object.values( PauseMode );

/**
 * Renders editable appearance, pause presentation, and motion preferences.
 * @element tocus-f-appearance-screen
 * @summary Appearance and accessibility settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-appearance-screen' )
export class ComponentAppearanceScreen extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Coordinated local preferences editor used by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: PreferencesEditor | null = null;

	/**
	 * Optional live projection used to preview loaded and edited preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor preview: PreferencesPreview | null = null;

	/**
	 * Optional source of validated projections from this and other extension contexts.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor source: PreferencesSource | null = null;

	/**
	 * Complete localizable messages rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<AppearanceScreenCopy>;

	@state()
	private accessor preferences: PreferencesDocument = { ...DefaultPreferencesDocument };

	@state()
	private accessor loadStatus: AppearanceScreenLoadStatusValue = AppearanceScreenLoadStatus.LOADING;

	@state()
	private accessor saving = false;

	@state()
	private accessor saveFailed = false;

	@state()
	private accessor recoveryFailed = false;

	@state()
	private accessor showSavedAnnouncement = false;

	@state()
	private accessor showRestoredAnnouncement = false;

	@state()
	private accessor announcementSequence = 0;

	private observedSource: PreferencesSource | null = null;

	private preferencesRevision = 0;

	private refreshGeneration = 0;

	/**
	 * Loads local preferences after all template properties are assigned.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override firstUpdated(): void {
		void this.refreshPreferences();
	}

	/**
	 * Restores preference observation whenever an existing screen reconnects.
	 * @since 0.1.0 Initial implementation.
	 */
	override connectedCallback(): void {
		super.connectedCallback();
		this.synchronizePreferencesSource();

		if ( this.hasUpdated ) {
			void this.refreshPreferences();
		}
	}

	/**
	 * Synchronizes the source subscription after a dependency change.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override updated( changedProperties: PropertyValues<this> ): void {
		if ( changedProperties.has( 'source' ) ) {
			this.synchronizePreferencesSource();
		}
	}

	/**
	 * Stops observing preferences projections after the screen disconnects.
	 * @since 0.1.0 Initial implementation.
	 */
	override disconnectedCallback(): void {
		this.refreshGeneration += 1;
		this.observedSource?.removePreferencesChangeListener( this.handleExternalPreferencesChange );
		this.observedSource = null;
		super.disconnectedCallback();
	}

	/**
	 * Applies one validated projection or malformed-data marker produced by another local context.
	 * @param preferences - Complete preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleExternalPreferencesChange = (
		preferences: PreferencesDocument | null,
	): void => {
		const duplicatesCurrentProjection = preferences !== null && arePreferencesEqual(
			preferences,
			this.preferences,
		);

		if ( ! duplicatesCurrentProjection ) {
			this.preferencesRevision += 1;
			this.showSavedAnnouncement = false;
			this.showRestoredAnnouncement = false;
		}

		this.saveFailed = false;
		this.recoveryFailed = false;

		if ( preferences === null ) {
			this.loadStatus = AppearanceScreenLoadStatus.MALFORMED;
			return;
		}

		this.preferences = preferences;
		this.loadStatus = AppearanceScreenLoadStatus.READY;
	};

	/**
	 * Replaces the currently observed preferences projection source.
	 * @since 0.1.0 Initial implementation.
	 */
	private synchronizePreferencesSource(): void {
		if ( this.observedSource === this.source ) {
			return;
		}

		this.observedSource?.removePreferencesChangeListener( this.handleExternalPreferencesChange );
		this.observedSource = this.source;
		this.observedSource?.addPreferencesChangeListener( this.handleExternalPreferencesChange );
	}

	/**
	 * Loads validated local preferences without replacing malformed data.
	 * @return Promise resolved after the screen state is updated.
	 * @since 0.1.0 Initial implementation.
	 */
	async refreshPreferences(): Promise<void> {
		this.refreshGeneration += 1;
		const currentRefreshGeneration = this.refreshGeneration;
		const initialPreferencesRevision = this.preferencesRevision;

		this.loadStatus = AppearanceScreenLoadStatus.LOADING;
		this.saveFailed = false;
		this.recoveryFailed = false;

		if ( this.editor === null ) {
			this.loadStatus = AppearanceScreenLoadStatus.FAILED;
			return;
		}

		try {
			const preferences = await this.editor.load();

			if (
				currentRefreshGeneration !== this.refreshGeneration ||
				initialPreferencesRevision !== this.preferencesRevision
			) {
				return;
			}

			if ( preferences === null ) {
				this.loadStatus = AppearanceScreenLoadStatus.MALFORMED;
				return;
			}

			this.preferences = preferences;
			this.preview?.apply( preferences );
			this.loadStatus = AppearanceScreenLoadStatus.READY;
		} catch {
			if (
				currentRefreshGeneration === this.refreshGeneration &&
				initialPreferencesRevision === this.preferencesRevision
			) {
				this.loadStatus = AppearanceScreenLoadStatus.FAILED;
			}
		}
	}

	/**
	 * Moves focus to a Settings-owned input or a nested shared appearance control.
	 * @param controlId - Native preference-control identifier without a selector prefix.
	 * @return Promise resolved after a nested shared control is ready and focused.
	 * @since 0.1.0 Initial implementation.
	 */
	private async focusPreferenceControl( controlId: string ): Promise<void> {
		const sharedControl = controlId.startsWith( 'theme-' ) || controlId.startsWith( 'palette-' );

		if ( sharedControl ) {
			const appearanceControls = this.shadowRoot?.querySelector( 'tocus-f-appearance-controls' );

			if ( appearanceControls !== null && appearanceControls !== undefined ) {
				await appearanceControls.updateComplete;
				appearanceControls.focusControl( controlId );
				return;
			}
		}

		this.shadowRoot
			?.querySelector<HTMLElement>( `#${ CSS.escape( controlId ) }` )
			?.focus();
	}

	/**
	 * Retries the local preferences read and restores useful focus.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = async (): Promise<void> => {
		await this.refreshPreferences();
		await this.updateComplete;

		if ( this.loadStatus === AppearanceScreenLoadStatus.READY ) {
			await this.focusPreferenceControl( `theme-${ this.preferences.theme }` );
		} else {
			this.shadowRoot?.querySelector<HTMLElement>( '.retry-action' )?.focus();
		}
	};

	/**
	 * Replaces malformed personalization data with validated defaults after an explicit user action.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRestoreDefaults = async (): Promise<void> => {
		if ( this.saving || this.editor === null ) {
			return;
		}

		this.preferences = { ...DefaultPreferencesDocument };
		this.recoveryFailed = false;
		this.showSavedAnnouncement = false;
		this.showRestoredAnnouncement = false;
		this.saving = true;
		const initialPreferencesRevision = this.preferencesRevision;

		try {
			const preferences = await this.editor.restoreDefaults();

			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.preferences = preferences;
				this.preview?.apply( preferences );
				this.loadStatus = AppearanceScreenLoadStatus.READY;
				this.showRestoredAnnouncement = true;
				this.announcementSequence += 1;
			}
		} catch {
			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.recoveryFailed = true;
			}
		} finally {
			this.saving = false;
		}

		await this.updateComplete;

		if ( this.loadStatus === AppearanceScreenLoadStatus.READY ) {
			await this.focusPreferenceControl( `theme-${ this.preferences.theme }` );
		} else {
			this.shadowRoot?.querySelector<HTMLElement>( '.restore-action' )?.focus();
		}
	};

	/**
	 * Shows the appearance-saved live-region message with a new announcement identity.
	 * @since 0.1.0 Initial implementation.
	 */
	private announceSaved(): void {
		this.showSavedAnnouncement = true;
		this.showRestoredAnnouncement = false;
		this.announcementSequence += 1;
	}

	/**
	 * Creates one validated preference update from a changed native input.
	 * @param input - Changed preference control.
	 * @return Valid preference update or null for an unsupported control.
	 * @since 0.1.0 Initial implementation.
	 */
	private createPreferencesUpdate( input: HTMLInputElement ): PreferencesUpdate | null {
		let candidate: unknown;

		switch ( input.name ) {
			case 'pause-mode':
				candidate = { pauseMode: input.value };
				break;
			case 'reduced-motion':
				candidate = { reducedMotion: input.checked };
				break;
			default:
				return null;
		}

		const result = PreferencesUpdateSchema.safeParse( candidate );

		return result.success ? result.data : null;
	}

	/**
	 * Applies and persists one validated user-selected preference immediately.
	 * @param update - Exact validated preference update.
	 * @param focusTargetId - Native control identifier restored after persistence.
	 * @return Promise resolved after local persistence settles.
	 * @since 0.1.0 Initial implementation.
	 */
	private async persistPreferenceUpdate(
		update: PreferencesUpdate,
		focusTargetId: string,
	): Promise<void> {
		if ( this.saving || this.editor === null ) {
			return;
		}

		const preferences = PreferencesDocumentSchema.parse( {
			...this.preferences,
			...update,
		} );

		this.preferences = preferences;
		this.preview?.apply( preferences );
		const initialPreferencesRevision = this.preferencesRevision;
		this.saveFailed = false;
		this.showSavedAnnouncement = false;
		this.showRestoredAnnouncement = false;
		this.saving = true;

		try {
			const updatedPreferences = await this.editor.update( update );

			if ( initialPreferencesRevision === this.preferencesRevision ) {
				if ( updatedPreferences === null ) {
					this.loadStatus = AppearanceScreenLoadStatus.MALFORMED;
				} else {
					this.preferences = updatedPreferences;
					this.preview?.apply( updatedPreferences );
					this.announceSaved();
				}
			}
		} catch {
			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.saveFailed = true;
			}
		} finally {
			this.saving = false;
		}

		await this.updateComplete;

		if ( this.loadStatus === AppearanceScreenLoadStatus.READY ) {
			await this.focusPreferenceControl( focusTargetId );
		} else {
			this.shadowRoot?.querySelector<HTMLElement>( '.restore-action' )?.focus();
		}
	}

	/**
	 * Validates and persists one shared theme or palette selection.
	 * @param event - Shared controlled appearance change.
	 * @return Promise resolved after local persistence settles.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAppearanceControlsChange = async (
		event: CustomEvent<AppearanceControlsChangeDetail>,
	): Promise<void> => {
		event.stopPropagation();
		const result = PreferencesUpdateSchema.safeParse( event.detail.update );

		if ( ! result.success ) {
			return;
		}

		let focusTargetId: string;

		if ( 'theme' in event.detail.update ) {
			focusTargetId = `theme-${ event.detail.update.theme }`;
		} else if ( 'palette' in event.detail.update ) {
			focusTargetId = `palette-${ event.detail.update.palette }`;
		} else {
			return;
		}

		await this.persistPreferenceUpdate( result.data, focusTargetId );
	};

	/**
	 * Validates and persists one Settings-owned pause or accessibility selection.
	 * @param event - Native changed Settings-only control.
	 * @return Promise resolved after local persistence settles.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handlePreferenceChange = async ( event: AppearanceInputEvent ): Promise<void> => {
		const uncheckedRadio = event.currentTarget.type === 'radio' && ! event.currentTarget.checked;

		if ( uncheckedRadio ) {
			return;
		}

		const update = this.createPreferencesUpdate( event.currentTarget );

		if ( update === null ) {
			return;
		}

		await this.persistPreferenceUpdate( update, event.currentTarget.id );
	};

	/**
	 * Renders one pause-style option.
	 * @param pauseMode - Persisted pause presentation mode.
	 * @return Semantic native radio option.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderPauseModeOption( pauseMode: PauseMode ): TemplateResult {
		const id = `pause-mode-${ pauseMode }`;
		const copy = this.copy.pauseModeOptions[ pauseMode ];

		return html`
			<label class="option" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name="pause-mode"
					value=${ pauseMode }
					.checked=${ this.preferences.pauseMode === pauseMode }
					?disabled=${ this.saving }
					@change=${ this.handlePreferenceChange }
				>
				<span class="selection" aria-hidden="true"></span>
				<span class="option__copy">
					<strong>${ copy.label }</strong>
					<small>${ copy.description }</small>
				</span>
			</label>
		`;
	}

	/**
	 * Renders the current loading or local recovery state.
	 * @return Loading, recovery, or empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderLoadState(): TemplateResult {
		if ( this.loadStatus === AppearanceScreenLoadStatus.LOADING ) {
			return html`<p class="loading-status" role="status">${ this.copy.loading }</p>`;
		}

		const malformed = this.loadStatus === AppearanceScreenLoadStatus.MALFORMED;

		return html`
			<div class="load-error" role="alert">
				<div>
					<h2>${ malformed ? this.copy.malformedDataTitle : this.copy.loadErrorTitle }</h2>
					<p>${ malformed ? this.copy.malformedDataDescription : this.copy.loadErrorDescription }</p>
					${ this.recoveryFailed ? html`<p>${ this.copy.restoreDefaultsError }</p>` : null }
				</div>
				<button
					class=${ malformed ? 'restore-action' : 'retry-action' }
					type="button"
					?disabled=${ this.saving }
					@click=${ malformed ? this.handleRestoreDefaults : this.handleRetry }
				>
					${ malformed ? this.copy.restoreDefaults : this.copy.retry }
				</button>
			</div>
		`;
	}

	/**
	 * Renders appearance and accessibility preference controls.
	 * @return Appearance settings template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		if ( this.loadStatus !== AppearanceScreenLoadStatus.READY ) {
			return html`
				<main aria-labelledby="appearance-title">
					<header>
						<p class="eyebrow">${ this.copy.eyebrow }</p>
						<h1 id="appearance-title">${ this.copy.title }</h1>
						<p class="introduction">${ this.copy.introduction }</p>
					</header>
					${ this.renderLoadState() }
				</main>
			`;
		}

		const announcement = this.showRestoredAnnouncement
			? this.copy.restoredAnnouncement
			: this.showSavedAnnouncement
				? this.copy.savedAnnouncement
				: '';

		return html`
			<main aria-labelledby="appearance-title">
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="appearance-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				<form class="appearance-form" aria-label=${ this.copy.formLabel } aria-busy=${ this.saving ? 'true' : 'false' }>
					<tocus-f-appearance-controls
						.copy=${ this.copy }
						.theme=${ this.preferences.theme }
						.palette=${ this.preferences.palette }
						.disabled=${ this.saving }
						@tocus-appearance-controls-change=${ this.handleAppearanceControlsChange }
					></tocus-f-appearance-controls>
					<fieldset class="settings-section">
						<legend>${ this.copy.pauseModeLegend }</legend>
						<div class="options options--pause">
							${ PAUSE_MODE_OPTIONS.map( ( pauseMode ) => this.renderPauseModeOption( pauseMode ) ) }
						</div>
					</fieldset>
					<fieldset class="settings-section">
						<legend>${ this.copy.accessibilityLegend }</legend>
						<label class="motion-option" for="reduced-motion">
							<input
								id="reduced-motion"
								type="checkbox"
								name="reduced-motion"
								.checked=${ this.preferences.reducedMotion }
								?disabled=${ this.saving }
								@change=${ this.handlePreferenceChange }
							>
							<span>
								<strong>${ this.copy.reducedMotionLabel }</strong>
								<small>${ this.copy.reducedMotionDescription }</small>
							</span>
						</label>
					</fieldset>
					${ this.saveFailed ? html`<p class="save-error" role="alert">${ this.copy.saveError }</p>` : null }
					<p class="save-status" role="status" aria-live="polite">
						${ announcement === ''
							? null
							: keyed( this.announcementSequence, html`<span>${ announcement }</span>` ) }
					</p>
				</form>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the appearance-screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-appearance-screen': ComponentAppearanceScreen;
	}
}
