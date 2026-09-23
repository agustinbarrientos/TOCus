import { useCallback, useEffect, useRef, useState } from 'react';
import type { DraftGuard } from '../../utils/draft-controller/types';
import { DraftSaveResult } from '../../utils/draft-controller/types';
import {
	SettingsDestination,
	SettingsHistoryPositionKey,
	 SettingsHistoryTransition,
	type PendingSettingsNavigation,
	type SettingsNavigationState,
} from './types';

/**
 * Resolves a browser fragment to a supported destination with the default Sites fallback.
 * @param hash - Current or requested browser URL fragment.
 * @return Canonical Settings destination.
 * @since 1.0.0
 */
function resolveDestination( hash: string ): SettingsDestination {
	return Object.values( SettingsDestination ).find( ( value ) => `#${ value }` === hash )
		?? SettingsDestination.PROTECTED_SITES;
}

/**
 * Reads only the owned numeric history marker from otherwise untrusted browser state.
 * @param state - Browser-provided history entry state.
 * @return Known relative position, or null for an entry that was not previously marked.
 * @since 1.0.0
 */
function readHistoryPosition( state: unknown ): number | null {
	if ( typeof state !== 'object' || state === null || ! ( SettingsHistoryPositionKey in state ) ) {
		return null;
	}
	return typeof state[ SettingsHistoryPositionKey ] === 'number' ? state[ SettingsHistoryPositionKey ] : null;
}

/**
 * Marks the current history entry without discarding unrelated browser state.
 * @param position - Relative position assigned by the Settings navigation guard.
 * @since 1.0.0
 */
function markHistoryPosition( position: number ): void {
	const state: unknown = window.history.state;
	const previous = typeof state === 'object' && state !== null ? state : {};
	window.history.replaceState( { ...previous, [ SettingsHistoryPositionKey ]: position }, '' );
}

/**
 * Protects drafts across navigation links, browser Back/Forward, and page unload.
 * @return Active destination, pending confirmation, and controller-safe navigation actions.
 * @since 1.0.0
 */
