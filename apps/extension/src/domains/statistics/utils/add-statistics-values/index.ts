/**
 * Adds two non-negative statistics values without leaving the safe integer range.
 * @param left - Existing aggregate value.
 * @param right - Accepted increment.
 * @return Safe aggregate sum.
 * @throws {RangeError} When the sum is not a non-negative safe integer.
 * @since 0.1.0 Initial implementation.
 */
export function addStatisticsValues( left: number, right: number ): number {
	const sum = left + right;

	if (
		! Number.isSafeInteger( left ) || left < 0 ||
		! Number.isSafeInteger( right ) || right < 0 ||
		! Number.isSafeInteger( sum ) || sum < 0
	) {
		throw new RangeError( 'Statistics arithmetic exceeded the safe integer range.' );
	}

	return sum;
}
