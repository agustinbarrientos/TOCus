import { ScheduleMode } from '../../../../../domains/protection/types/protection-schedule';

/**
 * Replays the archived radio gesture before the newly mounted Schedule form's first paint.
 * The original browser-side fixture changed the ready form within its mounting turn;
 * waiting for a Node-side click paints the intermediate state and changes rounded-edge pixels.
 * This observer invokes the real input handler once and never changes production styles or state directly.
 * @param root - Original-only fixture container, observed before the production tree mounts.
 * @param original - Exact original scenario filename; unrelated fixtures remain untouched.
 * @since 0.1.0
 */
export function stageOriginalScheduleChange( root: HTMLElement, original: string ): void {
	if ( ! original.startsWith( 'settings-schedule-hover-blue-' ) ) {
		return;
	}
	const observer = new MutationObserver( () => {
		const input = root.querySelector( `input[name="schedule-mode"][value="${ ScheduleMode.ALWAYS }"]` );
		if ( ! ( input instanceof HTMLInputElement ) ) {
			return;
		}
		observer.disconnect();
		input.click();
	} );
	observer.observe( root, { childList: true, subtree: true } );
}
