import type {
	ReactNode,
} from 'react';


/**
 * Focus-trapped confirmation with a safe first action.
 * @since 0.1.0
 */
export interface ConfirmationProps {
	opened: boolean;
	inline?: boolean;
	/** Presents a boxed site-removal question without a repeated heading. */
	minimal?: boolean;
	/** Restores the established first focused action for an existing confirmation flow. */
	focusConfirm?: boolean;
	title: string;
	description: string;
	cancel: string;
	confirm: string;
	pending?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	children?: ReactNode;
}
