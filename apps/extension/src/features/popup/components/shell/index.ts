import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import styles from './web-component-style.scss?inline';

const POPUP_SUMMARY = 'A gentle pause before distracting websites, designed to help you return to your intentions.';
const FOUNDATION_NOTE =
	'This source build includes only the extension foundation. Protection and pause features are still being developed.';

/**
 * Displays TOCus product status and introductory guidance in the extension popup.
 * @element tocus-f-popup-shell
 * @summary Extension popup shell.
 * @since <version> Initial implementation.
 */
@customElement( 'tocus-f-popup-shell' )
export class ComponentPopupShell extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Renders the popup content and its accessible label relationships.
	 * @return The popup shell template.
	 * @since <version> Initial implementation.
	 */
	protected override render(): TemplateResult {
		return html`
			<main aria-labelledby="popup-title" aria-describedby="popup-summary foundation-note">
				<p class="status">Early development</p>
				<h1 id="popup-title">TOCus</h1>
				<p class="summary" id="popup-summary">${ POPUP_SUMMARY }</p>
				<p class="foundation-note" id="foundation-note">${ FOUNDATION_NOTE }</p>
			</main>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'tocus-f-popup-shell': ComponentPopupShell;
	}
}
