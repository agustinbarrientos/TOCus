import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createPresentationPort } from '../../../../shared/utils/presentation-port';
import type { PopupPageShell } from '../popup-page/types';
import type { PopupState } from '../../components/shell/types';
import { PopupView } from '../../components/shell';

/**
 * Mounts the popup presentation without changing background-owned enrollment or status coordination.
 * @param container - Popup-owned element receiving the React tree and focus-recovery queries.
 * @return Mutable shell contract consumed by the existing popup page controller.
 * @since 0.1.0
 */
export function mountPopup( container: HTMLElement ): PopupPageShell {
	const root = createRoot( container );
	let disposed = false;
	let currentState: Readonly<PopupState> | null = null;

	/**
	 * Commits the latest controller snapshot before focusing a recovery target.
	 * @param selector - Ordered selector list for the best currently available popup action.
	 * @return Promise resolved after focus is restored if the popup remains mounted.
	 * @since 0.1.0
	 */
	async function focusRenderedAction( selector: string ): Promise<void> {
		await Promise.resolve();
		const state = currentState;
		if ( disposed || state === null ) {
			return;
		}
		// A frame alone does not guarantee React has committed the replacement focus target.
		flushSync( () => {
			root.render( <PopupView state={ state } port={ port } /> );
		} );
		container.querySelector<HTMLElement>( selector )?.focus();
	}

	/**
	 * Moves focus to website management after successful enrollment replaces its trigger.
	 * @return Promise resolved when the rendered management action has been considered for focus.
	 * @since 0.1.0
	 */
	function focusManageAction(): Promise<void> {
		if ( port.settingsPageUrl === '' ) {
			return Promise.resolve();
		}
		return focusRenderedAction( '.manage-action' );
	}

	/**
	 * Restores focus to the first meaningful action or explanation after recovery.
	 * @return Promise resolved after the newly rendered recovery state receives focus.
	 * @since 0.1.0
	 */
	function focusAfterRetry(): Promise<void> {
		return focusRenderedAction( '.manage-action, .primary-action, .retry-action, .neutral-message' );
	}

	/**
	 * Renders each coherent controller snapshot while the popup document remains active.
	 * @param state - Immutable snapshot batched by the shared presentation port.
	 * @since 0.1.0
	 */
	function renderSnapshot( state: Readonly<PopupState> ): void {
		if ( ! disposed ) {
			currentState = state;
			root.render( <PopupView state={ state } port={ port } /> );
		}
	}

	/**
	 * Stops React rendering and appearance observers when the browser closes the popup.
	 * @since 0.1.0
	 */
	function disposePopup(): void {
		disposed = true;
		root.unmount();
	}

	const initial: PopupState = {
		adding: false,
		copy: null,
		faviconSource: null,
		nowEpochMilliseconds: 0,
		operationError: null,
		projection: null,
		retrying: false,
		settingsPageUrl: '',
		statisticsPageUrl: '',
		focusManageAction,
		focusAfterRetry,
	};
	const port = createPresentationPort( initial, renderSnapshot );
	window.addEventListener( 'pagehide', disposePopup, { once: true } );
	return port;
}
