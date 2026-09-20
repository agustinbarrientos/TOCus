/**
 * Formats the sample's metrics in rounded hours and minutes.
 * @param milliseconds - Recorded or estimated duration.
 * @param languageTag - Active website locale.
 * @return Readable localized duration.
 * @since 0.1.0
 */
export function formatSampleDuration( milliseconds: number, languageTag: string ): string {
	const totalMinutes = Math.round( milliseconds / 60_000 );
	const minutes = new Intl.NumberFormat( languageTag, { style: 'unit', unit: 'minute', unitDisplay: 'long' } );
	if ( totalMinutes < 60 ) {
		return minutes.format( totalMinutes );
	}
	const hours = new Intl.NumberFormat( languageTag, { style: 'unit', unit: 'hour', unitDisplay: 'long' } );
	const hoursLabel = hours.format( Math.floor( totalMinutes / 60 ) );
	return totalMinutes % 60 === 0 ? hoursLabel : new Intl.ListFormat( languageTag, { type: 'unit', style: 'short' } )
		.format( [ hoursLabel, minutes.format( totalMinutes % 60 ) ] );
}

/**
 * Labels arbitrary chart ticks with localized duration units.
 * @param milliseconds - Numeric tick converted to milliseconds.
 * @param languageTag - Active website locale.
 * @return Compact duration with seconds, minutes, or hours.
 * @since 0.1.0
 */
export function formatSampleAxisDuration( milliseconds: number, languageTag: string ): string {
	const divisor = milliseconds < 60_000 ? 1_000 : milliseconds < 3_600_000 ? 60_000 : 3_600_000;
	const unit = milliseconds < 60_000 ? 'second' : milliseconds < 3_600_000 ? 'minute' : 'hour';
	return new Intl.NumberFormat( languageTag, {
		style: 'unit', unit, unitDisplay: 'narrow', maximumSignificantDigits: 3, notation: 'compact',
	} ).format( milliseconds / divisor );
}
