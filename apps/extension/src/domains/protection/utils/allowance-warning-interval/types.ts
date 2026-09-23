/**
 * Schedule-active portion of one allowance's final warning window.
 * @since 1.0.0 Initial implementation.
 */
export interface AllowanceWarningInterval {
	/** Exclusive warning end in epoch milliseconds. */
	endsAtEpochMilliseconds: number;
	/** Inclusive warning start in epoch milliseconds. */
	startsAtEpochMilliseconds: number;
}
