import type { ContrastMeasurement } from './types';

/**
 * Measures a batch in the browser, sharing color conversion and returning diagnostic text with each result.
 * @since 1.0.0
 * @remarks Self-contained so Playwright can serialize this function into the page.
 * @param elements - Rendered shared-control surfaces, in fixture order.
 * @return Foreground contrast and keyboard eligibility for every supplied surface.
 */
export function measureContrast( elements: Element[] ): ContrastMeasurement[] {
	const canvas = document.createElement( 'canvas' );
	canvas.width = canvas.height = 1;
	const context = canvas.getContext( '2d', { willReadFrequently: true } );
	if ( ! context ) {
		throw new Error( 'Canvas unavailable for contrast calculation' );
	}
	const luminances = new Map<string, number>();
	/**
	 * Resolves computed CSS colors, including color-mix, to WCAG relative luminance.
	 * @param color - Browser-computed color.
	 * @return Relative luminance in sRGB.
	 */
	const luminance = ( color: string ): number => {
		const cached = luminances.get( color );
		if ( cached !== undefined ) {
			return cached;
		}
		context.clearRect( 0, 0, 1, 1 );
		context.fillStyle = color;
		context.fillRect( 0, 0, 1, 1 );
		const channels = context.getImageData( 0, 0, 1, 1 ).data;
		const value = [ 0.2126, 0.7152, 0.0722 ].reduce( ( total, weight, index ) => {
			const channel = ( channels[ index ] ?? 0 ) / 255;
			const linear = channel <= 0.04045 ? channel / 12.92 : ( ( channel + 0.055 ) / 1.055 ) ** 2.4;
			return total + linear * weight;
		}, 0 );
		luminances.set( color, value );
		return value;
	};
	return elements.map( ( element ) => {
		const style = getComputedStyle( element );
		let parent = element;
		let background = style.backgroundColor;
		while ( background === 'rgba(0, 0, 0, 0)' && parent.parentElement ) {
			parent = parent.parentElement;
			background = getComputedStyle( parent ).backgroundColor;
		}
		const foreground = luminance( style.color );
		const back = luminance( background );
		return {
			label: element.textContent.trim(),
			background,
			ratio: ( Math.max( foreground, back ) + 0.05 ) / ( Math.min( foreground, back ) + 0.05 ),
			focusable: element instanceof HTMLElement && element.tabIndex >= 0 && ! element.matches( ':disabled' ),
		};
	} );
}
