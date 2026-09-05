import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import styles from './web-component-style.scss?inline';
import { type PopupShellCopy } from './types';

/**
 * Displays TOCus product status and introductory guidance in the extension popup.
 * @element tocus-f-popup-shell
 * @summary Extension popup shell.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-popup-shell' )
export class ComponentPopupShell extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Complete localized popup messages.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy: Readonly<PopupShellCopy> | null = null;

	/**
	 * Renders the popup content and its accessible label relationships.
	 * @return The popup shell template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( this.copy === null ) {
			return html``;
		}

		return html`
			<main aria-labelledby="popup-title" aria-describedby="popup-summary foundation-note">
				<p class="status">${ this.copy.status }</p>
				<h1 id="popup-title">TOCus</h1>
				<p class="summary" id="popup-summary">${ this.copy.summary }</p>
				<p class="foundation-note" id="foundation-note">${ this.copy.foundationNote }</p>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the popup-shell tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-popup-shell': ComponentPopupShell;
	}
}