export function useSettingsNavigation(): SettingsNavigationState {
	const [ destination, setDestination ] = useState( () => resolveDestination( window.location.hash ) );
	const [ pending, setPending ] = useState<PendingSettingsNavigation | null>( null );
	const [ saving, setSaving ] = useState( false );
	const [ saveFailed, setSaveFailed ] = useState( false );
	const deciding = useRef( false );
	const activeDestination = useRef( destination );
	const guard = useRef<DraftGuard | null>( null );
	const pendingRef = useRef<PendingSettingsNavigation | null>( null );
	const position = useRef( 0 );
	const transition = useRef<SettingsHistoryTransition>( null );
	const observedPosition = useRef<number | null>( null );
	const register = useCallback( ( next: DraftGuard | null ) => {
		guard.current = next;
	}, [] );

	/**
	 * Updates both the rendered destination and the live value read by browser event listeners.
	 * @param next - Destination accepted by the navigation guard.
	 * @since 1.0.0
	 */
	function chooseDestination( next: SettingsDestination ): void {
		activeDestination.current = next;
		setDestination( next );
	}

	/**
	 * Keeps confirmation rendering and the synchronous duplicate-request guard aligned.
	 * @param next - Pending navigation, or null after a decision.
	 * @since 1.0.0
	 */
	function setConfirmation( next: PendingSettingsNavigation | null ): void {
		pendingRef.current = next;
		setPending( next );
		setSaveFailed( false );
	}

	useEffect( () => {
		position.current = readHistoryPosition( window.history.state ) ?? 0;
		markHistoryPosition( position.current );

		/**
		 * Captures Back/Forward's target position before its corresponding hashchange arrives.
		 * @param event - Browser history transition carrying the destination entry's state.
		 * @since 1.0.0
		 */
		function handlePopState( event: PopStateEvent ): void {
			observedPosition.current = readHistoryPosition( event.state );
		}

		/**
		 * Reconciles hash navigation while restoring the previous history entry for guarded drafts.
		 * @since 1.0.0
		 */
		function handleHashChange(): void {
			const next = resolveDestination( window.location.hash );
			const targetPosition = observedPosition.current ?? position.current + 1;
			observedPosition.current = null;

			// Ignore the hashchange generated while restoring a rejected history movement.
			if ( transition.current === SettingsHistoryTransition.RESTORE ) {
				transition.current = null;
				return;
			}
			if ( transition.current === SettingsHistoryTransition.COMMIT ) {
				transition.current = null;
				chooseDestination( next );
				return;
			}
			if ( next === activeDestination.current ) {
				position.current = targetPosition;
				markHistoryPosition( targetPosition );
				return;
			}
			if ( guard.current?.dirty || guard.current?.saving || deciding.current || pendingRef.current !== null ) {
				const delta = targetPosition - position.current;
				markHistoryPosition( targetPosition );
				if ( guard.current?.dirty && ! guard.current.saving
					&& ! deciding.current && pendingRef.current === null ) {
					setConfirmation( {
						hash: window.location.hash,
						delta,
						focus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
					} );
				}
				transition.current = SettingsHistoryTransition.RESTORE;
				window.history.go( -delta );
				return;
			}
			position.current = targetPosition;
			markHistoryPosition( targetPosition );
			chooseDestination( next );
		}

		/**
		 * Requests the browser's native departure warning while edits or persistence remain active.
		 * @param event - Cancelable page departure event.
		 * @since 1.0.0
		 */
		function handleBeforeUnload( event: BeforeUnloadEvent ): void {
			if ( guard.current?.dirty || guard.current?.saving || deciding.current ) {
				event.preventDefault();
			}
		}

		window.addEventListener( 'popstate', handlePopState );
		window.addEventListener( 'hashchange', handleHashChange );
		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => {
			window.removeEventListener( 'popstate', handlePopState );
			window.removeEventListener( 'hashchange', handleHashChange );
			window.removeEventListener( 'beforeunload', handleBeforeUnload );
		};
	}, [] );

	/**
	 * Pushes a new destination only after a navigation link is accepted by the draft guard.
	 * @param hash - Requested destination fragment.
	 * @param focus - Trigger receiving focus if the user declines to discard edits.
	 * @since 1.0.0
	 */
	function navigate( hash: string, focus: HTMLElement ): void {
		if ( resolveDestination( hash ) === activeDestination.current || pendingRef.current !== null
			|| guard.current?.saving || deciding.current ) {
			return;
		}
		if ( guard.current?.dirty ) {
			setConfirmation( { hash, delta: null, focus } );
			return;
		}
		position.current += 1;
		window.history.pushState( { [ SettingsHistoryPositionKey ]: position.current }, '', hash );
		chooseDestination( resolveDestination( hash ) );
	}

	/**
	 * Commits the original link or history movement after a completed draft decision.
	 * @param accepted - Original requested movement, never a replacement history entry.
	 * @since 1.0.0
	 */
	function accept( accepted: PendingSettingsNavigation ): void {
		setConfirmation( null );
		if ( accepted.delta === null ) {
			position.current += 1;
			window.history.pushState( { [ SettingsHistoryPositionKey ]: position.current }, '', accepted.hash );
			chooseDestination( resolveDestination( accepted.hash ) );
		} else {
			position.current += accepted.delta;
			transition.current = SettingsHistoryTransition.COMMIT;
			window.history.go( accepted.delta );
		}
	}

	/**
	 * Discards the current draft while locking duplicate confirmation actions.
	 * @return Completion of the original requested navigation.
	 * @since 1.0.0
	 */
	async function discard(): Promise<void> {
		const accepted = pendingRef.current;
		if ( accepted === null || guard.current?.saving || deciding.current ) {
			return;
		}
		deciding.current = true;
		setSaving( true );
		try {
			await guard.current?.discard();
			accept( accepted );
		} finally {
			deciding.current = false;
			setSaving( false );
		}
	}

	/**
	 * Invokes page persistence within the original gesture and leaves only on clean success.
	 * @return Completion of persistence and any accepted navigation, retaining failures in place.
	 * @since 1.0.0
	 */
	async function save(): Promise<void> {
		const accepted = pendingRef.current;
		const current = guard.current;
		if ( accepted === null || current === null || current.saving || deciding.current ) {
			return;
		}
		deciding.current = true;
		setSaving( true );
		setSaveFailed( false );
		try {
			// The page must request optional browser permissions before this first await.
			const result = await current.save();
			const settled = guard.current;
			if ( result === DraftSaveResult.SAVED && settled !== null && ! settled.dirty && ! settled.saving ) {
				accept( accepted );
			} else {
				setSaveFailed( true );
			}
		} catch {
			setSaveFailed( true );
		} finally {
			deciding.current = false;
			setSaving( false );
		}
	}

	/**
	 * Keeps the draft and restores focus after closing its navigation confirmation.
	 * @since 1.0.0
	 */
	function stay(): void {
		if ( deciding.current || guard.current?.saving ) {
			return;
		}
		const focus = pendingRef.current?.focus;
		setConfirmation( null );
		requestAnimationFrame( () => focus?.focus() );
	}

	return { destination, pending, saving, saveFailed, register, navigate, discard, save, stay };
}
