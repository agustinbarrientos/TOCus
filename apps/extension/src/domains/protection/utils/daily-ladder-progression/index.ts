import { DailyLadderSchema, type DailyLadder } from '../../types/daily-ladder';
import { LocalDateSchema, type LocalDate } from '../../types/protection-value';

/**
 * Synchronizes a validated ladder with a validated greatest-observed local date.
 * @param ladder - Validated daily ladder.
 * @param observedLocalDate - Validated observed local date.
 * @return A copied ladder that resets only for a later local date.
 * @since 0.1.0 Initial implementation.
 */
function synchronizeValidatedDailyLadder( ladder: DailyLadder, observedLocalDate: LocalDate ): DailyLadder {
	if ( observedLocalDate > ladder.greatestObservedLocalDate ) {
		return {
			completedWaits: 0,
			greatestObservedLocalDate: observedLocalDate,
		};
	}

	return { ...ladder };
}

/**
 * Synchronizes a daily ladder with an observed local calendar date.
 * @param ladder - Unknown daily ladder input.
 * @param observedLocalDate - Unknown observed local-date input.
 * @return A synchronized daily ladder.
 * @throws {import('zod').ZodError} When either input does not match its public contract.
 * @since 0.1.0 Initial implementation.
 */
export function synchronizeDailyLadder( ladder: unknown, observedLocalDate: unknown ): DailyLadder {
	const parsedLadder = DailyLadderSchema.parse( ladder );
	const parsedObservedLocalDate = LocalDateSchema.parse( observedLocalDate );

	return DailyLadderSchema.parse( synchronizeValidatedDailyLadder( parsedLadder, parsedObservedLocalDate ) );
}

/**
 * Advances a daily ladder for one completed wait.
 * @param ladder - Unknown daily ladder input.
 * @param completionLocalDate - Unknown completion local-date input.
 * @return A daily ladder with the accepted completion recorded.
 * @throws {import('zod').ZodError} When either input does not match its public contract.
 * @since 0.1.0 Initial implementation.
 */
export function advanceDailyLadder( ladder: unknown, completionLocalDate: unknown ): DailyLadder {
	const parsedLadder = DailyLadderSchema.parse( ladder );
	const parsedCompletionLocalDate = LocalDateSchema.parse( completionLocalDate );
	const synchronizedLadder = synchronizeValidatedDailyLadder( parsedLadder, parsedCompletionLocalDate );

	return DailyLadderSchema.parse( {
		...synchronizedLadder,
		completedWaits: synchronizedLadder.completedWaits === Number.MAX_SAFE_INTEGER
			? Number.MAX_SAFE_INTEGER
			: synchronizedLadder.completedWaits + 1,
	} );
}
