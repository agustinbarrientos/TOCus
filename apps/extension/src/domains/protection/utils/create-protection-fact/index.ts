import { FactIdSchema, type FactId } from '../../types/protection-value';
import {
	AllowanceGrantedFactInputSchema,
	AllowanceGrantedFactSchema,
	CompletedWaitFactInputSchema,
	CompletedWaitFactSchema,
	PauseTimeFactInputSchema,
	PauseTimeFactSchema,
	ProtectionFactType,
	ReconsideredVisitFactInputSchema,
	ReconsideredVisitFactSchema,
	type AllowanceGrantedFact,
	type CompletedWaitFact,
	type PauseTimeFact,
	type ProtectionFactType as ProtectionFactTypeValue,
	type ReconsideredVisitFact,
} from '../../types/protection-fact';

/**
 * Encodes one fact-identity component without delimiter ambiguity.
 * @param value - Stable identifier or numeric checkpoint component.
 * @return A length-prefixed component.
 * @since 0.1.0 Initial implementation.
 */
function encodeFactComponent( value: string | number ): string {
	const serializedValue = String( value );

	return `${ String( serializedValue.length ) }-${ serializedValue }`;
}

/**
 * Creates a validated fact identifier from one kind and its stable identity components.
 * @param factType - Closed fact-kind prefix.
 * @param components - Stable identity components in kind-specific order.
 * @return A collision-safe fact identifier.
 * @since 0.1.0 Initial implementation.
 */
function createFactId(
	factType: ProtectionFactTypeValue,
	components: readonly ( string | number )[],
): FactId {
	return FactIdSchema.parse( [
		factType,
		...components.map( encodeFactComponent ),
	].join( '_' ) );
}

/**
 * Builds one validated pause-time fact with a deterministic identifier.
 * @param input - Unknown pause-time fact values.
 * @return A validated pause-time fact.
 * @throws {import('zod').ZodError} When the supplied values or generated fact violate the contract.
 * @since 0.1.0 Initial implementation.
 */
export function createPauseTimeFact( input: unknown ): PauseTimeFact {
	const parsedInput = PauseTimeFactInputSchema.parse( input );

	return PauseTimeFactSchema.parse( {
		type: ProtectionFactType.PAUSE_TIME,
		factId: createFactId( ProtectionFactType.PAUSE_TIME, [
			parsedInput.scopeId,
			parsedInput.waitId,
			parsedInput.ownerEpoch,
			parsedInput.checkpointHighWaterMilliseconds,
		] ),
		...parsedInput,
	} );
}

/**
 * Builds one validated reconsidered-visit fact with a deterministic identifier.
 * @param input - Unknown reconsidered-visit fact values.
 * @return A validated reconsidered-visit fact.
 * @throws {import('zod').ZodError} When the supplied values or generated fact violate the contract.
 * @since 0.1.0 Initial implementation.
 */
export function createReconsideredVisitFact( input: unknown ): ReconsideredVisitFact {
	const parsedInput = ReconsideredVisitFactInputSchema.parse( input );

	return ReconsideredVisitFactSchema.parse( {
		type: ProtectionFactType.RECONSIDERED_VISIT,
		factId: createFactId( ProtectionFactType.RECONSIDERED_VISIT, [
			parsedInput.scopeId,
			parsedInput.waitId,
			parsedInput.participantId,
		] ),
		...parsedInput,
	} );
}

/**
 * Builds one validated completed-wait fact with a deterministic identifier.
 * @param input - Unknown completed-wait fact values.
 * @return A validated completed-wait fact.
 * @throws {import('zod').ZodError} When the supplied values or generated fact violate the contract.
 * @since 0.1.0 Initial implementation.
 */
export function createCompletedWaitFact( input: unknown ): CompletedWaitFact {
	const parsedInput = CompletedWaitFactInputSchema.parse( input );

	return CompletedWaitFactSchema.parse( {
		type: ProtectionFactType.COMPLETED_WAIT,
		factId: createFactId( ProtectionFactType.COMPLETED_WAIT, [
			parsedInput.scopeId,
			parsedInput.waitId,
		] ),
		...parsedInput,
	} );
}

/**
 * Builds one validated allowance-granted fact with a deterministic identifier.
 * @param input - Unknown allowance-granted fact values.
 * @return A validated allowance-granted fact.
 * @throws {import('zod').ZodError} When the supplied values or generated fact violate the contract.
 * @since 0.1.0 Initial implementation.
 */
export function createAllowanceGrantedFact( input: unknown ): AllowanceGrantedFact {
	const parsedInput = AllowanceGrantedFactInputSchema.parse( input );

	return AllowanceGrantedFactSchema.parse( {
		type: ProtectionFactType.ALLOWANCE_GRANTED,
		factId: createFactId( ProtectionFactType.ALLOWANCE_GRANTED, [
			parsedInput.scopeId,
			parsedInput.allowanceId,
		] ),
		...parsedInput,
	} );
}
