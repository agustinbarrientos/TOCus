import type { ReactNode } from 'react';

/**
 * Semantic tones for transient action feedback.
 * @since 1.0.0
 */
export const SnackbarTone = { SUCCESS: 'success', INFO: 'info' } as const;

/**
 * Snackbar tone inferred from its runtime catalog.
 * @since 1.0.0
 */
export type SnackbarTone = ( typeof SnackbarTone )[ keyof typeof SnackbarTone ];

/**
 * Plain localized feedback displayed after a completed action.
 * @since 1.0.0
 */
export interface SnackbarOptions {
	message: string;
	tone?: SnackbarTone;
}

/**
 * Stable interface for replacing one provider's current feedback.
 * @since 1.0.0
 */
export interface SnackbarApi {
	/**
	 * Displays the latest message and discards obsolete feedback.
	 * @param options - Localized message and optional semantic tone.
	 */
	show: ( options: SnackbarOptions ) => void;
}

/**
 * Localized notification boundary nested inside the owning TocusProvider.
 * @since 1.0.0
 */
export interface SnackbarProviderProps {
	children: ReactNode;
	closeLabel: string;
}
