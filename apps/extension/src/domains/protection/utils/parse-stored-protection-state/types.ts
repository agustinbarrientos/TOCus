import { z } from 'zod';
import {
	StoredDurableProtectionStateSchema,
	StoredSessionProtectionStateSchema,
} from '../../types/stored-protection-state';

/**
 * Outcomes produced while parsing one stored protection-state value.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateParseStatus = {
	ABSENT: 'absent',
	CURRENT: 'current',
	FAILED: 'failed',
} as const;

/**
 * Validates an outcome produced while parsing stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateParseStatusSchema = z.enum( StoredProtectionStateParseStatus );

/**
 * Outcome produced while parsing stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionStateParseStatus = z.infer<typeof StoredProtectionStateParseStatusSchema>;

/**
 * Stable reasons that stored protection state cannot be parsed.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateFailureReason = {
	INVALID_STORED_STATE: 'invalid-stored-state',
	UNSUPPORTED_VERSION: 'unsupported-version',
} as const;

/**
 * Validates a stable reason that stored protection state cannot be parsed.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateFailureReasonSchema = z.enum( StoredProtectionStateFailureReason );

/**
 * Stable reason that stored protection state cannot be parsed.
 * @since 0.1.0 Initial implementation.
 */
export type StoredProtectionStateFailureReason = z.infer<typeof StoredProtectionStateFailureReasonSchema>;

/**
 * Validates optional unknown durable and session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const ParseStoredProtectionStateInputSchema = z.object( {
	durable: z.unknown().optional(),
	session: z.unknown().optional(),
} ).strict();

/**
 * Optional unknown durable and session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type ParseStoredProtectionStateInput = z.infer<typeof ParseStoredProtectionStateInputSchema>;

/**
 * Probes an unknown stored value for a schema version without accepting additional state.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateVersionProbeSchema = z.object( {
	schemaVersion: z.unknown(),
} ).loose();

/**
 * Validates a non-negative stored-state version.
 * @since 0.1.0 Initial implementation.
 */
export const StoredProtectionStateVersionSchema = z.number().int().nonnegative();

/**
 * Validates an absent stored protection-state value.
 * @since 0.1.0 Initial implementation.
 */
const AbsentStoredProtectionStateSchema = z.object( {
	status: z.enum( [ StoredProtectionStateParseStatus.ABSENT ] ),
} ).strict();

/**
 * Validates a failed stored protection-state parse result.
 * @since 0.1.0 Initial implementation.
 */
const FailedStoredProtectionStateSchema = z.object( {
	status: z.enum( [ StoredProtectionStateParseStatus.FAILED ] ),
	reason: StoredProtectionStateFailureReasonSchema,
} ).strict();

/**
 * Validates current durable stored protection state after parsing.
 * @since 0.1.0 Initial implementation.
 */
const CurrentDurableStoredProtectionStateSchema = z.object( {
	status: z.enum( [ StoredProtectionStateParseStatus.CURRENT ] ),
	state: StoredDurableProtectionStateSchema,
} ).strict();

/**
 * Validates the result of parsing durable stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const ParsedDurableStoredProtectionStateSchema = z.discriminatedUnion( 'status', [
	AbsentStoredProtectionStateSchema,
	FailedStoredProtectionStateSchema,
	CurrentDurableStoredProtectionStateSchema,
] );

/**
 * Result of parsing durable stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type ParsedDurableStoredProtectionState = z.infer<typeof ParsedDurableStoredProtectionStateSchema>;

/**
 * Validates current session stored protection state after parsing.
 * @since 0.1.0 Initial implementation.
 */
const CurrentSessionStoredProtectionStateSchema = z.object( {
	status: z.enum( [ StoredProtectionStateParseStatus.CURRENT ] ),
	state: StoredSessionProtectionStateSchema,
} ).strict();

/**
 * Validates the result of parsing session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const ParsedSessionStoredProtectionStateSchema = z.discriminatedUnion( 'status', [
	AbsentStoredProtectionStateSchema,
	FailedStoredProtectionStateSchema,
	CurrentSessionStoredProtectionStateSchema,
] );

/**
 * Result of parsing session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type ParsedSessionStoredProtectionState = z.infer<typeof ParsedSessionStoredProtectionStateSchema>;

/**
 * Validates independently parsed durable and session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export const ParsedStoredProtectionStateSchema = z.object( {
	durable: ParsedDurableStoredProtectionStateSchema,
	session: ParsedSessionStoredProtectionStateSchema,
} ).strict();

/**
 * Independently parsed durable and session stored protection state.
 * @since 0.1.0 Initial implementation.
 */
export type ParsedStoredProtectionState = z.infer<typeof ParsedStoredProtectionStateSchema>;
