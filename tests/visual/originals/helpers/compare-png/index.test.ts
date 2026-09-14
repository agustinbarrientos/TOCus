import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { comparePngPixels } from './index';

/**
 * Encodes explicit test pixels through the same public PNG library used by the comparator.
 * @param width - Fixture width in pixels.
 * @param height - Fixture height in pixels.
 * @param pixels - Row-major RGBA bytes, including transparent pixels.
 * @param level - PNG compression level, unrelated to decoded pixel equality.
 * @return Encoded fixture without filesystem or screenshot baseline writes.
 * @since 0.1.0
 */
function encode( width: number, height: number, pixels: readonly number[], level = 9 ): Buffer {
	const image = new PNG( { width, height } );
	image.data = Buffer.from( pixels );
	return PNG.sync.write( image, { deflateLevel: level } );
}

/**
 * Copies a fixture while replacing one decoded RGBA sample.
 * @param pixels - Source row-major RGBA bytes.
 * @param width - Source width in pixels.
 * @param x - Replacement column.
 * @param y - Replacement row.
 * @param rgba - Four replacement channel values.
 * @return Independent changed pixel array.
 */
function replacePixel(
	pixels: readonly number[], width: number, x: number, y: number, rgba: readonly number[],
): number[] {
	const changed = [ ...pixels ];
	changed.splice( ( y * width + x ) * 4, 4, ...rgba );
	return changed;
}

/**
 * Transposes decoded pixels to exchange horizontal and vertical topology.
 * @param width - Source width in pixels.
 * @param height - Source height in pixels.
 * @param pixels - Source row-major RGBA bytes.
 * @return Transposed row-major RGBA bytes with width equal to the source height.
 */
function transposePixels( width: number, height: number, pixels: readonly number[] ): number[] {
	const transposed = Array<number>( pixels.length );
	for ( let y = 0; y < height; y++ ) {
		for ( let x = 0; x < width; x++ ) {
			const source = ( y * width + x ) * 4;
			const target = ( x * height + y ) * 4;
			transposed.splice( target, 4, ...pixels.slice( source, source + 4 ) );
		}
	}
	return transposed;
}

/**
 * Embeds decoded pixels in an opaque white frame without changing their local samples.
 * @param width - Source width in pixels.
 * @param height - Source height in pixels.
 * @param pixels - Source row-major RGBA bytes.
 * @param framedWidth - Result width in pixels.
 * @param framedHeight - Result height in pixels.
 * @param offsetX - Source origin column in the result.
 * @param offsetY - Source origin row in the result.
 * @return Framed row-major RGBA bytes.
 */
function embedPixels(
	width: number, height: number, pixels: readonly number[],
	framedWidth: number, framedHeight: number, offsetX: number, offsetY: number,
): number[] {
	const framed = Array.from( { length: framedWidth * framedHeight }, () => [ 255, 255, 255, 255 ] ).flat();
	for ( let y = 0; y < height; y++ ) {
		for ( let x = 0; x < width; x++ ) {
			const source = ( y * width + x ) * 4;
			const target = ( ( y + offsetY ) * framedWidth + x + offsetX ) * 4;
			framed.splice( target, 4, ...pixels.slice( source, source + 4 ) );
		}
	}
	return framed;
}

/**
 * Creates a synthetic five-sample thin edge around a strict central extremum.
 * @param horizontal - Whether the edge tangent runs horizontally instead of vertically.
 * @param maximum - Whether the center is a local maximum instead of a local minimum.
 * @return Nine-by-nine opaque RGBA fixture.
 */
function continuingExtremumPixels( horizontal: boolean, maximum = false ): number[] {
	const surface = maximum ? 0 : 240;
	const center = maximum ? 81 : 80;
	const near = maximum ? 60 : 120;
	const far = maximum ? 40 : 160;
	let pixels = Array.from( { length: 81 }, () => [ surface, surface, surface, 255 ] ).flat();
	pixels = replacePixel( pixels, 9, 4, 4, [ center, center, center, 255 ] );
	for ( const sign of [ -1, 1 ] ) {
		const nearX = horizontal ? 4 + sign : 4;
		const nearY = horizontal ? 4 : 4 + sign;
		const farX = horizontal ? 4 + 2 * sign : 4;
		const farY = horizontal ? 4 : 4 + 2 * sign;
		pixels = replacePixel( pixels, 9, nearX, nearY, [ near, near, near, 255 ] );
		pixels = replacePixel( pixels, 9, farX, farY, [ far, far, far, 255 ] );
	}
	return pixels;
}

