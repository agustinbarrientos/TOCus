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

/**
 * Creates a CSP-compatible stylesheet whose dimensions cannot inherit a site's root font.
 * @since 0.1.0
 * @param css - Compiled extension-owned styles, never protected-page styles.
 * @return An unadopted sheet for the caller's owned shadow root.
 */
export function createShadowStyleSheet( css: string ): CSSStyleSheet {
	const sheet = new CSSStyleSheet();
	sheet.replaceSync( normalizeShadowLengths( css ) );
	return sheet;
}

/**
 * Normalizes only changed rem values through CSSOM, which works under strict host CSP.
 * @param element - Element inside one provider-owned subtree.
 */
function normalizeInlineLengths( element: Element ): void {
	if ( ! ( element instanceof HTMLElement || element instanceof SVGElement ) ) {
		return;
	}
	for ( const property of element.style ) {
		const value = element.style.getPropertyValue( property );
		const normalized = normalizeShadowLengths( value );
		if ( normalized !== value ) {
			element.style.setProperty( property, normalized, element.style.getPropertyPriority( property ) );
		}
	}
}

/**
 * Includes Mantine prop-generated inline lengths in the same shadow-only isolation contract.
 * Initial styles normalize immediately; later React writes normalize once per mutation batch before paint.
 * Converted values are stable, so observer delivery cannot create a loop.
 * @since 0.1.0
 * @param scope - Provider-owned element, never the protected document or its ancestors.
 * @return Cleanup releasing observation when this provider unmounts.
 */
export function observeShadowInlineLengths( scope: Element ): () => void {
	normalizeInlineLengths( scope );
	for ( const element of scope.querySelectorAll( '[style]' ) ) {
		normalizeInlineLengths( element );
	}
	const observer = new MutationObserver( ( changes ) => {
		for ( const change of changes ) {
			if ( change.type === 'attributes' && change.target instanceof Element ) {
				normalizeInlineLengths( change.target );
			}
			for ( const node of change.addedNodes ) {
				if ( node instanceof Element ) {
					normalizeInlineLengths( node );
					for ( const element of node.querySelectorAll( '[style]' ) ) {
						normalizeInlineLengths( element );
					}
				}
			}
		}
	} );
	observer.observe( scope, { subtree: true, childList: true, attributes: true, attributeFilter: [ 'style' ] } );
	return () => {
		observer.disconnect();
	};
}
