import { createElement, type ReactNode } from 'react';
import { PresentationElement } from '../../utils/presentation-element';
import type { PresentationChanges } from '../../utils/presentation-element/types';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import '../screen';
import type { ComponentInterruptionScreen } from '../screen';
import type {
	InterruptionScreenCopy,
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
 * @cssprop {length} [--tocus-size-unit=16px] - Typography and geometry baseline independent of the protected document root.
 * Emits the bubbling `tocus-protected-page-layer-dismissed` event after native layer dismissal.
 * @summary Isolated protected-page warning and interruption presentation.
 * @since 0.1.0 Initial implementation.
 */
export class ComponentProtectedPageLayer extends PresentationElement {

	/** Repairs unexpected host removal only when the on-demand entrypoint owns it. */
	connectionGuardEnabled = false;

	/**
	 * Current warning remaining seconds input supplied by the presentation owner.
	 * @return Current warning remaining seconds input supplied by the presentation owner.
	 */
	get warningRemainingSeconds(): number | null {
		return this.warningRemainingSecondsInput;
	}

	/**
	 * Applies the next warning remaining seconds controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set warningRemainingSeconds( value: number | null ) {
		const previous = this.warningRemainingSecondsInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.warningRemainingSecondsInput = value;
		this.requestUpdate( 'warningRemainingSeconds', previous );
	}

	private warningRemainingSecondsInput: number | null = null;

	/**
	 * Current interruption layer presented input supplied by the presentation owner.
	 * @return Current interruption layer presented input supplied by the presentation owner.
	 */
	get interruptionLayerPresented(): boolean {
		return this.interruptionLayerPresentedInput;
	}

	/**
	 * Applies the next interruption layer presented controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set interruptionLayerPresented( value: boolean ) {
		const previous = this.interruptionLayerPresentedInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.interruptionLayerPresentedInput = value;
		this.toggleAttribute( 'interruption-layer-presented', value );
		this.requestUpdate( 'interruptionLayerPresented', previous );
	}

	private interruptionLayerPresentedInput: boolean = false;

	/**
	 * Current copy input supplied by the presentation owner.
	 * @return Current copy input supplied by the presentation owner.
	 */
	get copy(): Readonly<ProtectedPageLayerCopy> {
		return this.copyInput;
	}

	/**
	 * Applies the next copy controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set copy( value: Readonly<ProtectedPageLayerCopy> ) {
		const previous = this.copyInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.copyInput = value;
		this.requestUpdate( 'copy', previous );
	}

	private copyInput!: Readonly<ProtectedPageLayerCopy>;

	/**
	 * Current interruption copy input supplied by the presentation owner.
	 * @return Current interruption copy input supplied by the presentation owner.
	 */
	get interruptionCopy(): Readonly<InterruptionScreenCopy> {
		return this.interruptionCopyInput;
	}

	/**
	 * Applies the next interruption copy controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set interruptionCopy( value: Readonly<InterruptionScreenCopy> ) {
		const previous = this.interruptionCopyInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.interruptionCopyInput = value;
		this.requestUpdate( 'interruptionCopy', previous );
	}

	private interruptionCopyInput!: Readonly<InterruptionScreenCopy>;

	/** Creates the closed, native top-layer boundary retained by the content script. */
	constructor() {
		super( styles, 'closed' );
	}

	/**
	 * Public presentation attributes.
	 * @return Public presentation attributes.
	 */
	static get observedAttributes(): string[] {
		return [ 'warning-remaining-seconds', 'interruption-layer-presented' ];
	}

	/**
	 * Synchronizes native attributes with controller sInput.
	 * @param name - Changed attribute.
	 * @param previous - Previous attribute text.
	 * @param value - Current attribute text or null after removal.
	 */
	attributeChangedCallback( name: string, previous: string | null, value: string | null ): void {
		if ( previous === value ) {
			return;
		}
		if ( name === 'warning-remaining-seconds' ) {
			this.warningRemainingSeconds = value === null ? null : Number( value );
		}
		if ( name === 'interruption-layer-presented' ) {
			this.interruptionLayerPresented = value !== null;
		}
	}

	/**
	 * Native modal owned by this closed shadow tree.
	 * @return Native modal owned by this closed shadow tree.
	 */
	private get dialogElement(): HTMLDialogElement | null {
		return this.renderRoot.querySelector( 'dialog' );
	}

	/**
	 * Screen adapter owned by the native modal, absent until localized copy is available.
	 * @return Screen adapter owned by the native modal, absent until localized copy is available.
	 */
	private get interruptionScreen(): ComponentInterruptionScreen | null {
		return this.renderRoot.querySelector( 'tocus-f-interruption-screen' );
	}

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
	private readonly handleDialogCancel = ( event: React.SyntheticEvent<HTMLDialogElement> ): void => {
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
	protected override afterRender( changedProperties: PresentationChanges ): void {
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
	protected override renderPresentation(): ReactNode {
		if ( ! isLocalizationReady( this.copy, this.interruptionCopy ) ) {
			return null;
		}
		return <>
			{this.warningRemainingSeconds !== null && <p className="warning">
				<span className="visually-hidden" role="status">{this.copy.allowanceWarningAnnouncement}</span>
				<span aria-hidden="true">{this.copy.formatAllowanceWarning( this.warningRemainingSeconds )}</span>
			</p>}
			<dialog aria-label={this.copy.dialogLabel} aria-modal="true"
				onCancel={this.handleDialogCancel} onClose={this.handleDialogClose}>
				{createElement( 'tocus-f-interruption-screen', { copy: this.interruptionCopy,
					continueShortcutEnabled: this.interruptionLayerPresented } )}
			</dialog>
		</>;
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

customElements.define( 'tocus-f-protected-page-layer', ComponentProtectedPageLayer );

export * from './types';
