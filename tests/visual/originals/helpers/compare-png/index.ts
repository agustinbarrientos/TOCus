import { PNG } from 'pngjs';
import type { PngComparison, PngComparisonOptions } from './types';

/**
 * Conservatively identifies a blended color edge, never a flat fill or local extremum.
 * @param image - Decoded screenshot.
 * @param x - Physical pixel column.
 * @param y - Physical pixel row.
 * @return Whether darker and lighter opaque neighbors bracket this pixel beyond one RGB level.
 */
function isBlendedEdge( image: PNG, x: number, y: number ): boolean {
	const offset = ( y * image.width + x ) * 4;
	const center = image.data.readUInt8( offset )
		+ image.data.readUInt8( offset + 1 ) + image.data.readUInt8( offset + 2 );
	let darkest = center;
	let lightest = center;
	for ( let row = Math.max( 0, y - 1 ); row <= Math.min( image.height - 1, y + 1 ); row++ ) {
		for ( let column = Math.max( 0, x - 1 ); column <= Math.min( image.width - 1, x + 1 ); column++ ) {
			const neighbor = ( row * image.width + column ) * 4;
			if ( image.data[ neighbor + 3 ] !== 255 ) {
				continue;
			}
			const brightness = image.data.readUInt8( neighbor )
				+ image.data.readUInt8( neighbor + 1 ) + image.data.readUInt8( neighbor + 2 );
			darkest = Math.min( darkest, brightness );
			lightest = Math.max( lightest, brightness );
		}
	}
	// Summed RGB uses three integer channels: one-level noise alone spans at most three.
	return darkest < center && center < lightest && lightest - darkest > 3;
}

/**
 * Compares decoded 8-bit RGBA samples, retaining raw differences even when edge tolerance is enabled.
 * @param expectedBytes - Immutable original PNG bytes.
 * @param actualBytes - Single captured screenshot's PNG bytes.
 * @param options - Exact by default; optionally accepts only opaque one-level RGB changes at blended edges.
 * @return Dimensions, raw differences and the separately counted approved edge variance.
 * @since 0.1.0
 */
export function comparePngPixels(
	expectedBytes: Buffer, actualBytes: Buffer, options: PngComparisonOptions = {},
): PngComparison {
	const expected = PNG.sync.read( expectedBytes, { skipRescale: true } );
	const actual = PNG.sync.read( actualBytes, { skipRescale: true } );
	for ( const image of [ expected, actual ] ) {
		if ( image.depth !== 8 || ( image.colorType !== 2 && image.colorType !== 6 )
			|| ( image.colorType === 2 && image.alpha ) ) {
			throw new Error( 'Exact screenshot comparison requires 8-bit RGB or RGBA without transparent-color encoding.' );
		}
	}
	const overlapWidth = Math.min( expected.width, actual.width );
	const overlapHeight = Math.min( expected.height, actual.height );
	let differingPixels = expected.width * expected.height + actual.width * actual.height
		- 2 * overlapWidth * overlapHeight;
	let toleratedEdgePixels = 0;
	const allowEdges = options.allowEdgeRasterization
		&& expected.width === actual.width && expected.height === actual.height;
	for ( let y = 0; y < overlapHeight; y++ ) {
		for ( let x = 0; x < overlapWidth; x++ ) {
			const expectedOffset = ( y * expected.width + x ) * 4;
			const actualOffset = ( y * actual.width + x ) * 4;
			let largestRgbDelta = 0;
			for ( let channel = 0; channel < 3; channel++ ) {
				largestRgbDelta = Math.max( largestRgbDelta,
					Math.abs( expected.data.readUInt8( expectedOffset + channel )
						- actual.data.readUInt8( actualOffset + channel ) ) );
			}
			const expectedAlpha = expected.data[ expectedOffset + 3 ];
			const actualAlpha = actual.data[ actualOffset + 3 ];
			if ( largestRgbDelta === 0 && expectedAlpha === actualAlpha ) {
				continue;
			}
			differingPixels++;
			if ( allowEdges && largestRgbDelta <= 1 && expectedAlpha === 255 && actualAlpha === 255
				&& isBlendedEdge( expected, x, y ) && isBlendedEdge( actual, x, y ) ) {
				toleratedEdgePixels++;
			}
		}
	}
	return {
		expected: { width: expected.width, height: expected.height },
		actual: { width: actual.width, height: actual.height },
		differingPixels,
		toleratedEdgePixels,
	};
}
