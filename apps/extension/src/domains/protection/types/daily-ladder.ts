import { z } from 'zod';
import { LocalDateSchema } from './protection-value';

/**
 * Validates one scope's daily wait ladder.
 * @since 0.1.0 Initial implementation.
 */
export const DailyLadderSchema = z.object( {
	completedWaits: z.number().int().nonnegative(),
	greatestObservedLocalDate: LocalDateSchema,
} ).strict();

/**
 * Scope-specific daily completed-wait ladder.
 * @since 0.1.0 Initial implementation.
 */
export type DailyLadder = z.infer<typeof DailyLadderSchema>;
