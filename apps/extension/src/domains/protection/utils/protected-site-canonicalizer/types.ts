import { z } from 'zod';
import { ProtectedSiteRuleSchema } from '../../types/protected-site-rule';
import { ProtectionScopeIdSchema } from '../../types/protection-value';
import { UrlParsingFailureReason } from '../../types/url-parsing-failure';

/**
 * Validates one unnormalized protected-site rule at a public boundary.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteRuleInputSchema = z.object( {
	host: z.string().min( 1 ),
	includeSubdomains: z.boolean(),
	scopeId: ProtectionScopeIdSchema,
} ).strict();

/**
 * Unnormalized protected-site rule received at a public boundary.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteRuleInput = z.infer<typeof ProtectedSiteRuleInputSchema>;

/**
 * Validates an unnormalized protected-site rule set at a public boundary.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteRuleInputSetSchema = z.array( ProtectedSiteRuleInputSchema );

/**
 * Unnormalized protected-site rule set received at a public boundary.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteRuleInputSet = z.infer<typeof ProtectedSiteRuleInputSetSchema>;

/**
 * Stable statuses returned by protected-site canonicalization.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteCanonicalizationStatus = {
	ACCEPTED: 'accepted',
	REJECTED: 'rejected',
} as const;

/**
 * Validates a protected-site canonicalization status.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteCanonicalizationStatusSchema = z.enum( ProtectedSiteCanonicalizationStatus );

/**
 * Status returned by protected-site canonicalization.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteCanonicalizationStatus = z.infer<typeof ProtectedSiteCanonicalizationStatusSchema>;

/**
 * Stable protected-site canonicalization rejection reasons.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteCanonicalizationRejectionReason = {
	BROWSER_CONTROLLED_SCHEME: UrlParsingFailureReason.BROWSER_CONTROLLED_SCHEME,
	INVALID_INPUT: 'invalid-input',
	INVALID_SCOPE_ID: 'invalid-scope-id',
	MALFORMED_INPUT: UrlParsingFailureReason.MALFORMED_INPUT,
	PUBLIC_SUFFIX: 'public-suffix',
	UNSUPPORTED_SCHEME: UrlParsingFailureReason.UNSUPPORTED_SCHEME,
} as const;

/**
 * Validates a stable protected-site canonicalization rejection reason.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteCanonicalizationRejectionReasonSchema = z.enum(
	ProtectedSiteCanonicalizationRejectionReason,
);

/**
 * Stable protected-site canonicalization rejection reason.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteCanonicalizationRejectionReason = z.infer<
	typeof ProtectedSiteCanonicalizationRejectionReasonSchema
>;

/**
 * Validates a successful protected-site canonicalization result.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedSiteCanonicalizationAcceptedSchema = z.object( {
	status: z.enum( [ ProtectedSiteCanonicalizationStatus.ACCEPTED ] ),
	rule: ProtectedSiteRuleSchema,
} ).strict();

/**
 * Validates a rejected protected-site canonicalization result.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedSiteCanonicalizationRejectedSchema = z.object( {
	status: z.enum( [ ProtectedSiteCanonicalizationStatus.REJECTED ] ),
	reason: ProtectedSiteCanonicalizationRejectionReasonSchema,
} ).strict();

/**
 * Validates the complete result of protected-site canonicalization.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteCanonicalizationResultSchema = z.discriminatedUnion( 'status', [
	ProtectedSiteCanonicalizationAcceptedSchema,
	ProtectedSiteCanonicalizationRejectedSchema,
] );

/**
 * Complete result of protected-site canonicalization.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteCanonicalizationResult = z.infer<typeof ProtectedSiteCanonicalizationResultSchema>;
