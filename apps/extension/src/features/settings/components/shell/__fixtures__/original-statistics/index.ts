/**
 * Replays the archived pending-reset gestures before the first pending Statistics paint.
 * @remarks The original browser-side fixture clicked both production buttons between component updates; Node-side keyboard commands introduce additional painted intermediate states.
 * @param root - Owned fixture mount observed before production rendering begins.
 * @param original - Immutable original screenshot filename.
 * @since 0.1.0
 */
export function stageOriginalStatisticsReset( root: HTMLElement, original: string ): void {
	if ( ! original.startsWith( 'statistics-settings-screen-resetting-' ) ) {
		return;
	}
	let requested = false;
	const observer = new MutationObserver( () => {
		const request = root.querySelector( '.settings-statistics-data > button' );
		if ( ! requested && request instanceof HTMLButtonElement ) {
			requested = true;
			request.click();
			return;
		}
		const confirm = root.querySelector( '.settings-statistics-data .settings-inline-confirmation button:last-child' );
		if ( requested && confirm instanceof HTMLButtonElement && ! confirm.disabled ) {
			observer.disconnect();
			confirm.click();
		}
	} );
	observer.observe( root, { childList: true, subtree: true, attributes: true } );
}
