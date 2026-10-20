import { z } from 'zod';

const CANONICAL_DNS_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/u;

/**
 * Checks whether a host is already in canonical ASCII form.
 * @param value - Candidate canonical host.
 * @return Whether URL parsing preserves the host and every DNS label is valid.
 * @since 1.0.0 Initial implementation.
 */
function isCanonicalHost( value: string ): boolean {
	if ( value.endsWith( '.' ) ) {
		return false;
	}

	try {
		const parsedUrl = new URL( `https://${ value }` );

		if ( parsedUrl.hostname !== value ) {
			return false;
		}
	} catch {
		return false;
	}

	if ( value.startsWith( '[' ) ) {
		return value.endsWith( ']' ) && ! value.includes( '%' );
	}

	return value.split( '.' ).every( ( label ) => CANONICAL_DNS_LABEL_PATTERN.test( label ) );
}

/**
 * Validates a canonical ASCII host.
 * @since 1.0.0 Initial implementation.
 */
export const CanonicalHostSchema = z.string().min( 1 ).max( 253 ).refine( isCanonicalHost );

/**
 * Canonical ASCII host.
 * @since 1.0.0 Initial implementation.
 */
export type CanonicalHost = z.infer<typeof CanonicalHostSchema>;
