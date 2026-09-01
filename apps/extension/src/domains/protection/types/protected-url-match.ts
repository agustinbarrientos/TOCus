import { z } from 'zod';
import { ProtectedSiteRuleSchema } from './protected-site-rule';
import { UrlParsingFailureReason } from './url-parsing-failure';

/**
 * Stable statuses returned while matching a navigation.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedUrlMatchStatus = {
	PROTECTED: 'protected',
	UNPROTECTED: 'unprotected',
	UNSUPPORTED: 'unsupported',
} as const;

/**
 * Validates a navigation match status.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedUrlMatchStatusSchema = z.enum( ProtectedUrlMatchStatus );

/**
 * Status returned while matching a navigation.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedUrlMatchStatus = z.infer<typeof ProtectedUrlMatchStatusSchema>;

/**
 * Stable reasons that a navigation cannot be matched.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedUrlUnsupportedReason = {
	BROWSER_CONTROLLED_SCHEME: UrlParsingFailureReason.BROWSER_CONTROLLED_SCHEME,
	INVALID_RULE_SET: 'invalid-rule-set',
	MALFORMED_INPUT: UrlParsingFailureReason.MALFORMED_INPUT,
	UNSUPPORTED_SCHEME: UrlParsingFailureReason.UNSUPPORTED_SCHEME,
} as const;

/**
 * Validates a stable unsupported-navigation reason.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedUrlUnsupportedReasonSchema = z.enum( ProtectedUrlUnsupportedReason );

/**
 * Stable reason that a navigation could not be matched.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedUrlUnsupportedReason = z.infer<typeof ProtectedUrlUnsupportedReasonSchema>;

/**
 * Validates a navigation result matched to a protected-site rule.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedUrlMatchedSchema = z.object( {
	status: z.enum( [ ProtectedUrlMatchStatus.PROTECTED ] ),
	rule: ProtectedSiteRuleSchema,
} ).strict();

/**
 * Validates a navigation result with no matching protected-site rule.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedUrlUnmatchedSchema = z.object( {
	status: z.enum( [ ProtectedUrlMatchStatus.UNPROTECTED ] ),
} ).strict();

/**
 * Validates a navigation result rejected as unsupported.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedUrlUnsupportedSchema = z.object( {
	status: z.enum( [ ProtectedUrlMatchStatus.UNSUPPORTED ] ),
	reason: ProtectedUrlUnsupportedReasonSchema,
} ).strict();

/**
 * Validates the complete result of matching a navigation.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedUrlMatchResultSchema = z.discriminatedUnion( 'status', [
	ProtectedUrlMatchedSchema,
	ProtectedUrlUnmatchedSchema,
	ProtectedUrlUnsupportedSchema,
] );

/**
 * Complete result of matching a navigation.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedUrlMatchResult = z.infer<typeof ProtectedUrlMatchResultSchema>;
