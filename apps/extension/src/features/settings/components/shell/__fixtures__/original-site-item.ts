/**
 * Replays the archived editor gestures before its intermediate state reaches the first paint.
 * The old browser-side fixture clicked Manage and submitted immediately after each render promise;
 * separate Node-side gestures introduce a painted intermediate form and change Chromium's cached edges.
 * Only real DOM handlers run: the missing-editor error still comes from the production save boundary.
 * @param root - Original-only fixture mount, observed before its React tree is created.
 * @param original - Exact archived filename; unrelated standalone states are left untouched.
 * @since 0.1.0
 */
export function stageOriginalSiteItemError( root: HTMLElement, original: string ): void {
	if ( ! original.startsWith( 'protected-site-item-operation-error-' ) ) {
		return;
	}
	let opened = false;
	let submitted = false;
	const observer = new MutationObserver( () => {
		if ( ! opened ) {
			const action = root.querySelector( '.settings-site-row button' );
			if ( action instanceof HTMLButtonElement ) {
				opened = true;
				action.click();
			}
		}
		if ( opened && ! submitted ) {
			const form = root.querySelector( '.settings-site-editor' );
			if ( form instanceof HTMLFormElement ) {
				submitted = true;
				form.requestSubmit();
			}
		}
		if ( root.querySelector( '[role="alert"]' ) ) {
			observer.disconnect();
		}
	} );
	observer.observe( root, { childList: true, subtree: true } );
}
