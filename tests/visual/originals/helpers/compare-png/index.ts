import { PNG } from 'pngjs';
import type { PngComparison, PngComparisonOptions, PngNeighborhoodBrightness } from './types';

/** Largest approved difference in any one opaque, blended-edge color channel. */
const maximumEdgeChannelDelta = 2;

/** Number of samples required on each side to establish continuing edge topology. */
const edgeContinuationLength = 2;

/** Minimum summed-RGB separation between an extremum and each opposing surface. */
const minimumEdgeBrightnessSpan = 3 * maximumEdgeChannelDelta;

/**
 * Reads summed RGB brightness without applying color-profile rescaling.
 * @param image - Decoded screenshot.
 * @param x - Physical pixel column.
 * @param y - Physical pixel row.
 * @return Integer summed-RGB brightness.
 */
function pixelBrightness( image: PNG, x: number, y: number ): number {
	const offset = ( y * image.width + x ) * 4;
	return image.data.readUInt8( offset )
		+ image.data.readUInt8( offset + 1 ) + image.data.readUInt8( offset + 2 );
}

/**
 * Checks whether one decoded sample is fully opaque.
 * @param image - Decoded screenshot.
 * @param x - Physical pixel column.
 * @param y - Physical pixel row.
 * @return Whether alpha is exactly 255.
 */
function isOpaquePixel( image: PNG, x: number, y: number ): boolean {
	return image.data[ ( y * image.width + x ) * 4 + 3 ] === 255;
}

/**
 * Finds the center and opaque brightness bounds in one immediate neighborhood.
 * @param image - Decoded screenshot.
 * @param x - Physical pixel column.
 * @param y - Physical pixel row.
 * @return Center, darkest and lightest summed-RGB values.
 */
function neighborhoodBrightness( image: PNG, x: number, y: number ): PngNeighborhoodBrightness {
	const center = pixelBrightness( image, x, y );
	let darkest = center;
	let lightest = center;
	for ( let row = Math.max( 0, y - 1 ); row <= Math.min( image.height - 1, y + 1 ); row++ ) {
		for ( let column = Math.max( 0, x - 1 ); column <= Math.min( image.width - 1, x + 1 ); column++ ) {
			const neighbor = ( row * image.width + column ) * 4;
			if ( image.data[ neighbor + 3 ] !== 255 ) {
				continue;
			}
			const brightness = pixelBrightness( image, column, row );
			darkest = Math.min( darkest, brightness );
			lightest = Math.max( lightest, brightness );
		}
	}
	return { center, darkest, lightest };
}

/**
 * Conservatively identifies a blended color edge, never a flat fill or local extremum.
 * @remarks This conservative local heuristic cannot establish why a blended sample changed.
 * @param image - Decoded screenshot.
 * @param x - Physical pixel column.
 * @param y - Physical pixel row.
 * @return Whether darker and lighter opaque neighbors bracket this sample beyond the channel allowance.
 */
function isBlendedEdge( image: PNG, x: number, y: number ): boolean {
	if ( ! isOpaquePixel( image, x, y ) ) {
		return false;
	}
	const { center, darkest, lightest } = neighborhoodBrightness( image, x, y );
	return darkest < center && center < lightest && lightest - darkest > minimumEdgeBrightnessSpan;
}

/**
 * Requires every immediate opaque neighbor to lie strictly on one side of the candidate.
 * @param image - Decoded screenshot.
 * @param x - Candidate physical pixel column.
 * @param y - Candidate physical pixel row.
 * @param direction - One for a local minimum or negative one for a local maximum.
 * @return Whether a complete opaque neighborhood has the requested strict extremum.
 */