describe( 'exact original PNG pixels', () => {
	it( 'accepts equal decoded pixels despite different PNG compression', () => {
		const pixels = [ 40, 80, 120, 255, 40, 80, 120, 255 ];
		const expected = encode( 2, 1, pixels, 0 );
		const actual = encode( 2, 1, pixels, 9 );
		expect( expected.equals( actual ) ).toBe( false );
		expect( comparePngPixels( expected, actual ) ).toEqual( {
			expected: { width: 2, height: 1 }, actual: { width: 2, height: 1 },
			differingPixels: 0, toleratedEdgePixels: 0,
		} );
	} );

	it.each( [ 0, 1, 2, 3 ] )( 'rejects a one-level change in RGBA channel %i', ( channel ) => {
		const pixels = [ 90, 120, 150, 180 ];
		const changed = [ ...pixels ];
		changed[ channel ] = 1 + ( changed[ channel ] ?? 0 );
		expect( comparePngPixels( encode( 1, 1, pixels ), encode( 1, 1, changed ) ).differingPixels ).toBe( 1 );
	} );

	it( 'counts a changed pixel once when multiple channels differ', () => {
		expect( comparePngPixels(
			encode( 2, 1, [ 10, 20, 30, 255, 40, 50, 60, 255 ] ),
			encode( 2, 1, [ 11, 21, 31, 254, 40, 50, 60, 255 ] ),
		).differingPixels ).toBe( 1 );
	} );

	it( 'does not ignore RGB differences underneath zero alpha', () => {
		expect( comparePngPixels(
			encode( 1, 1, [ 10, 20, 30, 0 ] ), encode( 1, 1, [ 10, 21, 30, 0 ] ),
		).differingPixels ).toBe( 1 );
	} );

	it( 'counts mismatched dimensions by their uncovered pixel positions', () => {
		const pixels = [ 10, 20, 30, 255, 10, 20, 30, 255 ];
		expect( comparePngPixels( encode( 2, 1, pixels ), encode( 1, 2, pixels ) ) ).toEqual( {
			expected: { width: 2, height: 1 }, actual: { width: 1, height: 2 },
			differingPixels: 2, toleratedEdgePixels: 0,
		} );
	} );

	it( 'counts overlap differences in addition to uncovered dimensions', () => {
		expect( comparePngPixels(
			encode( 2, 1, [ 10, 20, 30, 255, 40, 50, 60, 255 ] ),
			encode( 1, 1, [ 11, 20, 30, 255 ] ),
		).differingPixels ).toBe( 2 );
	} );

	it( 'rejects corrupt image data rather than treating it as an empty match', () => {
		const valid = encode( 1, 1, [ 10, 20, 30, 255 ] );
		expect( () => comparePngPixels( Buffer.from( 'not a PNG' ), valid ) ).toThrow();
		expect( () => comparePngPixels( valid, Buffer.from( 'not a PNG' ) ) ).toThrow();
	} );

	it( 'checks the last pixel of later rows without changing either input buffer', () => {
		const pixels = [ 10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255 ];
		const expected = encode( 2, 2, pixels );
		const changed = [ ...pixels ];
		changed[ 14 ] = 121;
		const actual = encode( 2, 2, changed );
		const beforeExpected = Buffer.from( expected );
		const beforeActual = Buffer.from( actual );
		expect( comparePngPixels( expected, actual ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		expect( expected ).toEqual( beforeExpected );
		expect( actual ).toEqual( beforeActual );
	} );

	it( 'does not apply gamma metadata to stored RGBA samples', () => {
		const pixels = [ 40, 80, 120, 255 ];
		const image = new PNG( { width: 1, height: 1 } );
		image.data = Buffer.from( pixels );
		image.gamma = 0.45455;
		const expected = encode( 1, 1, pixels );
		const actual = PNG.sync.write( image );
		expect( expected.equals( actual ) ).toBe( false );
		expect( comparePngPixels( expected, actual ).differingPixels ).toBe( 0 );
	} );

	it( 'accepts opaque RGB and RGBA encodings of the same pixels', () => {
		const pixels = [ 40, 80, 120, 255 ];
		const image = new PNG( { width: 1, height: 1 } );
		image.data = Buffer.from( pixels );
		const rgb = PNG.sync.write( image, { colorType: 2 } );
		expect( PNG.sync.read( rgb ).colorType ).toBe( 2 );
		expect( comparePngPixels( rgb, encode( 1, 1, pixels ) ).differingPixels ).toBe( 0 );
	} );

	it( 'rejects higher bit depths instead of rescaling their samples', () => {
		const image = new PNG( { width: 1, height: 1 } );
		image.data = Buffer.from( new Uint16Array( [ 10, 20, 30, 65535 ] ).buffer );
		const sixteenBit = PNG.sync.write( image, { bitDepth: 16 } );
		expect( PNG.sync.read( sixteenBit ).depth ).toBe( 16 );
		expect( () => comparePngPixels( sixteenBit, sixteenBit ) ).toThrow( '8-bit RGB or RGBA' );
	} );

	it( 'rejects transparent-color RGB encoding rather than discarding its stored color', () => {
		// Valid 1×1 RGB PNG with tRNS, generated once by Pillow rather than a handwritten PNG encoder.
		const transparentRgb = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAABnRSTlMACgAUAB7FNin/'
			+ 'AAAADElEQVR4nGPgEpEDAABoAD1UCKP3AAAAAElFTkSuQmCC', 'base64',
		);
		expect( PNG.sync.read( transparentRgb ) ).toMatchObject( { depth: 8, colorType: 2, alpha: true } );
		expect( () => comparePngPixels( transparentRgb, transparentRgb ) ).toThrow( '8-bit RGB or RGBA' );
	} );
} );

describe( 'bounded edge rasterization tolerance', () => {
	// The middle row is a hand-defined color edge, not output from the comparator.
	const edge = [
		240, 240, 240, 255, 240, 240, 240, 255, 240, 240, 240, 255,
		160, 160, 160, 255, 160, 160, 160, 255, 160, 160, 160, 255,
		80, 80, 80, 255, 80, 80, 80, 255, 80, 80, 80, 255,
	];
	// Exact three-column neighborhood from the September 13 macOS CI rounded-frame failure.
	const continuingEdgeExpected = [
		255, 255, 255, 255, 255, 255, 255, 255, 216, 202, 194, 255,
		255, 255, 255, 255, 237, 230, 226, 255, 238, 230, 225, 255,
		255, 255, 255, 255, 222, 210, 203, 255, 248, 244, 239, 255,
		250, 248, 247, 255, 220, 207, 200, 255, 255, 253, 249, 255,
		238, 231, 228, 255, 232, 223, 217, 255, 255, 253, 249, 255,
		230, 221, 217, 255, 242, 237, 232, 255, 255, 253, 249, 255,
		225, 213, 207, 255, 245, 240, 235, 255, 255, 253, 249, 255,
		221, 208, 201, 255, 249, 245, 241, 255, 255, 253, 249, 255,
		217, 203, 195, 255, 253, 250, 246, 255, 255, 253, 249, 255,
		216, 201, 193, 255, 255, 253, 249, 255, 255, 253, 249, 255,
	];
	const continuingEdgeActual = [
		255, 255, 255, 255, 255, 255, 255, 255, 216, 202, 194, 255,
		255, 255, 255, 255, 237, 230, 227, 255, 238, 230, 225, 255,
		255, 255, 255, 255, 222, 210, 203, 255, 248, 244, 239, 255,
		250, 248, 247, 255, 221, 207, 200, 255, 255, 253, 249, 255,
		238, 232, 228, 255, 233, 223, 217, 255, 255, 253, 249, 255,
		232, 223, 217, 255, 243, 237, 232, 255, 255, 253, 249, 255,
		225, 213, 207, 255, 246, 240, 235, 255, 255, 253, 249, 255,
		221, 208, 201, 255, 250, 246, 240, 255, 255, 253, 249, 255,
		217, 203, 195, 255, 253, 251, 246, 255, 255, 253, 249, 255,
		216, 201, 193, 255, 255, 253, 249, 255, 255, 253, 249, 255,
	];

	it.each( [ 0, 1, 2 ] )( 'accepts one RGB level at an edge in channel %i, only when opted in', ( channel ) => {
		const changed = [ ...edge ];
		changed[ 16 + channel ] = 161;
		const expected = encode( 3, 3, edge );
		const actual = encode( 3, 3, changed );
		expect( comparePngPixels( expected, actual ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		expect( comparePngPixels( expected, actual, { allowEdgeRasterization: true } ) ).toMatchObject( {
			differingPixels: 1, toleratedEdgePixels: 1,
		} );
	} );

	it( 'accepts one-level variation in multiple RGB channels and at the image boundary', () => {
		const changed = [ ...edge ];
		changed.splice( 12, 3, 159, 161, 159 );
		const expected = encode( 3, 3, edge );
		const actual = encode( 3, 3, changed );
		const expectedBefore = Buffer.from( expected );
		const actualBefore = Buffer.from( actual );
		expect( comparePngPixels( expected, actual, { allowEdgeRasterization: true } ) ).toMatchObject( {
			differingPixels: 1, toleratedEdgePixels: 1,
		} );
		expect( expected ).toEqual( expectedBefore );
		expect( actual ).toEqual( actualBefore );
	} );

	it.each( [
		{ label: 'three RGB levels', channel: 0, value: 163 },
		{ label: 'an alpha change', channel: 3, value: 254 },
	] )( 'rejects $label even at an edge', ( { channel, value } ) => {
		const changed = [ ...edge ];
		changed[ 16 + channel ] = value;
		expect( comparePngPixels( encode( 3, 3, edge ), encode( 3, 3, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it.each( [ 0, 1, 2 ] )( 'accepts at most two RGB levels on a fixed edge in channel %i', ( channel ) => {
		for ( const delta of [ -2, 2 ] ) {
			const changed = [ ...edge ];
			changed[ 16 + channel ] = 160 + delta;
			const expected = encode( 3, 3, edge );
			const actual = encode( 3, 3, changed );
			expect( comparePngPixels( expected, actual ) )
				.toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
			expect( comparePngPixels( expected, actual, { allowEdgeRasterization: true } ) ).toMatchObject( {
				differingPixels: 1, toleratedEdgePixels: 1,
			} );
		}
	} );

	it( 'accepts the observed rounded-frame variance without changing its surrounding colors', () => {
		// Recorded 3x4 neighborhood of the two differing samples, not an image mask or filename exception.
		const pixels = [
			242, 231, 221, 255, 211, 202, 195, 255, 249, 244, 237, 255,
			224, 210, 196, 255, 230, 221, 215, 255, 249, 244, 237, 255,
			181, 167, 157, 255, 244, 238, 232, 255, 249, 244, 237, 255,
			198, 188, 180, 255, 249, 244, 237, 255, 250, 245, 238, 255,
		];
		const changed = [ ...pixels ];
		changed[ 16 ] = 228;
		changed[ 30 ] = 233;
		expect( comparePngPixels( encode( 3, 4, pixels ), encode( 3, 4, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 2, toleratedEdgePixels: 2 } );
	} );

	it( 'accepts a local edge extremum only when unchanged image topology continues on both sides', () => {
		const expected = encode( 3, 10, continuingEdgeExpected );
		const actual = encode( 3, 10, continuingEdgeActual );
		for ( const [ left, right ] of [ [ expected, actual ], [ actual, expected ] ] as const ) {
			expect( comparePngPixels( left, right ) ).toMatchObject( {
				differingPixels: 9, toleratedEdgePixels: 0,
			} );
			expect( comparePngPixels( left, right, { allowEdgeRasterization: true } ) ).toMatchObject( {
				differingPixels: 9, toleratedEdgePixels: 9,
			} );
		}
	} );

	it( 'accepts the color-inverted neighborhood as a continuing local maximum', () => {
		const expectedPixels = continuingEdgeExpected.map( ( value, index ) => index % 4 === 3 ? value : 255 - value );
		const actualPixels = continuingEdgeActual.map( ( value, index ) => index % 4 === 3 ? value : 255 - value );
		const expected = encode( 3, 10, expectedPixels );
		const actual = encode( 3, 10, actualPixels );
		expect( comparePngPixels( expected, actual ) ).toMatchObject( {
			differingPixels: 9, toleratedEdgePixels: 0,
		} );
		expect( comparePngPixels( expected, actual, { allowEdgeRasterization: true } ) ).toMatchObject( {
			differingPixels: 9, toleratedEdgePixels: 9,
		} );
	} );

	it( 'accepts the recorded extremum without requiring any neighboring pixel to change', () => {
		const actualPixels = replacePixel( continuingEdgeExpected, 3, 1, 3, [ 221, 207, 200, 255 ] );
		for ( const [ left, right ] of [ [ continuingEdgeExpected, actualPixels ],
			[ actualPixels, continuingEdgeExpected ] ] as const ) {
			expect( comparePngPixels( encode( 3, 10, left ), encode( 3, 10, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 1 } );
		}
	} );

	it( 'keeps the topology allowance after transposition and opaque translation', () => {
		const actualPixels = replacePixel( continuingEdgeExpected, 3, 1, 3, [ 221, 207, 200, 255 ] );
		const transposedExpected = transposePixels( 3, 10, continuingEdgeExpected );
		const transposedActual = transposePixels( 3, 10, actualPixels );
		const framedExpected = embedPixels( 3, 10, continuingEdgeExpected, 7, 14, 2, 2 );
		const framedActual = embedPixels( 3, 10, actualPixels, 7, 14, 2, 2 );
		for ( const [ width, height, left, right ] of [
			[ 10, 3, transposedExpected, transposedActual ],
			[ 7, 14, framedExpected, framedActual ],
		] as const ) {
			expect( comparePngPixels( encode( width, height, left ), encode( width, height, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 1 } );
		}
	} );

	it( 'rejects an extremum when one far tangent sample does not continue the edge', () => {
		const expectedPixels = replacePixel( continuingEdgeExpected, 3, 1, 1, [ 255, 255, 255, 255 ] );
		const actualPixels = replacePixel( expectedPixels, 3, 1, 3, [ 221, 207, 200, 255 ] );
		expect( comparePngPixels( encode( 3, 10, expectedPixels ), encode( 3, 10, actualPixels ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it( 'rejects an extremum when expected and actual edge axes differ', () => {
		const expectedPixels = continuingExtremumPixels( false );
		const actualPixels = replacePixel( continuingExtremumPixels( true ), 9, 4, 4, [ 81, 80, 80, 255 ] );
		const comparison = comparePngPixels( encode( 9, 9, expectedPixels ), encode( 9, 9, actualPixels ), {
			allowEdgeRasterization: true,
		} );
		expect( comparison.differingPixels ).toBeGreaterThan( 1 );
		expect( comparison.toleratedEdgePixels ).toBe( 0 );
	} );

	it( 'rejects an extremum when expected and actual polarity differs', () => {
		const expectedPixels = continuingExtremumPixels( false );
		const actualPixels = replacePixel( continuingExtremumPixels( false, true ), 9, 4, 4, [ 81, 80, 80, 255 ] );
		const comparison = comparePngPixels( encode( 9, 9, expectedPixels ), encode( 9, 9, actualPixels ), {
			allowEdgeRasterization: true,
		} );
		expect( comparison.differingPixels ).toBeGreaterThan( 1 );
		expect( comparison.toleratedEdgePixels ).toBe( 0 );
	} );

	it.each( [
		{ normal: [ 83, 82, 82, 255 ], toleratedEdgePixels: 0 },
		{ normal: [ 84, 82, 82, 255 ], toleratedEdgePixels: 1 },
	] )( 'requires opposing normal contrast above six summed RGB levels', ( { normal, toleratedEdgePixels } ) => {
		let expectedPixels = continuingExtremumPixels( false );
		expectedPixels = replacePixel( expectedPixels, 9, 3, 4, normal );
		expectedPixels = replacePixel( expectedPixels, 9, 5, 4, normal );
		const actualPixels = replacePixel( expectedPixels, 9, 4, 4, [ 81, 80, 80, 255 ] );
		expect( comparePngPixels( encode( 9, 9, expectedPixels ), encode( 9, 9, actualPixels ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels } );
	} );

	it( 'rejects an isolated speck and a constant-width glyph stroke', () => {
		const surface = Array.from( { length: 49 }, () => [ 240, 240, 240, 255 ] ).flat();
		const speckExpected = replacePixel( surface, 7, 3, 3, [ 80, 80, 80, 255 ] );
		const speckActual = replacePixel( speckExpected, 7, 3, 3, [ 81, 80, 80, 255 ] );
		let strokeExpected = [ ...surface ];
		for ( let y = 1; y <= 5; y++ ) {
			strokeExpected = replacePixel( strokeExpected, 7, 3, y, [ 80, 80, 80, 255 ] );
		}
		const strokeActual = replacePixel( strokeExpected, 7, 3, 3, [ 81, 80, 80, 255 ] );
		for ( const [ expectedPixels, actualPixels ] of [
			[ speckExpected, speckActual ], [ strokeExpected, strokeActual ],
		] as const ) {
			expect( comparePngPixels( encode( 7, 7, expectedPixels ), encode( 7, 7, actualPixels ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		}
	} );

	it.each( [
		{ label: 'candidate transparency', rgba: [ 221, 207, 200, 254 ] },
		{ label: 'three RGB levels', rgba: [ 223, 207, 200, 255 ] },
	] )( 'keeps hard rejection of $label at a supported extremum', ( { rgba } ) => {
		const actualPixels = replacePixel( continuingEdgeExpected, 3, 1, 3, rgba );
		expect( comparePngPixels( encode( 3, 10, continuingEdgeExpected ), encode( 3, 10, actualPixels ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it.each( [
		{ label: 'normal', alphaOffset: 39 },
		{ label: 'immediate tangent', alphaOffset: 31 },
		{ label: 'far tangent', alphaOffset: 19 },
	] )( 'rejects a supported extremum with a transparent $label sample', ( { alphaOffset } ) => {
		const expectedPixels = [ ...continuingEdgeExpected ];
		expectedPixels[ alphaOffset ] = 0;
		const actualPixels = [ ...expectedPixels ];
		actualPixels[ 40 ] = 221;
		const pairs = [ [ expectedPixels, actualPixels ], [ actualPixels, expectedPixels ] ] as const;
		for ( const [ left, right ] of pairs ) {
			expect( comparePngPixels( encode( 3, 10, left ), encode( 3, 10, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		}
	} );

	it( 'rejects an extremum tied with an opaque diagonal neighbor in each image', () => {
		const expectedPixels = [ ...continuingEdgeExpected ];
		expectedPixels.splice( 24, 3, 220, 207, 200 );
		const actualPixels = [ ...expectedPixels ];
		actualPixels[ 40 ] = 221;
		actualPixels[ 24 ] = 221;
		expect( comparePngPixels( encode( 3, 10, expectedPixels ), encode( 3, 10, actualPixels ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 2, toleratedEdgePixels: 0 } );
	} );

	it( 'rejects a small tint change across an entire gradient despite its blended pixels', () => {
		const changed = edge.map( ( value, index ) => index % 4 === 3 ? value : value + 1 );
		const comparison = comparePngPixels( encode( 3, 3, edge ), encode( 3, 3, changed ), {
			allowEdgeRasterization: true,
		} );
		expect( comparison.differingPixels ).toBeGreaterThan( comparison.toleratedEdgePixels );
	} );

	it( 'retains adjacent one-level edge variance at a cropped image boundary', () => {
		// Captured neighboring samples can vary together; exact anchors are not required by the approved policy.
		const pixels = [
			229, 219, 214, 255, 242, 236, 231, 255, 255, 253, 250, 255,
			225, 214, 208, 255, 246, 240, 236, 255, 255, 253, 250, 255,
			221, 208, 202, 255, 250, 245, 241, 255, 255, 253, 250, 255,
		];
		const changed = [
			229, 218, 213, 255, 241, 235, 230, 255, 255, 253, 250, 255,
			225, 213, 207, 255, 245, 240, 236, 255, 255, 253, 250, 255,
			221, 208, 201, 255, 249, 245, 241, 255, 255, 253, 250, 255,
		];
		// The lower-left corner is a local minimum in this cropped fixture and must remain rejected.
		for ( const [ left, right ] of [ [ pixels, changed ], [ changed, pixels ] ] as const ) {
			expect( comparePngPixels( encode( 3, 3, left ), encode( 3, 3, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 6, toleratedEdgePixels: 5 } );
		}
	} );

	it( 'rejects a low-contrast neighborhood whose brightness span is only six', () => {
		const pixels = [ 159, 159, 159, 255, 160, 160, 160, 255, 161, 161, 161, 255 ];
		const changed = [ ...pixels ];
		changed[ 4 ] = 162;
		expect( comparePngPixels( encode( 3, 1, pixels ), encode( 3, 1, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it( 'rejects a one-level flat fill change instead of creating an edge from the changed image', () => {
		const pixels = Array.from( { length: 9 }, () => [ 160, 160, 160, 255 ] ).flat();
		const changed = [ ...pixels ];
		changed[ 16 ] = 161;
		for ( const [ left, right ] of [ [ pixels, changed ], [ changed, pixels ] ] as const ) {
			expect( comparePngPixels( encode( 3, 3, left ), encode( 3, 3, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		}
	} );

	it( 'rejects a one-level color shift over an entire flat surface', () => {
		const expected = Array.from( { length: 9 }, () => [ 160, 160, 160, 255 ] ).flat();
		const actual = Array.from( { length: 9 }, () => [ 161, 161, 161, 255 ] ).flat();
		expect( comparePngPixels( encode( 3, 3, expected ), encode( 3, 3, actual ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 9, toleratedEdgePixels: 0 } );
	} );

	it( 'keeps a one-pixel edge movement as a regression', () => {
		const shifted = [ ...edge.slice( 0, 12 ), ...edge.slice( 0, 24 ) ];
		expect( comparePngPixels( encode( 3, 3, edge ), encode( 3, 3, shifted ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 6, toleratedEdgePixels: 0 } );
	} );

	it( 'never tolerates a size change', () => {
		expect( comparePngPixels( encode( 3, 3, edge ), encode( 3, 2, edge.slice( 0, 24 ) ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 3, toleratedEdgePixels: 0 } );
	} );

	it( 'counts an accepted edge separately from a rejected flat pixel in the same capture', () => {
		const changed = [ ...edge ];
		changed[ 16 ] = 161;
		changed[ 0 ] = 239;
		expect( comparePngPixels( encode( 3, 3, edge ), encode( 3, 3, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 2, toleratedEdgePixels: 1 } );
	} );

	it.each( [ 0, 128, 254 ] )( 'rejects RGB variance under unchanged nonopaque alpha %i', ( alpha ) => {
		const pixels = [ ...edge ];
		pixels[ 19 ] = alpha;
		const changed = [ ...pixels ];
		changed[ 16 ] = 161;
		expect( comparePngPixels( encode( 3, 3, pixels ), encode( 3, 3, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it( 'does not use transparent neighbor colors to manufacture a blended edge', () => {
		const pixels = edge.map( ( value, index ) => index % 4 === 3 && index !== 19 ? 0 : value );
		const changed = [ ...pixels ];
		changed[ 16 ] = 161;
		expect( comparePngPixels( encode( 3, 3, pixels ), encode( 3, 3, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it( 'rejects one-level neighborhood noise that has a brightness span of only three', () => {
		const pixels = [ 159, 160, 160, 255, 160, 160, 160, 255, 161, 161, 160, 255 ];
		const changed = [ ...pixels ];
		changed[ 4 ] = 161;
		expect( comparePngPixels( encode( 3, 1, pixels ), encode( 3, 1, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it( 'requires a blended edge in both images, not a new local extremum', () => {
		const pixels = [ 0, 0, 0, 255, 99, 100, 100, 255, 100, 100, 100, 255 ];
		const changed = [ ...pixels ];
		changed[ 4 ] = 100;
		for ( const [ left, right ] of [ [ pixels, changed ], [ changed, pixels ] ] as const ) {
			expect( comparePngPixels( encode( 3, 1, left ), encode( 3, 1, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		}
	} );
} );

describe( 'edge allowance regression boundaries', () => {
	it.each( [
		{ span: 6, high: [ 161, 161, 161, 255 ], toleratedEdgePixels: 0 },
		{ span: 7, high: [ 162, 161, 161, 255 ], toleratedEdgePixels: 1 },
	] )( 'requires brightness span above six when the unchanged neighbors span $span', ( { high, toleratedEdgePixels } ) => {
		// Both centers remain strictly between unchanged neighbors, isolating the contrast boundary.
		const pixels = [ 159, 159, 159, 255, 160, 160, 160, 255, ...high ];
		const changed = [ 159, 159, 159, 255, 162, 160, 160, 255, ...high ];
		for ( const [ left, right ] of [ [ pixels, changed ], [ changed, pixels ] ] as const ) {
			expect( comparePngPixels( encode( 3, 1, left ), encode( 3, 1, right ), {
				allowEdgeRasterization: true,
			} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels } );
		}
	} );

	it.each( [
		{ channel: 0, delta: -3 }, { channel: 0, delta: 3 },
		{ channel: 1, delta: -3 }, { channel: 1, delta: 3 },
		{ channel: 2, delta: -3 }, { channel: 2, delta: 3 },
	] )( 'rejects a $delta level edge change in RGB channel $channel', ( { channel, delta } ) => {
		const pixels = [ 80, 80, 80, 255, 160, 160, 160, 255, 240, 240, 240, 255 ];
		const changed = [ ...pixels ];
		changed[ 4 + channel ] = 160 + delta;
		expect( comparePngPixels( encode( 3, 1, pixels ), encode( 3, 1, changed ), {
			allowEdgeRasterization: true,
		} ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
	} );

	it.each( [
		{ label: 'darker', center: [ 158, 158, 158, 255 ] },
		{ label: 'lighter', center: [ 162, 162, 162, 255 ] },
		{ label: 'mixed', center: [ 158, 162, 158, 255 ] },
	] )( 'accepts simultaneous two-level $label RGB variation on a fixed edge only when opted in', ( { center } ) => {
		const expected = encode( 3, 1, [ 80, 80, 80, 255, 160, 160, 160, 255, 240, 240, 240, 255 ] );
		const actual = encode( 3, 1, [ 80, 80, 80, 255, ...center, 240, 240, 240, 255 ] );
		expect( comparePngPixels( expected, actual ) ).toMatchObject( { differingPixels: 1, toleratedEdgePixels: 0 } );
		expect( comparePngPixels( expected, actual, { allowEdgeRasterization: true } ) ).toMatchObject( {
			differingPixels: 1, toleratedEdgePixels: 1,
		} );
	} );

	it.each( [
		{
			label: 'removing the glyph', differingPixels: 5,
			actual: [
				240, 240, 240, 240, 240,
				240, 240, 240, 240, 240,
				240, 240, 240, 240, 240,
				240, 240, 240, 240, 240,
				240, 240, 240, 240, 240,
			],
		},
		{
			label: 'changing one glyph stroke', differingPixels: 1,
			actual: [
				240, 240, 240, 240, 240,
				240, 240, 80, 80, 240,
				240, 240, 80, 240, 240,
				240, 240, 80, 240, 240,
				240, 240, 240, 240, 240,
			],
		},
		{
			label: 'moving the glyph one pixel right', differingPixels: 6,
			actual: [
				240, 240, 240, 240, 240,
				240, 240, 80, 80, 80,
				240, 240, 240, 80, 240,
				240, 240, 240, 80, 240,
				240, 240, 240, 240, 240,
			],
		},
	] )( 'rejects $label in tiny text', ( { actual, differingPixels } ) => {
		const glyph = [
			240, 240, 240, 240, 240,
			240, 80, 80, 80, 240,
			240, 240, 80, 240, 240,
			240, 240, 80, 240, 240,
			240, 240, 240, 240, 240,
		];
		expect( comparePngPixels(
			encode( 5, 5, glyph.flatMap( ( value ) => [ value, value, value, 255 ] ) ),
			encode( 5, 5, actual.flatMap( ( value ) => [ value, value, value, 255 ] ) ),
			{ allowEdgeRasterization: true },
		) ).toMatchObject( { differingPixels, toleratedEdgePixels: 0 } );
	} );

	it.each( [ -2, 2 ] )( 'rejects a %i level RGB change in a flat fill, locally or across the whole surface', ( delta ) => {
		const pixels = Array.from( { length: 9 }, () => [ 160, 160, 160, 255 ] ).flat();
		const localChange = [ ...pixels ];
		localChange.splice( 16, 3, 160 + delta, 160 + delta, 160 + delta );
		const surfaceChange = Array.from( { length: 9 }, () => [ 160 + delta, 160 + delta, 160 + delta, 255 ] ).flat();
		for ( const [ changed, differingPixels ] of [ [ localChange, 1 ], [ surfaceChange, 9 ] ] as const ) {
			for ( const [ left, right ] of [ [ pixels, changed ], [ changed, pixels ] ] as const ) {
				expect( comparePngPixels( encode( 3, 3, left ), encode( 3, 3, right ), {
					allowEdgeRasterization: true,
				} ) ).toMatchObject( { differingPixels, toleratedEdgePixels: 0 } );
			}
		}
	} );

	it( 'rejects mismatched dimensions with the same area even when the edge allowance is enabled', () => {
		const pixels = Array.from( { length: 6 }, () => [ 160, 160, 160, 255 ] ).flat();
		expect( comparePngPixels( encode( 3, 2, pixels ), encode( 2, 3, pixels ), {
			allowEdgeRasterization: true,
		} ) ).toEqual( {
			expected: { width: 3, height: 2 }, actual: { width: 2, height: 3 },
			differingPixels: 4, toleratedEdgePixels: 0,
		} );
	} );
} );
