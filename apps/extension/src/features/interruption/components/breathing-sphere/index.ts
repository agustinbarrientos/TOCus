import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import {
	readBreathingSphereColors,
	renderBreathingSphereFrame,
	resizeBreathingSphereCanvas,
} from '../../utils/breathing-sphere-renderer';
import { type BreathingSphereColors } from '../../utils/breathing-sphere-renderer/types';
import styles from './web-component-style.scss?inline';

/**
 * Renders the approved clay Breathing Sphere from deterministic presentation progress.
 * @element tocus-f-breathing-sphere
 * @attr breath-progress - Normalized Natural breathing progress.
 * @attr still - Whether the sphere remains still and dimensional.
 * @summary Responsive decorative Breathing Sphere Canvas.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-breathing-sphere' )
export class ComponentBreathingSphere extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Normalized Natural breathing progress from the owning screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'breath-progress', type: Number } )
	accessor breathProgress = 0;

	/**
	 * Whether the sphere must remain still for Quiet pause or reduced motion.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true, type: Boolean } )
	accessor still = false;

	@query( 'canvas' )
	private accessor canvasElement!: HTMLCanvasElement;

	@query( '.color-probe' )
	private accessor colorProbe!: HTMLSpanElement;

	private appearanceObserver: MutationObserver | null = null;

	private resizeObserver: ResizeObserver | null = null;

	private colorSchemeQuery: MediaQueryList | null = null;

	private colors: BreathingSphereColors | null = null;

	/**
	 * Invalidates cached theme colors after an appearance change.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAppearanceChange = (): void => {
		this.colors = null;
		this.requestUpdate();
	};

	/**
	 * Redraws the sphere after the operating-system color scheme changes.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleColorSchemeChange = (): void => {
		this.handleAppearanceChange();
	};

	/**
	 * Connects theme and size observers after the first render is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	override connectedCallback(): void {
		this.colors = null;
		super.connectedCallback();
		void this.updateComplete.then( () => {
			if ( ! this.isConnected ) {
				return;
			}

			this.connectObservers();
			this.draw();
		} );
	}

	/**
	 * Releases every observer owned by the component.
	 * @since 0.1.0 Initial implementation.
	 */
	override disconnectedCallback(): void {
		this.appearanceObserver?.disconnect();
		this.resizeObserver?.disconnect();
		this.colorSchemeQuery?.removeEventListener( 'change', this.handleColorSchemeChange );
		this.appearanceObserver = null;
		this.resizeObserver = null;
		this.colorSchemeQuery = null;
		super.disconnectedCallback();
	}

	/**
	 * Redraws when presentation inputs change.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override updated(): void {
		if ( ! this.isConnected ) {
			return;
		}

		this.draw();
	}

	/**
	 * Renders the decorative Canvas owned by the sphere.
	 * @return Breathing Sphere template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		return html`<canvas aria-hidden="true"></canvas><span class="color-probe" aria-hidden="true"></span>`;
	}

	/**
	 * Observes root appearance settings, system theme, and component size.
	 * @since 0.1.0 Initial implementation.
	 */
	private connectObservers(): void {
		if ( this.appearanceObserver !== null ) {
			return;
		}

		this.appearanceObserver = new MutationObserver( this.handleAppearanceChange );
		this.appearanceObserver.observe( document.documentElement, {
			attributeFilter: [ 'data-tocus-palette', 'data-tocus-theme' ],
			attributes: true,
		} );

		this.resizeObserver = new ResizeObserver( () => {
			this.draw();
		} );
		this.resizeObserver.observe( this.canvasElement );

		this.colorSchemeQuery = window.matchMedia( '(prefers-color-scheme: dark)' );
		this.colorSchemeQuery.addEventListener( 'change', this.handleColorSchemeChange );
	}

	/**
	 * Synchronizes backing pixels and draws the complete sphere frame.
	 * @since 0.1.0 Initial implementation.
	 */
	private draw(): void {
		resizeBreathingSphereCanvas( this.canvasElement );
		this.colors ??= readBreathingSphereColors( this.colorProbe );
		renderBreathingSphereFrame( {
			breathProgress: this.breathProgress,
			canvas: this.canvasElement,
			colors: this.colors,
			still: this.still,
		} );
	}
}

declare global {
	/**
	 * Maps the Breathing Sphere tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-breathing-sphere': ComponentBreathingSphere;
	}
}
