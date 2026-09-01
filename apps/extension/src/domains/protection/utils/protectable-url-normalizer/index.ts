import {
	CanonicalHostSchema,
	type CanonicalHost,
} from '../../types/protected-site-rule';
import { UrlParsingFailureReason } from '../../types/url-parsing-failure';
import {
	BrowserControlledProtocolSchema,
	ProtectableProtocolSchema,
	ProtectableUrlNormalizationResultSchema,
	ProtectableUrlNormalizationStatus,
	ProtectedSiteInputSchema,
	type ProtectableUrlNormalizationResult,
} from './types';

const EXPLICIT_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const SCHEMELESS_HOST_PORT_PATTERN = /^(?:\[[^\]]+\]|[^/?#:@]+):\d+(?:[/?#]|$)/;
const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Normalizes and validates a hostname produced by URL parsing.
 * @param hostname - A hostname returned by URL.
 * @return A canonical host, or null when the hostname is invalid.
 * @since 0.1.0 Initial implementation.
 */
function normalizeHostname( hostname: string ): CanonicalHost | null {
	const lowerCaseHostname = hostname.toLowerCase();

	if ( lowerCaseHostname.endsWith( '..' ) ) {
		return null;
	}

	const normalizedHostname = lowerCaseHostname.replace( /\.$/, '' );

	if ( normalizedHostname.startsWith( '[' ) ) {
		return CanonicalHostSchema.parse( normalizedHostname );
	}

	if ( normalizedHostname.length === 0 || normalizedHostname.length > 253 ) {
		return null;
	}

	for ( const label of normalizedHostname.split( '.' ) ) {
		if ( label.length === 0 || label.length > 63 || ! DNS_LABEL_PATTERN.test( label ) ) {
			return null;
		}
	}

	return CanonicalHostSchema.parse( normalizedHostname );
}

/**
 * Normalizes a navigation or protected-site input into one protectable URL and canonical host.
 * @param input - Unknown navigation or protected-site input.
 * @return A normalized URL and host, or a stable rejection.
 * @since 0.1.0 Initial implementation.
 */
export function normalizeProtectableUrl( input: unknown ): ProtectableUrlNormalizationResult {
	const inputResult = ProtectedSiteInputSchema.safeParse( input );

	if ( ! inputResult.success ) {
		return {
			status: ProtectableUrlNormalizationStatus.REJECTED,
			reason: UrlParsingFailureReason.MALFORMED_INPUT,
		};
	}

	let urlInput = inputResult.data;

	if ( urlInput.startsWith( '//' ) ) {
		urlInput = `https:${ urlInput }`;
	} else if ( SCHEMELESS_HOST_PORT_PATTERN.test( urlInput ) || ! EXPLICIT_SCHEME_PATTERN.test( urlInput ) ) {
		urlInput = `https://${ urlInput }`;
	}

	let parsedUrl: URL;

	try {
		parsedUrl = new URL( urlInput );
	} catch {
		return {
			status: ProtectableUrlNormalizationStatus.REJECTED,
			reason: UrlParsingFailureReason.MALFORMED_INPUT,
		};
	}

	if ( BrowserControlledProtocolSchema.safeParse( parsedUrl.protocol ).success ) {
		return {
			status: ProtectableUrlNormalizationStatus.REJECTED,
			reason: UrlParsingFailureReason.BROWSER_CONTROLLED_SCHEME,
		};
	}

	if ( ! ProtectableProtocolSchema.safeParse( parsedUrl.protocol ).success ) {
		return {
			status: ProtectableUrlNormalizationStatus.REJECTED,
			reason: UrlParsingFailureReason.UNSUPPORTED_SCHEME,
		};
	}

	const host = normalizeHostname( parsedUrl.hostname );

	if ( host === null ) {
		return {
			status: ProtectableUrlNormalizationStatus.REJECTED,
			reason: UrlParsingFailureReason.MALFORMED_INPUT,
		};
	}

	parsedUrl.hostname = host;

	return ProtectableUrlNormalizationResultSchema.parse( {
		status: ProtectableUrlNormalizationStatus.NORMALIZED,
		url: parsedUrl,
		host,
	} );
}

export {
	BrowserControlledProtocol,
	BrowserControlledProtocolSchema,
	ProtectableProtocol,
	ProtectableProtocolSchema,
	ProtectableUrlNormalizationResultSchema,
	ProtectableUrlNormalizationStatus,
	ProtectedSiteInputSchema,
	type ProtectableUrlNormalizationResult,
	type ProtectedSiteInput,
} from './types';
