/**
 * Formatted all-time values used to compose one wellbeing summary.
 * @since 0.1.0 Initial implementation.
 */
export interface WellbeingSummaryValues {
	estimatedReclaimedTime: string | null;
	focusedPauseTime: string | null;
}

/**
 * Localizable messages and grammar used by the interruption footer.
 * @since 0.1.0 Initial implementation.
 */
export interface WellbeingSummaryCopy {
	/** Complete fallback shown when no honest values are available. */
	neutral: string;

	/**
	 * Formats one nonzero all-time duration.
	 * @param milliseconds - Positive duration in milliseconds.
	 * @return Human-readable duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatDuration( milliseconds: number ): string;

	/**
	 * Formats one nonzero duration with localized compact units.
	 * @param milliseconds - Positive duration in milliseconds.
	 * @return Human-readable compact duration.
	 * @since 0.1.0 Initial implementation.
	 */
	formatShortDuration( milliseconds: number ): string;

	/**
	 * Composes the concise new-tab estimate.
	 * @param duration - Localized compact estimated duration.
	 * @return Complete concise estimate sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	formatShortSummary( duration: string ): string;

	/**
	 * Composes one complete summary from the available formatted values.
	 * @param values - Formatted all-time values.
	 * @return Complete human wellbeing sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	formatSummary( values: WellbeingSummaryValues ): string;
}
