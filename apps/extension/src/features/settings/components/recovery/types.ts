


/**
 * Authoritative load state without fabricated data.
 * @since 0.1.0
 */
export const LoadState = {
	LOADING: 'loading',
	READY: 'ready',
	MALFORMED: 'malformed',
	FAILED: 'failed',
} as const;

/**
 * Current authoritative settings load state.
 * @since 0.1.0
 */
export type LoadState = typeof LoadState[ keyof typeof LoadState ];


/**
 * Localized loading and recovery messages shared by editable screens.
 * @since 0.1.0
 */
export interface RecoveryCopy {
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	restoreDefaults?: string;
}


/**
 * Explicit retry and optional malformed-preference recovery.
 * @since 0.1.0
 */
export interface RecoveryProps {
	status: LoadState;
	copy: RecoveryCopy;
	retry: () => void;
	restore?: () => void;
	disabled?: boolean;
}
