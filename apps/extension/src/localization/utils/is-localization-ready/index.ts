/**
 * Reports whether every localized value required by one presentation is available.
 * @param values - Localized copy values required for a complete render.
 * @return Whether none of the required values are missing.
 * @since 0.1.0 Initial implementation.
 */
export function isLocalizationReady( ...values: ReadonlyArray<unknown> ): boolean {
	return values.every( ( value ) => value !== undefined && value !== null );
}
