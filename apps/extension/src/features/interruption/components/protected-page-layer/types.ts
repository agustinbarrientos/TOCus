/**
 * Name of the plain event emitted after the protected-page interruption layer closes.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedPageLayerDismissedEventName = 'tocus-protected-page-layer-dismissed';

/**
 * Complete localized messages consumed by the protected-page layer.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerCopy {
	/** Stable message announced once when the final allowance warning appears. */
	allowanceWarningAnnouncement: string;
	/** Accessible name for the semantic interruption dialog. */
	dialogLabel: string;
	/**
	 * Formats the complete final allowance warning.
	 * @param remainingSeconds - Whole allowance seconds remaining.
	 * @return Complete localized warning sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	formatAllowanceWarning( remainingSeconds: number ): string;
}
