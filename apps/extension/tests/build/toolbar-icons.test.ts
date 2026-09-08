import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

/**
 * Converts one sRGB channel to linear light for an independent contrast measurement.
 * @param value - Channel value from zero to 255, including alpha-composited fractions.
 * @return Linear channel intensity.
 */
function linearChannel( value: number ): number {
	const channel = value / 255;
	return channel <= 0.04045 ? channel / 12.92 : ( ( channel + 0.055 ) / 1.055 ) ** 2.4;
}

/**
 * Measures relative luminance without importing the icon generator or application color helpers.
 * @param red - Composited red channel.
 * @param green - Composited green channel.
 * @param blue - Composited blue channel.
 * @return Relative luminance from zero to one.
 */
function luminance( red: number, green: number, blue: number ): number {
	return 0.2126 * linearChannel( red ) + 0.7152 * linearChannel( green ) + 0.0722 * linearChannel( blue );
}

test( 'calibrates the independent luminance measurement against known sRGB samples', () => {
	expect( luminance( 0, 0, 0 ) ).toBe( 0 );
	expect( luminance( 255, 255, 255 ) ).toBe( 1 );
	expect( luminance( 128, 128, 128 ) ).toBeCloseTo( 0.2158605001, 8 );
	expect( luminance( 255, 0, 0 ) ).toBe( 0.2126 );
	expect( luminance( 0, 255, 0 ) ).toBe( 0.7152 );
	expect( luminance( 0, 0, 255 ) ).toBe( 0.0722 );
} );

for ( const [ output, action ] of [
	[ 'chrome-mv3', 'action' ],
	[ 'firefox-mv2', 'browser_action' ],
	[ 'safari-mv2', 'browser_action' ],
] as const ) {
	describe( `${ output } toolbar artwork`, () => {
		test.each( [ [ 'light', 255 ], [ 'dark', 59 ] ] as const )(
			'remains visible on a %s browser toolbar at every declared size', async ( appearance, background ) => {
				const directory = new URL( `../../.output/${ output }/`, import.meta.url );
				const manifest = z.record( z.string(), z.unknown() ).parse(
					JSON.parse( await readFile( new URL( 'manifest.json', directory ), 'utf8' ) ),
				);
				const icons = z.object( { default_icon: z.record( z.string(), z.string() ) } )
					.parse( manifest[ action ] ).default_icon;
				expect( Object.keys( icons ).map( Number ) ).toEqual( [ 16, 19, 24, 32, 38, 64 ] );
				const backgroundLuminance = luminance( background, background, background );
				for ( const [ size, path ] of Object.entries( icons ) ) {
					const image = PNG.sync.read( await readFile( new URL( path, directory ) ) );
					expect( image.width, path ).toBe( Number( size ) );
					expect( image.height, path ).toBe( Number( size ) );
					const corners = [
						0, image.width - 1, image.width * ( image.height - 1 ), image.width * image.height - 1,
					];
					expect( corners.some( ( pixel ) => image.data[ pixel * 4 + 3 ] === 0 ),
						`${ path } must retain transparency around the artwork`,
					).toBe( true );
					let solidPixels = 0;
					let contrastingPixels = 0;
					for ( let offset = 0; offset < image.data.length; offset += 4 ) {
						if ( image.data.readUInt8( offset + 3 ) < 240 ) {
							continue;
						}
						solidPixels++;
						const alpha = image.data.readUInt8( offset + 3 ) / 255;
						const backdrop = background * ( 1 - alpha );
						const pixelLuminance = luminance(
							image.data.readUInt8( offset ) * alpha + backdrop,
							image.data.readUInt8( offset + 1 ) * alpha + backdrop,
							image.data.readUInt8( offset + 2 ) * alpha + backdrop,
						);
						const ratio = ( Math.max( pixelLuminance, backgroundLuminance ) + 0.05 )
							/ ( Math.min( pixelLuminance, backgroundLuminance ) + 0.05 );
						if ( ratio >= 3 ) {
							contrastingPixels++;
						}
					}
					expect( solidPixels, `${ path } must contain visible artwork` ).toBeGreaterThan( 0 );
					expect( contrastingPixels / solidPixels,
						`${ path }: at least 20% of solid artwork must reach 3:1 contrast on the ${ appearance } toolbar`,
					).toBeGreaterThanOrEqual( 0.2 );
				}
			},
		);
	} );
}
