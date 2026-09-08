import type { ReactNode } from 'react';
import { PresentationElement } from '../../utils/presentation-element';
import {
	readBreathingSphereColors,
	renderBreathingSphereFrame,
	resizeBreathingSphereCanvas,
} from '../../utils/breathing-sphere-renderer';
import type { BreathingSphereColors } from '../../utils/breathing-sphere-renderer/types';
import styles from './web-component-style.scss?inline';

/**
 * Renders the approved clay Breathing Sphere from deterministic presentation progress.
 * @element tocus-f-breathing-sphere
 * @attr breath-progress - Normalized Natural breathing progress.
 * @attr still - Whether the sphere remains still and dimensional.
 * @summary Responsive decorative Breathing Sphere Canvas.
 * @since 0.1.0 Initial implementation.
 */
export class ComponentBreathingSphere extends PresentationElement {
	/**
	 * Current breath progress input supplied by the presentation owner.
	 * @return Current breath progress input supplied by the presentation owner.
	 */
	get breathProgress(): number {
		return this.breathProgressInput;
	}

	/**
	 * Applies the next breath progress controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set breathProgress( value: number ) {
		const previous = this.breathProgressInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.breathProgressInput = value;
		this.requestUpdate( 'breathProgress', previous );
	}

	private breathProgressInput: number = 0;

	/**
	 * Current still input supplied by the presentation owner.
	 * @return Current still input supplied by the presentation owner.
	 */
	get still(): boolean {
		return this.stillInput;
	}

	/**
	 * Applies the next still controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set still( value: boolean ) {
		const previous = this.stillInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.stillInput = value;
		this.toggleAttribute( 'still', value );
		this.requestUpdate( 'still', previous );
	}

	private stillInput: boolean = false;

	/**
	 * Public attributes accepted by the controller-facing canvas adapter.
	 * @return Public attributes accepted by the controller-facing canvas adapter.
	 */
	static get observedAttributes(): string[] {
		return [ 'breath-progress', 'still' ];
	}

	/** Creates the decorative React canvas mount. */
	constructor() {
		super( styles );
	}

	/**
	 * Projects native attributes to typed presentation sInput.
	 * @param name - Changed public attribute.
	 * @param previous - Previous attribute text.
	 * @param value - New attribute text or null after removal.
	 */
	attributeChangedCallback( name: string, previous: string | null, value: string | null ): void {
		if ( previous === value ) {
			return;
		}
		if ( name === 'still' ) {
			this.still = value !== null;
		}
		if ( name === 'breath-progress' ) {
			this.breathProgress = Number( value );
		}
	}

	/**
	 * React-owned canvas, available after its first commit.
	 * @return React-owned canvas, available after its first commit.
	 */
	private get canvasElement(): HTMLCanvasElement | null {
		return this.renderRoot.querySelector( 'canvas' );
	}

	/**
	 * Inherited color probe, available after its first commit.
	 * @return Inherited color probe, available after its first commit.
	 */
	private get colorProbe(): HTMLSpanElement | null {
		return this.renderRoot.querySelector( '.color-probe' );
	}

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
	 * Redraws when presentation sInput change.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override afterRender(): void {
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
	protected override renderPresentation(): ReactNode {
		return <><canvas aria-hidden="true" /><span className="color-probe" aria-hidden="true" /></>;
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
		const observerOptions: MutationObserverInit = {
			attributeFilter: [ 'data-tocus-palette', 'data-tocus-theme' ],
			attributes: true,
		};

		this.appearanceObserver.observe( document.documentElement, observerOptions );
		let root = this.getRootNode();

		while ( root instanceof ShadowRoot ) {
			this.appearanceObserver.observe( root.host, observerOptions );
			root = root.host.getRootNode();
		}

		this.resizeObserver = new ResizeObserver( () => {
			this.draw();
		} );
		if ( this.canvasElement !== null ) {
			this.resizeObserver.observe( this.canvasElement );
		}

		this.colorSchemeQuery = window.matchMedia( '(prefers-color-scheme: dark)' );
		this.colorSchemeQuery.addEventListener( 'change', this.handleColorSchemeChange );
	}

	/**
	 * Synchronizes backing pixels and draws the complete sphere frame.
	 * @since 0.1.0 Initial implementation.
	 */
	private draw(): void {
		if ( this.canvasElement === null || this.colorProbe === null ) {
			return;
		}
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

customElements.define( 'tocus-f-breathing-sphere', ComponentBreathingSphere );
