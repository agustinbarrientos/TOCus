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
