import {
	formatDurationUnit,
	formatMessage,
	formatMinuteDuration,
	formatPluralMessage,
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
} from './formatters';
import {
	type LocalizationBundle,
	type LocalizationFormatters,
	type ProtectedPageLocalizationCatalog,
} from './types';

/**
 * Creates the interruption-screen copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed interruption-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createInterruptionCopy(
	catalog: ProtectedPageLocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'interruption' ] {
	const { remainingTime, ...messages } = catalog.interruption;

	/**
	 * Formats one visible remaining-time label.
	 * @param remainingSeconds - Nonnegative whole seconds remaining.
	 * @return Complete localized remaining-time label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemainingTime( remainingSeconds: number ): string {
		return formatPluralMessage( remainingSeconds, remainingTime, formatters );
	}

	return Object.freeze( {
		...messages,
		formatRemainingTime,
	} ) satisfies LocalizationBundle[ 'interruption' ];
}

/**
 * Creates the protected-page layer copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed protected-page layer copy.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedPageLayerCopy(
	catalog: ProtectedPageLocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'protectedPageLayer' ] {
	const { allowanceWarning, ...messages } = catalog.protectedPageLayer;

	/**
	 * Formats one final allowance warning.
	 * @param remainingSeconds - Whole allowance seconds remaining.
	 * @return Complete localized warning sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAllowanceWarning( remainingSeconds: number ): string {
		return formatPluralMessage( remainingSeconds, allowanceWarning, formatters );
	}

	return Object.freeze( {
		...messages,
		formatAllowanceWarning,
	} ) satisfies LocalizationBundle[ 'protectedPageLayer' ];
}

/**
 * Creates the interruption-footer copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed wellbeing-summary copy.
 * @since 0.1.0 Initial implementation.
 */
export function createWellbeingCopy(
	catalog: ProtectedPageLocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'wellbeing' ] {
	/**
	 * Formats one nonzero all-time duration.
	 * @param milliseconds - Positive duration in milliseconds.
	 * @return Localized natural duration.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatDuration( milliseconds: number ): string {
		const totalSeconds = Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_SECOND ) );

		if ( totalSeconds < 60 ) {
			return formatDurationUnit( totalSeconds, catalog.units.second, formatters );
		}

		return formatMinuteDuration(
			Math.max( 1, Math.round( milliseconds / MILLISECONDS_PER_MINUTE ) ),
			catalog.units,
			formatters,
		);
	}

	/**
	 * Composes one complete wellbeing sentence from available values.
	 * @param values - Available formatted all-time values.
	 * @return Complete localized wellbeing sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatSummary( values: Parameters<LocalizationBundle[ 'wellbeing' ][ 'formatSummary' ]>[ 0 ] ): string {
		if ( values.estimatedReclaimedTime === null && values.focusedPauseTime === null ) {
			return catalog.wellbeing.neutral;
		}

		if ( values.estimatedReclaimedTime === null ) {
			return formatMessage( catalog.wellbeing.focusedOnly, {
				focusedPauseTime: String( values.focusedPauseTime ),
			} );
		}

		if ( values.focusedPauseTime === null ) {
			return formatMessage( catalog.wellbeing.estimatedOnly, {
				estimatedReclaimedTime: values.estimatedReclaimedTime,
			} );
		}

		return formatMessage( catalog.wellbeing.both, {
			estimatedReclaimedTime: values.estimatedReclaimedTime,
			focusedPauseTime: values.focusedPauseTime,
		} );
	}

	return Object.freeze( {
		neutral: catalog.wellbeing.neutral,
		formatDuration,
		formatSummary,
	} ) satisfies LocalizationBundle[ 'wellbeing' ];
}
