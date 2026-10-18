import { z } from 'zod';

/**
 * Maximum number of saved focus destinations.
 * @since 1.1.0
 */
export const FocusLinkMaximumCount = 3;

/**
 * Maximum length of one stable focus link identity.
 * @since 1.1.0
 */
export const FocusLinkMaximumIdLength = 80;

/**
 * Maximum length of a trimmed focus link label.
 * @since 1.1.0
 */
export const FocusLinkMaximumLabelLength = 64;

/**
 * Maximum length of a trimmed and normalized focus destination URL.
 * @since 1.1.0
 */
export const FocusLinkMaximumUrlLength = 2_048;

/**
 * Validates and normalizes credential-free absolute web destinations.
 * @since 1.1.0
 */
const FocusLinkUrlSchema = z.string().regex( /^[^\p{Cc}]*$/u ).trim().max( FocusLinkMaximumUrlLength )
	.transform( ( value, context ) => {
		try {
			const url = new URL( value );
			if ( ! /^https?:\/\//i.test( value ) || url.username !== '' || url.password !== '' ) {
				throw new Error( 'Focus destinations must be credential-free web URLs.' );
			}
			return url.href;
		} catch {
			context.addIssue( { code: 'custom', message: 'Focus destination URL is invalid.' } );
			return z.NEVER;
		}
	} ).pipe( z.string().max( FocusLinkMaximumUrlLength ) );

/**
 * Validates one stable, named focus destination.
 * @since 1.1.0
 */
export const FocusLinkSchema = z.strictObject( {
	id: z.string().regex( /^focus_link_[A-Za-z0-9_-]+$/ ).max( FocusLinkMaximumIdLength ),
	label: z.string().regex( /^[^\p{Cc}]*$/u ).trim().min( 1 ).max( FocusLinkMaximumLabelLength ),
	url: FocusLinkUrlSchema,
} );

/**
 * One user-selected alternative destination offered during a pause.
 * @since 1.1.0
 */
export type FocusLink = z.infer<typeof FocusLinkSchema>;

/**
 * Validates the saved order and unique identities of bounded focus destinations.
 * @since 1.1.0
 */
export const FocusLinksSchema = z.array( FocusLinkSchema ).max( FocusLinkMaximumCount )
	.refine( ( links ) => new Set( links.map( ( link ) => link.id ) ).size === links.length,
		{ message: 'Focus link identities must be unique.' } );
