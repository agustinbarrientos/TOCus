import { z } from 'zod';
import { ProtectionDecisionSchema } from './protection-decision';
import { ProtectionFactSchema } from './protection-fact';
import { ProtectionStateSchema } from './protection-state';

/**
 * Validates the complete output of one protection-state transition.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionTransitionResultSchema = z.object( {
	state: ProtectionStateSchema,
	decisions: z.array( ProtectionDecisionSchema ),
	facts: z.array( ProtectionFactSchema ),
} ).strict();

/**
 * Complete output of one protection-state transition.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionTransitionResult = z.infer<typeof ProtectionTransitionResultSchema>;
