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
		{ label: 'two RGB levels', channel: 0, value: 162 },
		{ label: 'an alpha change', channel: 3, value: 254 },
	] )( 'rejects $label even at an edge', ( { channel, value } ) => {
		const changed = [ ...edge ];
		changed[ 16 + channel ] = value;
		expect( comparePngPixels( encode( 3, 3, edge ), encode( 3, 3, changed ), {
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