function isStrictLocalExtremum( image: PNG, x: number, y: number, direction: number ): boolean {
	if ( x < 1 || x >= image.width - 1 || y < 1 || y >= image.height - 1 ) {
		return false;
	}
	const center = pixelBrightness( image, x, y );
	for ( let row = y - 1; row <= y + 1; row++ ) {
		for ( let column = x - 1; column <= x + 1; column++ ) {
			if ( ( column !== x || row !== y )
				&& ( ! isOpaquePixel( image, column, row )
					|| direction * ( pixelBrightness( image, column, row ) - center ) <= 0 ) ) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Identifies a locally darkest or lightest sample on a continuing thin edge.
 * @remarks Tangent samples two positions away establish topology without observing the candidate itself.
 * @param image - Decoded screenshot.
 * @param x - Candidate physical pixel column.
 * @param y - Candidate physical pixel row.
 * @param tangentX - Horizontal step along the candidate edge.
 * @param tangentY - Vertical step along the candidate edge.
 * @param direction - One for a local minimum or negative one for a local maximum.
 * @return Whether the unchanged image topology supports the extremum.
 */
function isSupportedEdgeExtremum(
	image: PNG, x: number, y: number, tangentX: number, tangentY: number, direction: number,
): boolean {
	const normalX = tangentY;
	const normalY = tangentX;
	for ( const sign of [ -1, 1 ] ) {
		const normalColumn = x + sign * normalX;
		const normalRow = y + sign * normalY;
		const farTangentColumn = x + sign * edgeContinuationLength * tangentX;
		const farTangentRow = y + sign * edgeContinuationLength * tangentY;
		if ( normalColumn < 0 || normalColumn >= image.width || normalRow < 0 || normalRow >= image.height
			|| farTangentColumn < 0 || farTangentColumn >= image.width
			|| farTangentRow < 0 || farTangentRow >= image.height ) {
			return false;
		}
	}
	const { center, darkest, lightest } = neighborhoodBrightness( image, x, y );
	if ( ! isStrictLocalExtremum( image, x, y, direction )
		|| lightest - darkest <= minimumEdgeBrightnessSpan ) {
		return false;
	}
	for ( const sign of [ -1, 1 ] ) {
		const normalColumn = x + sign * normalX;
		const normalRow = y + sign * normalY;
		const normalBrightness = pixelBrightness( image, normalColumn, normalRow );
		if ( direction * ( normalBrightness - center ) <= minimumEdgeBrightnessSpan ) {
			return false;
		}
		for ( let distance = 1; distance <= edgeContinuationLength; distance++ ) {
			if ( ! isBlendedEdge( image, x + sign * distance * tangentX, y + sign * distance * tangentY ) ) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Requires the same extremum polarity and tangent axis in expected and actual images.
 * @param expected - Decoded reviewed screenshot.
 * @param actual - Decoded captured screenshot.
 * @param x - Candidate physical pixel column.
 * @param y - Candidate physical pixel row.
 * @return Whether both images independently contain the same continuing edge topology.
 */
function isMatchingEdgeExtremum( expected: PNG, actual: PNG, x: number, y: number ): boolean {
	for ( const direction of [ -1, 1 ] ) {
		for ( const [ tangentX, tangentY ] of [ [ 0, 1 ], [ 1, 0 ] ] as const ) {
			if ( isSupportedEdgeExtremum(
				expected, x, y, tangentX, tangentY, direction,
			) && isSupportedEdgeExtremum(
				actual, x, y, tangentX, tangentY, direction,
			) ) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Compares decoded 8-bit RGBA samples, retaining raw differences even when edge tolerance is enabled.
 * @param expectedBytes - Immutable original PNG bytes.
 * @param actualBytes - Single captured screenshot's PNG bytes.
 * @param options - Exact by default; optionally accepts only opaque changes of up to two RGB levels at fixed blended edges.
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
			if ( allowEdges && largestRgbDelta <= maximumEdgeChannelDelta
				&& expectedAlpha === 255 && actualAlpha === 255
				&& ( ( isBlendedEdge( expected, x, y ) && isBlendedEdge( actual, x, y ) )
					|| isMatchingEdgeExtremum( expected, actual, x, y ) ) ) {
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
