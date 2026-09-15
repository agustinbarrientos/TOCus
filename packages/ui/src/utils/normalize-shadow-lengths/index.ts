/** Quoted CSS content, including escaped quotes and line continuations. */
const quotedCssTokens = [
	'"(?:\\\\[\\s\\S]|[^"\\\\])*"',
	"'(?:\\\\[\\s\\S]|[^'\\\\])*'",
].join( '|' );

/** CSS tokens that must remain literal, followed by numeric rem dimensions. */
const shadowLengthTokens = new RegExp( [
	'/\\*[\\s\\S]*?\\*/',
	quotedCssTokens,
	`url\\((?:${ quotedCssTokens }|\\\\[\\s\\S]|[^)'"\\\\])*\\)`,
	'(?<![\\w.-])([-+]?(?:\\d*\\.)?\\d+(?:e[-+]?\\d+)?)rem\\b',
].join( '|' ), 'giu' );

/**
 * Resolves owned CSS dimensions against the extension's fixed 16px root baseline.
 * Keeps Mantine's scale expressions intact and never rewrites strings or resource URLs.
 * This is an injection boundary transform, not a replacement for the library stylesheet.
 * @since 0.1.0
 * @param css - Packaged stylesheet or inline declaration value owned by the provider.
 * @return Host-independent CSS with all other units and tokens unchanged.
 */
export function normalizeShadowLengths( css: string ): string {
	return css.replace( shadowLengthTokens, ( token: string, amount: string | undefined ) =>
		amount === undefined ? token : `${ String( Number( amount ) * 16 ) }px` );
}
