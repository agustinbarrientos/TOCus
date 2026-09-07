/**
 * Detects a caret that needs hiding without invalidating unfocused controls.
 * Playwright otherwise writes inline caret styles to every field, which can
 * change Chromium's rounded-edge raster even when no caret is visible.
 * @return Whether the focused editable element can display a text caret.
 * @since 0.1.0
 */
export function hasFocusedTextCaret(): boolean {
	let focused = document.activeElement;
	while ( focused?.shadowRoot?.activeElement ) {
		focused = focused.shadowRoot.activeElement;
	}
	if ( ! ( focused instanceof HTMLElement ) ) {
		return false;
	}
	if ( focused.isContentEditable ) {
		return true;
	}
	if ( focused instanceof HTMLTextAreaElement ) {
		return ! focused.readOnly;
	}
	return focused instanceof HTMLInputElement && ! focused.readOnly
		&& [ 'text', 'search', 'email', 'url', 'tel', 'password', 'number' ].includes( focused.type );
}
