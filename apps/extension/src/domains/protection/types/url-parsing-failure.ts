import { z } from 'zod';

/**
 * Stable failures produced while normalizing a navigation or protected-site URL.
 * @since 0.1.0 Initial implementation.
 */
export const UrlParsingFailureReason = {
	BROWSER_CONTROLLED_SCHEME: 'browser-controlled-scheme',
	MALFORMED_INPUT: 'malformed-input',
	UNSUPPORTED_SCHEME: 'unsupported-scheme',
} as const;

/**
 * Validates a failure produced while normalizing a navigation or protected-site URL.
 * @since 0.1.0 Initial implementation.
 */
export const UrlParsingFailureReasonSchema = z.enum( UrlParsingFailureReason );

/**
 * Failure produced while normalizing a navigation or protected-site URL.
 * @since 0.1.0 Initial implementation.
 */
export type UrlParsingFailureReason = z.infer<typeof UrlParsingFailureReasonSchema>;
