import { DailyLadderSchema } from '../../types/daily-ladder';
import { TimingConfigurationSchema } from '../../types/timing-configuration';
import {
	WaitDurationMillisecondsSchema,
	type WaitDurationMilliseconds,
} from '../../types/wait-duration';

/**
 * Calculates the next wait duration from a timing configuration and daily ladder.
 * @param configuration - Unknown global timing configuration input.
 * @param ladder - Unknown daily ladder input.
 * @return The captured duration for the next wait.
 * @throws {import('zod').ZodError} When either input does not match its public contract.
 * @since 0.1.0 Initial implementation.
 */
export function getNextWaitDuration( configuration: unknown, ladder: unknown ): WaitDurationMilliseconds {
	const parsedConfiguration = TimingConfigurationSchema.parse( configuration );
	const parsedLadder = DailyLadderSchema.parse( ladder );
	const uncappedDuration =
		parsedConfiguration.initialWaitMilliseconds +
		parsedConfiguration.ladderIncreaseMilliseconds * parsedLadder.completedWaits;

	return WaitDurationMillisecondsSchema.parse(
		Math.min( uncappedDuration, parsedConfiguration.maximumWaitMilliseconds ),
	);
}
