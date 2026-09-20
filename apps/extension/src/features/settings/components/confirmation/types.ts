import type {
	ReactNode,
	RefObject,
} from 'react';

/**
 * Optional non-destructive persistence decision beside Stay and Discard.
 * @since 0.1.0
 */
export interface ConfirmationSaveAction {
	label: string;
	pendingLabel: string;
	onSave: () => void;
}


/**
 * Focus-trapped confirmation with a safe first action.
 * @since 0.1.0
 */
export interface ConfirmationProps {
	opened: boolean;
	inline?: boolean;
	/** Focus destination after closing a modal whose triggering action becomes unavailable. */
	returnFocusRef?: RefObject<HTMLButtonElement | null>;
	/** Restores the established first focused action for an existing confirmation flow. */
	focusConfirm?: boolean;
	title: string;
	description: string;
	cancel: string;
	confirm: string;
	pending?: boolean;
	save?: ConfirmationSaveAction;
	error?: string | null;
	onCancel: () => void;
	onConfirm: () => void;
	children?: ReactNode;
}
