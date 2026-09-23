/**
 * Authoritative statistics state, including failed reset recovery.
 * @since 1.0.0
 */
export const StatisticsLoadState = {
	LOADING: 'loading',
	READY: 'ready',
	FAILED: 'failed',
	RESET_FAILED: 'reset-failed',
} as const;

/**
 * Current statistics presentation state.
 * @since 1.0.0
 */
export type StatisticsLoadState = typeof StatisticsLoadState[ keyof typeof StatisticsLoadState ];
