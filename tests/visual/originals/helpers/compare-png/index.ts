import { PNG } from 'pngjs';
import type { ExactPngComparison } from './types';

/**
 * Compares decoded 8-bit screenshot RGBA samples without antialias exclusions, gamma adjustment or channel rescaling.
 * @param expectedBytes - Immutable original PNG bytes.
 * @param actualBytes - Single captured screenshot's PNG bytes.
 * @return Original and captured dimensions with the number of differing pixel positions.
 * @since 0.1.0
 */
export function comparePngPixels( expectedBytes: Buffer, actualBytes: Buffer ): ExactPngComparison {
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
	for ( let y = 0; y < overlapHeight; y++ ) {
		for ( let x = 0; x < overlapWidth; x++ ) {
			const expectedOffset = ( y * expected.width + x ) * 4;
			const actualOffset = ( y * actual.width + x ) * 4;
			for ( let channel = 0; channel < 4; channel++ ) {
				if ( expected.data[ expectedOffset + channel ] !== actual.data[ actualOffset + channel ] ) {
					differingPixels++;
					break;
				}
			}
		}
	}
	return {
		expected: { width: expected.width, height: expected.height },
		actual: { width: actual.width, height: actual.height },
		differingPixels,
	};
}
