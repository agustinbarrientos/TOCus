import {
	ProtectionTransitionResultSchema,
	type ProtectionTransitionResult,
} from '../../types/protection-transition-result';

/**
 * Validates and clones a complete transition result.
 * @param state - Next protection state.
 * @param decisions - Declarative effects for the coordinator.
 * @param facts - Metric-bearing accepted-transition facts.
 * @return A validated transition result.
 * @throws {import('zod').ZodError} When the state, decisions, or facts violate their contracts.
 * @since 0.1.0 Initial implementation.
 */
export function createTransitionResult(
	state: unknown,
	decisions: unknown = [],
	facts: unknown = [],
): ProtectionTransitionResult {
	return ProtectionTransitionResultSchema.parse( { state, decisions, facts } );
}
