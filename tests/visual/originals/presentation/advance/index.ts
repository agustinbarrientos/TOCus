import { act } from 'react';
import type { OriginalAdvanceBoundary } from './types';

/**
 * Settles a real native Continue event before the original fixture's first paint.
 * @remarks Awaiting the exact service promises includes the production controller's async continuations without guessed microtask counts or direct state mutation.
 * @param action - Mounted production Continue button.
 * @param boundary - Promises returned by the fixture's real persistence and readiness adapters.
 * @param language - Whether this step also requires language readiness.
 * @return Completion of React's public act scope and its queued effects.
 * @since 0.1.0
 */
export async function advanceOriginalOnboarding(
	action: HTMLButtonElement, boundary: OriginalAdvanceBoundary, language: boolean,
): Promise<void> {
	const previousEnvironment = window.IS_REACT_ACT_ENVIRONMENT;
	const previousSave = boundary.saved;
	window.IS_REACT_ACT_ENVIRONMENT = true;
	try {
		await act( async () => {
			action.click();
			if ( ! boundary.saved || boundary.saved === previousSave ) {
				throw new Error( 'Original navigation must invoke the real preference persistence boundary.' );
			}
			await boundary.saved;
			if ( language ) {
				if ( ! boundary.language ) {
					throw new Error( 'Original language navigation must invoke its readiness boundary.' );
				}
				await boundary.language;
			}
		} );
	} finally {
		window.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
	}
}
