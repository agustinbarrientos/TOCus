import { z } from 'zod';
import { CanonicalHostSchema } from '../../types/protected-site-rule';
import { UrlParsingFailureReasonSchema } from '../../types/url-parsing-failure';

/**
 * HTTP protocols supported by protected-site rules.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectableProtocol = {
	HTTP: 'http:',
	HTTPS: 'https:',
} as const;

/**
 * Validates a protocol supported by protected-site rules.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectableProtocolSchema = z.enum( ProtectableProtocol );

/**
 * Protocol supported by protected-site rules.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectableProtocol = z.infer<typeof ProtectableProtocolSchema>;

/**
 * Browser-owned protocols that extensions cannot protect as ordinary pages.
 * @since 0.1.0 Initial implementation.
 */
export const BrowserControlledProtocol = {
	ABOUT: 'about:',
	CHROME: 'chrome:',
	CHROME_EXTENSION: 'chrome-extension:',
	CHROME_UNTRUSTED: 'chrome-untrusted:',
	DEVTOOLS: 'devtools:',
	EDGE: 'edge:',
	MOZ_EXTENSION: 'moz-extension:',
	RESOURCE: 'resource:',
	SAFARI_EXTENSION: 'safari-extension:',
	SAFARI_WEB_EXTENSION: 'safari-web-extension:',
	VIEW_SOURCE: 'view-source:',
} as const;

/**
 * Validates a browser-owned protocol.
 * @since 0.1.0 Initial implementation.
 */
export const BrowserControlledProtocolSchema = z.enum( BrowserControlledProtocol );

/**
 * Browser-owned protocol that cannot be protected as an ordinary page.
 * @since 0.1.0 Initial implementation.
 */
export type BrowserControlledProtocol = z.infer<typeof BrowserControlledProtocolSchema>;

/**
 * Validates a non-empty protected-site or navigation input string.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteInputSchema = z.string().trim().min( 1 );

/**
 * Non-empty protected-site or navigation input string.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteInput = z.infer<typeof ProtectedSiteInputSchema>;

/**
 * Stable statuses returned by protectable URL normalization.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectableUrlNormalizationStatus = {
	NORMALIZED: 'normalized',
	REJECTED: 'rejected',
} as const;

/**
 * Validates a protectable URL normalization status.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectableUrlNormalizationStatusSchema = z.enum( ProtectableUrlNormalizationStatus );

/**
 * Protectable URL normalization status.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectableUrlNormalizationStatus = z.infer<typeof ProtectableUrlNormalizationStatusSchema>;

/**
 * Validates a normalized protectable URL.
 * @since 0.1.0 Initial implementation.
 */
const NormalizedProtectableUrlSchema = z.object( {
	status: z.enum( [ ProtectableUrlNormalizationStatus.NORMALIZED ] ),
	url: z.instanceof( URL ),
	host: CanonicalHostSchema,
} ).strict();

/**
 * Validates a rejected protectable URL normalization.
 * @since 0.1.0 Initial implementation.
 */
const RejectedProtectableUrlSchema = z.object( {
	status: z.enum( [ ProtectableUrlNormalizationStatus.REJECTED ] ),
	reason: UrlParsingFailureReasonSchema,
} ).strict();

/**
 * Validates the result of protectable URL normalization.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectableUrlNormalizationResultSchema = z.discriminatedUnion( 'status', [
	NormalizedProtectableUrlSchema,
	RejectedProtectableUrlSchema,
] );

/**
 * Result of protectable URL normalization.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectableUrlNormalizationResult = z.infer<typeof ProtectableUrlNormalizationResultSchema>;
