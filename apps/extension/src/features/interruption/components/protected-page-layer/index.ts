import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type PropertyValues,
	type TemplateResult,
} from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import '../screen';
import { type ComponentInterruptionScreen } from '../screen';
import {
	type InterruptionScreenCopy,
} from '../screen/types';
import styles from './web-component-style.scss?inline';
import {
	ProtectedPageLayerDismissedEventName,
	type ProtectedPageLayerCopy,
} from './types';

/**
 * Finds the deepest focused HTML element reachable through open shadow roots.
 * @return Deepest focused element, or null when the document has no restorable HTML focus owner.
 * @since 0.1.0 Initial implementation.
 */
function getDeepestActiveElement(): HTMLElement | null {
	let activeElement = document.activeElement;

	while ( activeElement instanceof HTMLElement ) {
		const nestedActiveElement = activeElement.shadowRoot?.activeElement;

		if ( ! ( nestedActiveElement instanceof HTMLElement ) ) {
			return activeElement;
		}

		activeElement = nestedActiveElement;
	}

	return null;
}

/**
 * Renders one quiet allowance warning and a native modal interruption over a live protected document.
 * @element tocus-f-protected-page-layer
 * @attr warning-remaining-seconds - Final allowance seconds remaining, or no warning when omitted.
 * @attr interruption-layer-presented - Whether the modal interruption is currently shown.
 * Emits the bubbling `tocus-protected-page-layer-dismissed` event after native layer dismissal.
 * @summary Isolated protected-page warning and interruption presentation.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-protected-page-layer' )
export class ComponentProtectedPageLayer extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		mode: 'closed',
	};

	/**
	 * Whether the on-demand entrypoint requires this owned host to repair unexpected removal.
	 * @since 0.1.0 Initial implementation.
	 */
	connectionGuardEnabled = false;

	/**
	 * Whole allowance seconds displayed by the quiet warning, or null while hidden.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'warning-remaining-seconds', type: Number } )
	accessor warningRemainingSeconds: number | null = null;

	/**
	 * Whether the modal interruption layer must cover the live document.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'interruption-layer-presented', reflect: true, type: Boolean } )
	accessor interruptionLayerPresented = false;

	/**
	 * Complete localized protected-page presentation messages.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<ProtectedPageLayerCopy>;

	/**
	 * Complete localized messages forwarded to the interruption screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor interruptionCopy!: Readonly<InterruptionScreenCopy>;

	@query( 'dialog' )
	private accessor dialogElement!: HTMLDialogElement | null;

	@query( 'tocus-f-interruption-screen' )
	private accessor interruptionScreen!: ComponentInterruptionScreen | null;

	private previouslyFocusedElement: HTMLElement | null = null;

	/**
	 * Restores the owned host after an unexpected removal from a still-live document.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly restoreConnection = (): void => {
		if ( this.connectionGuardEnabled && ! this.isConnected && document.documentElement.isConnected ) {
			document.documentElement.append( this );
		}
	};

	/**
	 * Prevents the native Escape action from bypassing an active interruption.
	 * @param event - Native dialog cancellation request.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleDialogCancel = ( event: Event ): void => {
		event.preventDefault();
	};

	/**
	 * Repairs an unexpected native closure and freezes local progress during the gap.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleDialogClose = (): void => {
		if ( ! this.interruptionLayerPresented || this.interruptionScreen === null ) {
			return;
		}

		this.interruptionScreen.progressing = false;
		this.presentDialog();
	};

	/**
	 * Freezes local progress as soon as the protected page detaches its presentation host.
	 * @since 0.1.0 Initial implementation.
	 */
	override disconnectedCallback(): void {
		if ( this.interruptionLayerPresented && this.interruptionScreen !== null ) {
			this.interruptionScreen.progressing = false;
			if ( this.dialogElement !== null && this.dialogElement.open ) {
				this.dialogElement.close();
			}
		}

		super.disconnectedCallback();
		queueMicrotask( this.restoreConnection );
	}

	/**
	 * Repairs native top-layer presentation after the owned host reconnects.
	 * @since 0.1.0 Initial implementation.
	 */
	override connectedCallback(): void {
		super.connectedCallback();
		if ( this.interruptionLayerPresented ) {
			void this.updateComplete.then( () => {
				this.presentDialog();
			} );
		}
	}

	/**
	 * Returns the interruption screen controlled by the protected-page runtime.
	 * @return Rendered interruption screen.
	 * @throws {Error} When localized presentation has not rendered the screen yet.
	 * @since 0.1.0 Initial implementation.
	 */
	getInterruptionScreen(): ComponentInterruptionScreen {
		const interruptionScreen = this.interruptionScreen;

		if ( interruptionScreen === null ) {
			throw new Error( 'The protected-page interruption screen is not rendered.' );
		}

		return interruptionScreen;
	}

	/**
	 * Reports whether the requested interruption currently occupies the native top layer.
	 * @return Whether the host is connected and its modal is open.
	 * @since 0.1.0 Initial implementation.
	 */
	isInterruptionPresentationVisible(): boolean {
		return this.isConnected && this.interruptionLayerPresented && ( this.dialogElement?.open ?? false );
	}

	/**
	 * Waits until a requested interruption is visibly mounted in the native top layer.
	 * @return Promise resolved after the modal becomes visible.
	 * @throws {Error} When the requested presentation could not become visible.
	 * @since 0.1.0 Initial implementation.
	 */
	async waitForInterruptionPresentation(): Promise<void> {
		await this.updateComplete;

		if ( ! this.isInterruptionPresentationVisible() ) {
			throw new Error( 'The protected-page interruption could not be presented.' );
		}
	}

	/**
	 * Synchronizes the native top-layer dialog after a presentation-state change.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override updated( changedProperties: PropertyValues<this> ): void {
		if ( ! isLocalizationReady( this.copy, this.interruptionCopy ) ) {
			return;
		}

		if ( ! changedProperties.has( 'interruptionLayerPresented' ) ) {
			return;
		}

		if ( this.interruptionLayerPresented ) {
			this.presentDialog();
			return;
		}

		this.dismissDialog();
	}

	/**
	 * Renders the isolated warning and native modal container.
	 * @return Protected-page presentation template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy, this.interruptionCopy ) ) {
			return html``;
		}
		return html`
			${ this.warningRemainingSeconds === null
				? null
				: html`
					<p class="warning">
						<span class="visually-hidden" role="status">
							${ this.copy.allowanceWarningAnnouncement }
						</span>
						<span aria-hidden="true">
							${ this.copy.formatAllowanceWarning( this.warningRemainingSeconds ) }
						</span>
					</p>
				` }
			<dialog
				aria-label=${ this.copy.dialogLabel }
				aria-modal="true"
				@cancel=${ this.handleDialogCancel }
				@close=${ this.handleDialogClose }
			>
				<tocus-f-interruption-screen
					.copy=${ this.interruptionCopy }
					.continueShortcutEnabled=${ this.interruptionLayerPresented }
				></tocus-f-interruption-screen>
			</dialog>
		`;
	}

	/**
	 * Opens the semantic modal without modifying the underlying document state.
	 * @since 0.1.0 Initial implementation.
	 */
	private presentDialog(): void {
		if ( this.dialogElement === null || this.dialogElement.open || ! this.isConnected ) {
			return;
		}

		this.previouslyFocusedElement = getDeepestActiveElement();
		this.dialogElement.showModal();
	}

	/**
	 * Closes the semantic modal and restores the previously focused live-page element when possible.
	 * @since 0.1.0 Initial implementation.
	 */
	private dismissDialog(): void {
		if ( this.dialogElement === null || ! this.dialogElement.open ) {
			return;
		}

		this.dialogElement.close();
		if ( this.previouslyFocusedElement?.isConnected ) {
			this.previouslyFocusedElement.focus( { preventScroll: true } );
		} else {
			this.focusDocumentFallback();
		}
		this.previouslyFocusedElement = null;
		this.dispatchEvent( new Event( ProtectedPageLayerDismissedEventName, {
			bubbles: true,
			composed: true,
		} ) );
	}

	/**
	 * Moves focus to the document body when the previous focus owner no longer exists.
	 * @since 0.1.0 Initial implementation.
	 */
	private focusDocumentFallback(): void {
		const body = document.body;
		const previousTabIndex = body.getAttribute( 'tabindex' );

		body.setAttribute( 'tabindex', '-1' );
		body.focus( { preventScroll: true } );
		if ( previousTabIndex === null ) {
			body.removeAttribute( 'tabindex' );
		} else {
			body.setAttribute( 'tabindex', previousTabIndex );
		}
	}
}

declare global {
	/**
	 * Maps the protected-page layer tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-protected-page-layer': ComponentProtectedPageLayer;
	}
}

export * from './types';
