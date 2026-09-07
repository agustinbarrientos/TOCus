import { useRef, useState } from 'react';
import type { OnboardingPendingOperation } from '../../types/flow';

/**
 * Shares one synchronous mutation gate across the onboarding flow and site editor.
 * React state supplies rendering; the ref blocks a second action in the same event turn.
 * @since 0.1.0
 * @return Rendered pending state and immediate gate operations.
 */
export function usePendingOperation(): OnboardingPendingOperation {
	const [ pending, setPending ] = useState( false );
	const pendingRef = useRef( false );

	/**
	 * Reads the gate before React has committed a pending-state render.
	 * @return Whether an operation already owns the gate.
	 */
	function isPending(): boolean {
		return pendingRef.current;
	}

	/**
	 * Acquires the mutation gate synchronously.
	 * @return False if a previous operation has not settled.
	 */
	function begin(): boolean {
		if ( pendingRef.current ) {
			return false;
		}
		pendingRef.current = true;
		setPending( true );
		return true;
	}

	/** Releases both imperative and rendered pending state. */
	function end(): void {
		pendingRef.current = false;
		setPending( false );
	}

	return { pending, isPending, begin, end };
}
