import { type ProtectedSiteRule } from '../../../../domains/protection/types/protected-site-rule';

const ALL_URLS_PATTERN = '<all_urls>';
const MATCH_PATTERN = /^(\*|https?):\/\/[^/]+\/\*$/;

/**
 * Parses one HTTP(S) browser permission match pattern.
 * @param origin - Unknown permission origin pattern.
 * @return Parsed scheme and host, or null for unsupported patterns.
 * @since 0.1.0 Initial implementation.
 */
function parseSitePermissionOrigin( origin: string ) {
	if ( ! MATCH_PATTERN.test( origin ) ) {
		return null;
	}

	const schemeSeparatorIndex = origin.indexOf( '://' );

	return {
		host: origin.slice( schemeSeparatorIndex + 3, -2 ),
		scheme: origin.slice( 0, schemeSeparatorIndex ),
	};
}

/**
 * Creates the optional host origins required by one protected-site rule.
 * @param rule - Canonical protected-site rule selected by the user.
 * @return Exact runtime permission origins for the rule.
 * @since 0.1.0 Initial implementation.
 */
export function createSitePermissionOrigins( rule: ProtectedSiteRule ): string[] {
	return rule.includeSubdomains
		? [ `*://*.${ rule.host }/*` ]
		: [ `*://${ rule.host }/*` ];
}

/**
 * Reports whether granted host permissions fully cover one required origin pattern.
 * @param requiredOrigin - Exact origin pattern TOCus requires for a protected site.
 * @param grantedOrigins - Origin patterns currently granted by the browser.
 * @return Whether the grants cover both HTTP and HTTPS access for the required hosts.
 * @since 0.1.0 Initial implementation.
 */
export function isSitePermissionOriginCovered(
	requiredOrigin: string,
	grantedOrigins: readonly string[],
): boolean {
	const requiredPattern = parseSitePermissionOrigin( requiredOrigin );

	if ( requiredPattern === null ) {
		return false;
	}

	const requiredSchemes = requiredPattern.scheme === '*'
		? [ 'http', 'https' ]
		: [ requiredPattern.scheme ];

	return requiredSchemes.every( ( requiredScheme ) => grantedOrigins.some( ( grantedOrigin ) => {
		if ( grantedOrigin === ALL_URLS_PATTERN ) {
			return true;
		}

		const grantedPattern = parseSitePermissionOrigin( grantedOrigin );

		if (
			grantedPattern === null ||
			( grantedPattern.scheme !== '*' && grantedPattern.scheme !== requiredScheme )
		) {
			return false;
		}

		if ( grantedPattern.host === '*' ) {
			return true;
		}

		if ( requiredPattern.host.startsWith( '*.' ) ) {
			if ( ! grantedPattern.host.startsWith( '*.' ) ) {
				return false;
			}

			const requiredBaseHost = requiredPattern.host.slice( 2 );
			const grantedBaseHost = grantedPattern.host.slice( 2 );

			return requiredBaseHost === grantedBaseHost || requiredBaseHost.endsWith( `.${ grantedBaseHost }` );
		}

		if ( grantedPattern.host.startsWith( '*.' ) ) {
			const grantedBaseHost = grantedPattern.host.slice( 2 );

			return requiredPattern.host === grantedBaseHost ||
				requiredPattern.host.endsWith( `.${ grantedBaseHost }` );
		}

		return requiredPattern.host === grantedPattern.host;
	} ) );
}
