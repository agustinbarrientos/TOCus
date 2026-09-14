import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import { compareScreenshot, WebsiteScreenshotOptions } from './index';

const snapshot = 'website-english-desktop.png';

/**
 * Creates a changed actual image in memory without updating the reviewed reference.
 * @param change - Independent regression mutation applied to decoded reference pixels.
 * @return Encoded actual image passed through the real snapshot assertion.
 */
function changedScreenshot( change: ( image: PNG ) => void ): Buffer {
	const image = PNG.sync.read( readFileSync( test.info().snapshotPath( snapshot ) ) );
	change( image );
	return PNG.sync.write( image );
}

/** @return The exact twelve changed samples recorded in the September 14 CI failure. */
function recordedRasterVariant(): Buffer {
	return changedScreenshot( ( image ) => {
		for ( const [ x, y, red, green, blue ] of [
			[ 889, 351, 74, 61, 53 ], [ 888, 352, 48, 34, 25 ],
			[ 889, 352, 60, 46, 37 ], [ 888, 353, 48, 34, 25 ],
			[ 889, 353, 76, 63, 54 ], [ 888, 354, 48, 34, 25 ],
			[ 889, 354, 97, 85, 76 ], [ 888, 355, 48, 34, 25 ],
			[ 888, 356, 50, 36, 27 ], [ 889, 356, 148, 139, 131 ],
			[ 888, 357, 66, 53, 44 ], [ 889, 357, 184, 176, 169 ],
		] as const ) {
			image.data.set( [ red, green, blue, 255 ], ( y * image.width + x ) * 4 );
		}
	} );
}

test( 'website threshold accepts the recorded CI rounded-edge color variance', async () => {
	await compareScreenshot( recordedRasterVariant(), snapshot, WebsiteScreenshotOptions );
} );

test( 'website threshold still rejects a one-pixel layout shift', async () => {
	const actual = changedScreenshot( ( image ) => {
		const source = Buffer.from( image.data );
		for ( let y = 321; y < 384; y++ ) {
			for ( let x = 549; x < 892; x++ ) {
				const offset = ( y * image.width + x ) * 4;
				image.data.set( source.subarray( offset - 4, offset ), offset );
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, WebsiteScreenshotOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects a changed button fill', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 337; y < 347; y++ ) {
			for ( let x = 580; x < 590; x++ ) {
				image.data.set( [ 68, 54, 45, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, WebsiteScreenshotOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects missing button text', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 340; y < 365; y++ ) {
			for ( let x = 610; x < 820; x++ ) {
				image.data.set( [ 48, 34, 25, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, WebsiteScreenshotOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects changed image dimensions', async () => {
	const actual = changedScreenshot( ( image ) => {
		image.height--;
		image.data = image.data.subarray( 0, image.width * image.height * 4 );
	} );
	await expect( compareScreenshot( actual, snapshot, WebsiteScreenshotOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects a visibly transparent button', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 337; y < 347; y++ ) {
			for ( let x = 580; x < 590; x++ ) {
				image.data[ ( y * image.width + x ) * 4 + 3 ] = 180;
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, WebsiteScreenshotOptions ) ).rejects.toThrow();
} );

test( 'extension comparisons retain their existing strict edge policy', async () => {
	await expect( compareScreenshot( recordedRasterVariant(), snapshot, { allowEdgeRasterization: true } ) )
		.rejects.toThrow();
} );
