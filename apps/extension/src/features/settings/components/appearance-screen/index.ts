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
import {
	DefaultPreferencesDocument,
	Palette,
	PauseMode,
	PreferencesDocumentSchema,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
	type PreferencesUpdate,
} from '../../../../domains/preferences/services/preferences-editor';
import styles from './web-component-style.scss?inline';
import {
	AppearanceScreenLoadStatus,
	DefaultAppearanceScreenCopy,
	type AppearanceInputEvent,
	type AppearanceOptionCopy,
	type AppearanceScreenCopy,
	type AppearanceScreenLoadStatus as AppearanceScreenLoadStatusValue,
	type PreferencesPreview,
	type PreferencesSource,
} from './types';

const THEME_OPTIONS = Object.values( ThemeMode );
const PALETTE_OPTIONS = Object.values( Palette );
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
	accessor copy: Readonly<AppearanceScreenCopy> = DefaultAppearanceScreenCopy;

	@state()
	private accessor preferences: PreferencesDocument = { ...DefaultPreferencesDocument };

	@state()
	private accessor loadStatus: AppearanceScreenLoadStatusValue = AppearanceScreenLoadStatus.LOADING;

	@state()
	private accessor saving = false;

	@state()
	private accessor saveError = '';

	@state()
	private accessor recoveryError = '';

	@state()
	private accessor announcement = '';

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
		this.preferencesRevision += 1;
		this.saveError = '';
		this.recoveryError = '';

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
		this.saveError = '';
		this.recoveryError = '';

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
	 * Retries the local preferences read and restores useful focus.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRetry = async (): Promise<void> => {
		await this.refreshPreferences();
		await this.updateComplete;

		const focusTarget = this.loadStatus === AppearanceScreenLoadStatus.READY
			? `#theme-${ this.preferences.theme }`
			: '.retry-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Replaces only malformed appearance data with validated defaults after an explicit user action.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleRestoreDefaults = async (): Promise<void> => {
		if ( this.saving || this.editor === null ) {
			return;
		}

		this.recoveryError = '';
		this.saving = true;
		const initialPreferencesRevision = this.preferencesRevision;

		try {
			const preferences = await this.editor.restoreDefaults();

			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.preferences = preferences;
				this.preview?.apply( preferences );
				this.loadStatus = AppearanceScreenLoadStatus.READY;
				this.announce( this.copy.savedAnnouncement );
			}
		} catch {
			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.recoveryError = this.copy.restoreDefaultsError;
			}
		} finally {
			this.saving = false;
		}

		await this.updateComplete;
		const focusTarget = this.loadStatus === AppearanceScreenLoadStatus.READY
			? `#theme-${ this.preferences.theme }`
			: '.restore-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Replaces the polite live-region content so repeated messages are announced.
	 * @param message - Localized status message to announce.
	 * @since 0.1.0 Initial implementation.
	 */
	private announce( message: string ): void {
		this.announcement = message;
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
			case 'theme':
				candidate = { theme: input.value };
				break;
			case 'palette':
				candidate = { palette: input.value };
				break;
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
	 * Applies and persists one user-selected preference immediately.
	 * @param event - Native changed appearance control.
	 * @return Promise resolved after local persistence settles.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handlePreferenceChange = async ( event: AppearanceInputEvent ): Promise<void> => {
		const uncheckedRadio = event.currentTarget.type === 'radio' && ! event.currentTarget.checked;

		if ( this.saving || this.editor === null || uncheckedRadio ) {
			return;
		}

		const update = this.createPreferencesUpdate( event.currentTarget );

		if ( update === null ) {
			return;
		}

		const preferences = PreferencesDocumentSchema.parse( {
			...this.preferences,
			...update,
		} );

		const focusTargetId = event.currentTarget.id;

		this.preferences = preferences;
		this.preview?.apply( preferences );
		const initialPreferencesRevision = this.preferencesRevision;
		this.saveError = '';
		this.announcement = '';
		this.saving = true;

		try {
			const updatedPreferences = await this.editor.update( update );

			if ( initialPreferencesRevision === this.preferencesRevision ) {
				if ( updatedPreferences === null ) {
					this.loadStatus = AppearanceScreenLoadStatus.MALFORMED;
				} else {
					this.preferences = updatedPreferences;
					this.preview?.apply( updatedPreferences );
					this.announce( this.copy.savedAnnouncement );
				}
			}
		} catch {
			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.saveError = this.copy.saveError;
			}
		} finally {
			this.saving = false;
		}

		await this.updateComplete;
		const focusTarget = this.loadStatus === AppearanceScreenLoadStatus.READY
			? `#${ focusTargetId }`
			: '.restore-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Renders one theme or pause-style option.
	 * @param name - Native radio-group name.
	 * @param value - Persisted preference value.
	 * @param selected - Whether the option is selected.
	 * @param copy - Localizable label and supporting text.
	 * @return Semantic native radio option.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderDescribedOption(
		name: string,
		value: string,
		selected: boolean,
		copy: Readonly<AppearanceOptionCopy>,
	): TemplateResult {
		const id = `${ name }-${ value }`;

		return html`
			<label class="option" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name=${ name }
					value=${ value }
					.checked=${ selected }
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
	 * Renders one named palette option with a visible color sample.
	 * @param palette - Persisted palette value.
	 * @return Semantic native palette radio option.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderPaletteOption( palette: Palette ): TemplateResult {
		const id = `palette-${ palette }`;

		return html`
			<label class="option option--palette" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name="palette"
					value=${ palette }
					.checked=${ this.preferences.palette === palette }
					?disabled=${ this.saving }
					@change=${ this.handlePreferenceChange }
				>
				<span class="selection" aria-hidden="true"></span>
				<span class="swatch" data-palette=${ palette } aria-hidden="true"></span>
				<strong>${ this.copy.paletteLabels[ palette ] }</strong>
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
					${ this.recoveryError === '' ? null : html`<p>${ this.recoveryError }</p>` }
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

		return html`
			<main aria-labelledby="appearance-title">
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="appearance-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				<form class="appearance-form" aria-label=${ this.copy.formLabel } aria-busy=${ this.saving ? 'true' : 'false' }>
					<fieldset>
						<legend>${ this.copy.themeLegend }</legend>
						<div class="options options--theme">
							${ THEME_OPTIONS.map( ( theme ) => this.renderDescribedOption(
								'theme',
								theme,
								this.preferences.theme === theme,
								this.copy.themeOptions[ theme ],
							) ) }
						</div>
					</fieldset>
					<fieldset>
						<legend>${ this.copy.paletteLegend }</legend>
						<p class="field-help">${ this.copy.paletteHelp }</p>
						<div class="options options--palette">
							${ PALETTE_OPTIONS.map( ( palette ) => this.renderPaletteOption( palette ) ) }
						</div>
					</fieldset>
					<fieldset>
						<legend>${ this.copy.pauseModeLegend }</legend>
						<div class="options options--pause">
							${ PAUSE_MODE_OPTIONS.map( ( pauseMode ) => this.renderDescribedOption(
								'pause-mode',
								pauseMode,
								this.preferences.pauseMode === pauseMode,
								this.copy.pauseModeOptions[ pauseMode ],
							) ) }
						</div>
					</fieldset>
					<fieldset>
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
					${ this.saveError === '' ? null : html`<p class="save-error" role="alert">${ this.saveError }</p>` }
					<p class="save-status" role="status" aria-live="polite">
						${ this.announcement === ''
							? null
							: keyed( this.announcementSequence, html`<span>${ this.announcement }</span>` ) }
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
