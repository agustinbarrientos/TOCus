import { LitElement, css, html, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	DefaultPreferencesDocument,
	Language,
	LanguageSchema,
	PreferencesDocumentSchema,
	type Language as LanguageValue,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
	type PreferencesUpdate,
} from '../../../../domains/preferences/services/preferences-editor';
import { arePreferencesEqual } from '../../../../domains/preferences/utils/are-preferences-equal';
import { getLanguageTag } from '../../../../domains/preferences/utils/resolve-language';
import styles from './web-component-style.scss?inline';
import {
	LanguageNames,
	LanguageOptions,
	LanguageScreenLoadStatus,
	type LanguagePreferencesPreview,
	type LanguagePreferencesSource,
	type LanguageScreenCopy,
	type LanguageScreenLoadStatus as LanguageScreenLoadStatusValue,
	type LanguageSelectEvent,
} from './types';

/**
 * Finds the fixed native label for one supported language.
 * @param language - Supported TOCus language.
 * @return Native language label.
 * @since 0.1.0 Initial implementation.
 */
function getLanguageName( language: LanguageValue ): string {
	return LanguageNames[ language ];
}

/**
 * Renders and immediately persists the extension display-language preference.
 * @element tocus-f-language-screen
 * @summary Language settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-language-screen' )
export class ComponentLanguageScreen extends LitElement {
	/**
	 * Shadow-root styles for the Language settings screen.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Coordinated local preferences editor used by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: PreferencesEditor | null = null;

	/**
	 * Live preferences projection used before persistence settles.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor preview: LanguagePreferencesPreview | null = null;

	/**
	 * Validated preference projections produced by local extension contexts.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor source: LanguagePreferencesSource | null = null;

	/**
	 * Supported language currently derived from the browser UI locale.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor browserLanguage: LanguageValue = Language.ENGLISH;

	/**
	 * Complete localizable messages rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<LanguageScreenCopy>;

	@state()
	private accessor preferences: PreferencesDocument = { ...DefaultPreferencesDocument };

	@state()
	private accessor loadStatus: LanguageScreenLoadStatusValue = LanguageScreenLoadStatus.LOADING;

	@state()
	private accessor saving = false;

	@state()
	private accessor saveFailed = false;

	@state()
	private accessor recoveryFailed = false;

	@state()
	private accessor savedAnnouncementSequence = 0;

	@state()
	private accessor showSavedAnnouncement = false;

	@state()
	private accessor showRestoredAnnouncement = false;

	private observedSource: LanguagePreferencesSource | null = null;

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
			this.loadStatus = LanguageScreenLoadStatus.MALFORMED;
			return;
		}

		this.preferences = preferences;
		this.loadStatus = LanguageScreenLoadStatus.READY;
	};

	/**
	 * Replaces the currently observed preference projection source.
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

		this.loadStatus = LanguageScreenLoadStatus.LOADING;
		this.saveFailed = false;
		this.recoveryFailed = false;

		if ( this.editor === null ) {
			this.loadStatus = LanguageScreenLoadStatus.FAILED;
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
				this.loadStatus = LanguageScreenLoadStatus.MALFORMED;
				return;
			}

			this.preferences = preferences;
			this.preview?.apply( preferences );
			this.loadStatus = LanguageScreenLoadStatus.READY;
		} catch {
			if (
				currentRefreshGeneration === this.refreshGeneration &&
				initialPreferencesRevision === this.preferencesRevision
			) {
				this.loadStatus = LanguageScreenLoadStatus.FAILED;
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

		const focusTarget = this.loadStatus === LanguageScreenLoadStatus.READY
			? '#language'
			: this.loadStatus === LanguageScreenLoadStatus.MALFORMED
				? '.restore-action'
				: '.retry-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Replaces malformed personalization data with validated defaults after an explicit user action.
	 * @return Promise resolved after local recovery settles.
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
				this.loadStatus = LanguageScreenLoadStatus.READY;
				this.savedAnnouncementSequence += 1;
				this.showRestoredAnnouncement = true;
			}
		} catch {
			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.recoveryFailed = true;
			}
		} finally {
			this.saving = false;
		}

		await this.updateComplete;
		const focusTarget = this.loadStatus === LanguageScreenLoadStatus.READY
			? '#language'
			: '.restore-action';
		this.shadowRoot?.querySelector<HTMLElement>( focusTarget )?.focus();
	};

	/**
	 * Parses one native select value into a validated language update.
	 * @param value - Native select value.
	 * @return Validated language update or null for an unsupported value.
	 * @since 0.1.0 Initial implementation.
	 */
	private createLanguageUpdate( value: string ): PreferencesUpdate | null {
		const language = value === '' ? null : LanguageSchema.safeParse( value );
		const candidate = language === null
			? { language: null }
			: language.success
				? { language: language.data }
				: null;

		if ( candidate === null ) {
			return null;
		}

		return PreferencesUpdateSchema.parse( candidate );
	}

	/**
	 * Applies and persists one selected language immediately.
	 * @param event - Native changed language control.
	 * @return Promise resolved after local persistence settles.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleLanguageChange = async ( event: LanguageSelectEvent ): Promise<void> => {
		if ( this.saving || this.editor === null ) {
			return;
		}

		const update = this.createLanguageUpdate( event.currentTarget.value );

		if ( update === null ) {
			event.currentTarget.value = this.preferences.language ?? '';
			return;
		}

		const previousPreferences = this.preferences;
		const preferences = PreferencesDocumentSchema.parse( {
			...previousPreferences,
			...update,
		} );
		this.preferences = preferences;
		this.showSavedAnnouncement = false;
		this.showRestoredAnnouncement = false;
		this.preview?.apply( preferences );
		const initialPreferencesRevision = this.preferencesRevision;

		this.saveFailed = false;
		this.saving = true;

		try {
			const updatedPreferences = await this.editor.update( update );

			if ( initialPreferencesRevision === this.preferencesRevision ) {
				if ( updatedPreferences === null ) {
					this.preview?.apply( previousPreferences );
					this.loadStatus = LanguageScreenLoadStatus.MALFORMED;
				} else {
					this.preferences = updatedPreferences;
					this.preview?.apply( updatedPreferences );
					this.savedAnnouncementSequence += 1;
					this.showSavedAnnouncement = true;
				}
			}
		} catch {
			if ( initialPreferencesRevision === this.preferencesRevision ) {
				this.preferences = previousPreferences;
				this.preview?.apply( previousPreferences );
				this.saveFailed = true;
			}
		} finally {
			this.saving = false;
		}

		await this.updateComplete;
		this.shadowRoot?.querySelector<HTMLSelectElement>( '#language' )?.focus();
	};

	/**
	 * Renders the current loading or local-data state.
	 * @return Loading, recovery, or empty template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderLoadState(): TemplateResult {
		if ( this.loadStatus === LanguageScreenLoadStatus.LOADING ) {
			return html`<p class="loading-status" role="status">${ this.copy.loading }</p>`;
		}

		const malformed = this.loadStatus === LanguageScreenLoadStatus.MALFORMED;

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
	 * Renders the browser-following helper or explicit-choice explanation.
	 * @return Current language selection explanation.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderSelectionDescription(): string {
		return this.preferences.language === null
			? this.copy.formatBrowserLanguageDescription( getLanguageName( this.browserLanguage ) )
			: this.copy.explicitLanguageDescription;
	}

	/**
	 * Renders the native language selector and local persistence state.
	 * @return Language preference form.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderForm(): TemplateResult {
		const announcement = this.showRestoredAnnouncement
			? this.copy.restoredAnnouncement
			: this.showSavedAnnouncement
				? this.copy.savedAnnouncement
				: '';

		return html`
			<form
				class="language-form"
				aria-busy=${ this.saving ? 'true' : 'false' }
				aria-label=${ this.copy.formLabel }
			>
				<label for="language">${ this.copy.languageLabel }</label>
				<select
					id="language"
					name="language"
					aria-describedby="language-help"
					.value=${ this.preferences.language ?? '' }
					?disabled=${ this.saving }
					@change=${ this.handleLanguageChange }
				>
					<option value="" ?selected=${ this.preferences.language === null }>
						${ this.copy.browserLanguageOption }
					</option>
					${ LanguageOptions.map( ( option ) => html`
						<option
							value=${ option.language }
							lang=${ getLanguageTag( option.language ) }
							?selected=${ this.preferences.language === option.language }
						>${ option.label }</option>
					` ) }
				</select>
				<p class="field-help" id="language-help">${ this.renderSelectionDescription() }</p>
				<p class="save-error" role="alert">${ this.saveFailed ? this.copy.saveError : '' }</p>
				<p class="save-status" role="status" aria-live="polite">
					${ announcement === ''
						? ''
						: keyed( this.savedAnnouncementSequence, announcement ) }
				</p>
			</form>
		`;
	}

	/**
	 * Renders the Language settings controls and their local-data states.
	 * @return Language settings template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		return html`
			<main
				aria-busy=${ this.loadStatus === LanguageScreenLoadStatus.LOADING ? 'true' : 'false' }
				aria-labelledby="language-title"
			>
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<h1 id="language-title">${ this.copy.title }</h1>
					<p class="introduction">${ this.copy.introduction }</p>
				</header>
				${ this.loadStatus === LanguageScreenLoadStatus.READY
					? this.renderForm()
					: this.renderLoadState() }
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the Language screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-language-screen': ComponentLanguageScreen;
	}
}
