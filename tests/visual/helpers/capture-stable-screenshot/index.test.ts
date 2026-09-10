import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { captureStableScreenshot } from './index';

/**
 * Creates a literal opaque frame without any snapshot file or comparator-derived expectation.
 * @param red - Red channel value of the single pixel.
 * @param level - PNG compression level, which must not affect stability.
 * @return Encoded one-pixel frame.
 */
function frame( red: number, level = 9 ): Buffer {
	const image = new PNG( { width: 1, height: 1 } );
	image.data = Buffer.from( [ red, 80, 120, 255 ] );
	return PNG.sync.write( image, { deflateLevel: level } );
}

describe( 'baseline-independent screenshot stability', () => {
	it( 'waits for consecutive equal frames instead of accepting the first capture', async () => {
		const frames = [ frame( 10 ), frame( 20 ), frame( 20 ), frame( 30 ) ];
		let captured = 0;
		const actual = await captureStableScreenshot( () => Promise.resolve( frames[ captured++ ] ?? frame( 255 ) ) );
		expect( actual ).toEqual( frame( 20 ) );
		expect( captured ).toBe( 3 );
	} );

	it( 'requires consecutive equality, not a previously seen frame', async () => {
		const frames = [ frame( 10 ), frame( 20 ), frame( 10 ), frame( 30 ), frame( 30 ) ];
		let captured = 0;
		expect( await captureStableScreenshot( () => Promise.resolve( frames[ captured++ ] ?? frame( 255 ) ) ) )
			.toEqual( frame( 30 ) );
		expect( captured ).toBe( 5 );
	} );

	it( 'compares decoded pixels rather than PNG compression', async () => {
		const frames = [ frame( 10, 0 ), frame( 10, 9 ) ];
		let captured = 0;
		expect( await captureStableScreenshot( () => Promise.resolve( frames[ captured++ ] ?? frame( 255 ) ) ) )
			.toEqual( frames[ 1 ] );
		expect( captured ).toBe( 2 );
	} );

	it( 'fails if captures never settle within the existing deadline', async () => {
		let captured = 0;
		await expect( captureStableScreenshot( () => Promise.resolve( frame( captured++ % 2 ) ), 50 ) )
			.rejects.toThrow();
	} );

	it( 'propagates a failed capture without retrying it', async () => {
		let captured = 0;
		await expect( captureStableScreenshot( () => {
			captured++;
			return Promise.reject( new Error( 'Browser closed' ) );
		} ) ).rejects.toThrow( 'Browser closed' );
		expect( captured ).toBe( 1 );
	} );
} );
