/**
 * Reads the exact protected destination carried by a trusted pause-document fragment.
 * @param candidate - Browser-reported pause document URL, if available.
 * @param currentUrl - Trusted canonical pause document URL.
 * @return Exact retained HTTP(S) destination, or null when the carrier is invalid.
 * @since 0.1.0 Initial implementation.
 */
export function readInterruptionNavigationDestination(
	candidate: string | undefined,
	currentUrl: string,
): string | null {
	const prefix = `${ currentUrl }#destination=`;

	if ( candidate === undefined || ! candidate.startsWith( prefix ) ) {
		return null;
	}

	const destination = candidate.slice( prefix.length );

	if ( ! destination.startsWith( 'http://' ) && ! destination.startsWith( 'https://' ) ) {
		return null;
	}

	try {
		new URL( destination );
	} catch {
		return null;
	}

	return destination;
}
