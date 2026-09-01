import { z } from 'zod';

/**
 * Completion actions available after a wait ends.
 * @since 0.1.0 Initial implementation.
 */
export const CompletionAction = {
	SHOW_CONTINUE: 'show-continue',
	OPEN_AUTOMATICALLY: 'open-automatically',
} as const;

/**
 * Validates a completion action.
 * @since 0.1.0 Initial implementation.
 */
export const CompletionActionSchema = z.enum( CompletionAction );

/**
 * Action applied when a wait completes.
 * @since 0.1.0 Initial implementation.
 */
export type CompletionAction = z.infer<typeof CompletionActionSchema>;
