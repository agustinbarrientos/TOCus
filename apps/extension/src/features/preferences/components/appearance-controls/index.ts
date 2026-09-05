import iconMarkup from '@tocus/theme/icon.svg?raw';
import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
	type ThemeMode as ThemeModeValue,
} from '../../../../domains/preferences/types';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import styles from './web-component-style.scss?inline';
import {
	AppearanceControlsChangeEventName,
	type AppearanceControlsChangeDetail,
	type AppearanceControlsCopy,
	type AppearanceControlsInputEvent,
	type AppearanceControlsUpdate,
} from './types';

/**
 * Theme order shared by onboarding and Settings.
 * @since 0.1.0 Initial implementation.
 */
const ThemeOptions: readonly ThemeModeValue[] = Object.freeze( [
	ThemeMode.LIGHT,
	ThemeMode.DARK,
	ThemeMode.SYSTEM,
] );

/**
 * Palette order shared by onboarding and Settings.
 * @since 0.1.0 Initial implementation.
 */
const PaletteOptions: readonly PaletteValue[] = Object.freeze( [
	Palette.BROWN,
	Palette.GREEN,
	Palette.BLUE,
	Palette.PURPLE,
	Palette.PINK,
	Palette.ORANGE,
] );

/**
 * Renders the shared controlled theme and palette selectors used by onboarding and Settings.
 * @element tocus-f-appearance-controls
 * @summary Shared theme and palette controls.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-appearance-controls' )
export class ComponentAppearanceControls extends LitElement {
	/**
	 * Shadow-root styles for the shared appearance controls.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Appearance mode selected by the owning form.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor theme: ThemeModeValue = ThemeMode.SYSTEM;

	/**
	 * Full-scene palette selected by the owning form.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor palette: PaletteValue = Palette.BROWN;

	/**
	 * Whether every control is temporarily unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true, type: Boolean } )
	accessor disabled = false;

	/**
	 * Localized copy for theme and palette controls.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<AppearanceControlsCopy>;

	/**
	 * Moves keyboard focus to one appearance control when it exists.
	 * @param controlId - Native control identifier without a selector prefix.
	 * @since 0.1.0 Initial implementation.
	 */
	focusControl( controlId: string ): void {
		this.shadowRoot?.querySelector<HTMLElement>( `#${ CSS.escape( controlId ) }` )?.focus();
	}

	/**
	 * Emits one exact controlled preference update.
	 * @param update - Exact preference value selected by the user.
	 * @since 0.1.0 Initial implementation.
	 */
	private emitChange( update: AppearanceControlsUpdate ): void {
		this.dispatchEvent( new CustomEvent<AppearanceControlsChangeDetail>(
			AppearanceControlsChangeEventName,
			{
				bubbles: true,
				composed: true,
				detail: { update },
			},
		) );
	}

	/**
	 * Validates and emits one native appearance-control change.
	 * @param event - Changed native appearance control.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleChange = ( event: AppearanceControlsInputEvent ): void => {
		const input = event.currentTarget;

		if ( this.disabled || ( input.type === 'radio' && ! input.checked ) ) {
			return;
		}

		if ( input.name === 'theme' ) {
			const theme = ThemeOptions.find( ( option ) => option === input.value );

			if ( theme !== undefined ) {
				this.emitChange( { theme } );
			}

			return;
		}

		if ( input.name === 'palette' ) {
			const palette = PaletteOptions.find( ( option ) => option === input.value );

			if ( palette !== undefined ) {
				this.emitChange( { palette } );
			}

			return;
		}

	};

	/**
	 * Renders one miniature light or dark TOCus surface.
	 * @param theme - Concrete light or dark theme represented by the pane.
	 * @return Miniature theme content pane.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderThemePane( theme: typeof ThemeMode.LIGHT | typeof ThemeMode.DARK ): TemplateResult {
		return html`
			<span class="theme-preview-pane" data-preview-theme=${ theme }>
				<span class="theme-preview-line theme-preview-line--wide"></span>
				<span class="theme-preview-line"></span>
			</span>
		`;
	}

	/**
	 * Renders one selected or available theme mode.
	 * @param theme - Supported theme mode.
	 * @return Native radio wrapped around a miniature interface preview.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderThemeOption( theme: ThemeModeValue ): TemplateResult {
		const id = `theme-${ theme }`;
		const optionCopy = this.copy.themeOptions[ theme ];

		return html`
			<label class="theme-option" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name="theme"
					value=${ theme }
					.checked=${ this.theme === theme }
					?disabled=${ this.disabled }
					@change=${ this.handleChange }
				>
				<span class="theme-option-surface">
					<span
						class="theme-preview ${ theme === ThemeMode.SYSTEM ? 'theme-preview--system' : '' }"
						data-preview-theme=${ theme === ThemeMode.LIGHT ? ThemeMode.LIGHT : ThemeMode.DARK }
						aria-hidden="true"
					>
						<span class="theme-preview-brand">
							<span class="theme-preview-icon">${ unsafeSVG( iconMarkup ) }</span>
							<span>TOCus</span>
						</span>
						${ theme === ThemeMode.SYSTEM
							? html`${ this.renderThemePane( ThemeMode.DARK ) }${ this.renderThemePane( ThemeMode.LIGHT ) }`
							: this.renderThemePane( theme ) }
					</span>
					<span class="selection-mark" aria-hidden="true"></span>
				</span>
				<strong>${ optionCopy.label }</strong>
				<small class="visually-hidden">${ optionCopy.description }</small>
			</label>
		`;
	}

	/**
	 * Renders one compact palette choice.
	 * @param palette - Supported full-scene palette.
	 * @return Native radio with a clay-style square swatch.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderPaletteOption( palette: PaletteValue ): TemplateResult {
		const id = `palette-${ palette }`;
		const label = this.copy.paletteLabels[ palette ];

		return html`
			<label class="palette-option" for=${ id }>
				<input
					id=${ id }
					type="radio"
					name="palette"
					value=${ palette }
					.checked=${ this.palette === palette }
					?disabled=${ this.disabled }
					@change=${ this.handleChange }
				>
				<span class="palette-option-swatch" data-palette=${ palette } aria-hidden="true">
					<span class="selection-mark"></span>
				</span>
				<strong class="palette-option-label">${ label }</strong>
			</label>
		`;
	}

	/**
	 * Renders the shared appearance sections supplied by the owning form.
	 * @return Shared appearance controls or an empty template until copy is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}

		return html`
			<div class="controls">
				<fieldset class="controls-section">
					<legend>${ this.copy.themeLegend }</legend>
					<div class="theme-options">
						${ ThemeOptions.map( ( theme ) => this.renderThemeOption( theme ) ) }
					</div>
				</fieldset>
				<fieldset class="controls-section">
					<legend>${ this.copy.paletteLegend }</legend>
					${ this.copy.paletteHelp === undefined || this.copy.paletteHelp === ''
						? null
						: html`<p class="field-help">${ this.copy.paletteHelp }</p>` }
					<div class="palette-options">
						${ PaletteOptions.map( ( palette ) => this.renderPaletteOption( palette ) ) }
					</div>
				</fieldset>
			</div>
		`;
	}
}

export {
	AppearanceControlsChangeEventName,
	type AppearanceControlsChangeDetail,
	type AppearanceControlsCopy,
	type AppearanceControlsOptionCopy,
	type AppearanceControlsUpdate,
} from './types';

declare global {
	/**
	 * Maps the shared appearance-controls tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-appearance-controls': ComponentAppearanceControls;
	}
}
