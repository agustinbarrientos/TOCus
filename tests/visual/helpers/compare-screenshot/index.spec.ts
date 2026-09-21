import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import { compareScreenshot, ScreenshotColorOptions } from './index';
import { RegionalScreenshotColorOptions } from '../compare-regional-page';

// Freeze the historical button so homepage redesigns cannot invalidate these pixel mutations.
const snapshot = 'tests/visual/helpers/compare-screenshot/__fixtures__/website-button.png'.split( '/' );
const extensionSnapshot = 'apps/extension/src/features/statistics/components/settings-screen/__snapshots__/chromium/statistics-settings-screen-unavailable-reset-confirmation-dark.png'.split( '/' );
const regionalSnapshot = 'tests/visual/__snapshots__/chromium-macos26-arm64/onboarding-language-portuguese-portugal.png'.split( '/' );

/**
 * Creates a changed actual image in memory without updating the reviewed reference.
 * @param change - Independent regression mutation applied to decoded reference pixels.
 * @param reference - Repository-relative comparison fixture or reviewed screenshot path.
 * @return Encoded actual image passed through the real snapshot assertion.
 */
function changedScreenshot( change: ( image: PNG ) => void, reference = snapshot ): Buffer {
	const image = PNG.sync.read( readFileSync( test.info().snapshotPath( ...reference ) ) );
	change( image );
	return PNG.sync.write( image );
}

/** @return The exact twelve changed samples recorded in the September 14 CI failure. */
function recordedRasterVariant(): Buffer {
	return changedScreenshot( ( image ) => {
		for ( const [ x, y, red, green, blue ] of [
			[ 345, 35, 74, 61, 53 ], [ 344, 36, 48, 34, 25 ],
			[ 345, 36, 60, 46, 37 ], [ 344, 37, 48, 34, 25 ],
			[ 345, 37, 76, 63, 54 ], [ 344, 38, 48, 34, 25 ],
			[ 345, 38, 97, 85, 76 ], [ 344, 39, 48, 34, 25 ],
			[ 344, 40, 50, 36, 27 ], [ 345, 40, 148, 139, 131 ],
			[ 344, 41, 66, 53, 44 ], [ 345, 41, 184, 176, 169 ],
		] as const ) {
			image.data.set( [ red, green, blue, 255 ], ( y * image.width + x ) * 4 );
		}
	} );
}

test( 'website threshold accepts the recorded CI rounded-edge color variance', async () => {
	await compareScreenshot( recordedRasterVariant(), snapshot, ScreenshotColorOptions );
} );

test( 'website threshold still rejects a one-pixel layout shift', async () => {
	const actual = changedScreenshot( ( image ) => {
		const source = Buffer.from( image.data );
		for ( let y = 5; y < 68; y++ ) {
			for ( let x = 5; x < 348; x++ ) {
				const offset = ( y * image.width + x ) * 4;
				image.data.set( source.subarray( offset - 4, offset ), offset );
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, ScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects a changed button fill', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 21; y < 31; y++ ) {
			for ( let x = 36; x < 46; x++ ) {
				image.data.set( [ 68, 54, 45, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, ScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects missing button text', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 24; y < 49; y++ ) {
			for ( let x = 66; x < 276; x++ ) {
				image.data.set( [ 48, 34, 25, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, ScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects changed image dimensions', async () => {
	const actual = changedScreenshot( ( image ) => {
		image.height--;
		image.data = image.data.subarray( 0, image.width * image.height * 4 );
	} );
	await expect( compareScreenshot( actual, snapshot, ScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'website threshold still rejects a visibly transparent button', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 21; y < 31; y++ ) {
			for ( let x = 36; x < 46; x++ ) {
				image.data[ ( y * image.width + x ) * 4 + 3 ] = 180;
			}
		}
	} );
	await expect( compareScreenshot( actual, snapshot, ScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'extension threshold accepts the recorded CI alert-corner color variance', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( const [ x, y, red, green, blue ] of [
			[ 757, 78, 192, 135, 128 ], [ 758, 78, 148, 104, 99 ],
			[ 759, 78, 98, 73, 69 ], [ 758, 79, 154, 98, 94 ],
			[ 759, 79, 189, 127, 121 ], [ 766, 85, 190, 131, 124 ],
			[ 767, 85, 44, 35, 34 ], [ 767, 86, 96, 71, 68 ],
			[ 766, 87, 156, 99, 95 ], [ 766, 88, 119, 70, 68 ],
		] as const ) {
			image.data.set( [ red, green, blue, 255 ], ( y * image.width + x ) * 4 );
		}
	}, extensionSnapshot );
	await compareScreenshot( actual, extensionSnapshot, ScreenshotColorOptions );
} );

test( 'extension threshold still rejects a changed alert fill', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 90; y < 100; y++ ) {
			for ( let x = 90; x < 100; x++ ) {
				image.data.set( [ 120, 70, 65, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	}, extensionSnapshot );
	await expect( compareScreenshot( actual, extensionSnapshot, ScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'comparisons without the approved threshold remain exact', async () => {
	await expect( compareScreenshot( recordedRasterVariant(), snapshot ) ).rejects.toThrow();
} );

test( 'regional threshold accepts the recorded CI Continue-edge color variance', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( const [ x, y, red, green, blue ] of [
			[ 1176, 780, 125, 79, 62 ], [ 1176, 781, 124, 78, 61 ],
			[ 1189, 794, 115, 66, 48 ], [ 1190, 794, 115, 66, 48 ],
			[ 1287, 794, 116, 67, 48 ], [ 1288, 794, 116, 66, 48 ],
			[ 1289, 794, 131, 87, 70 ], [ 1189, 795, 161, 127, 114 ],
			[ 1190, 795, 122, 76, 59 ], [ 1191, 795, 120, 73, 56 ],
			[ 1192, 795, 115, 66, 47 ], [ 1193, 795, 115, 66, 48 ],
			[ 1194, 795, 116, 67, 48 ], [ 1195, 795, 115, 67, 48 ],
			[ 1196, 795, 115, 66, 48 ], [ 1281, 795, 115, 66, 48 ],
			[ 1282, 795, 115, 67, 48 ], [ 1283, 795, 116, 67, 48 ],
			[ 1284, 795, 116, 66, 48 ], [ 1285, 795, 114, 65, 48 ],
			[ 1286, 795, 120, 72, 55 ], [ 1287, 795, 123, 77, 59 ],
			[ 1288, 795, 162, 128, 114 ], [ 1289, 795, 209, 193, 184 ],
		] as const ) {
			image.data.set( [ red, green, blue, 255 ], ( y * image.width + x ) * 4 );
		}
	}, regionalSnapshot );
	await expect( compareScreenshot( actual, regionalSnapshot, ScreenshotColorOptions ) ).rejects.toThrow();
	await compareScreenshot( actual, regionalSnapshot, RegionalScreenshotColorOptions );
} );

test( 'regional threshold still rejects a one-pixel Continue button shift', async () => {
	const actual = changedScreenshot( ( image ) => {
		const source = Buffer.from( image.data );
		for ( let y = 750; y < 801; y++ ) {
			for ( let x = 1170; x < 1310; x++ ) {
				const offset = ( y * image.width + x ) * 4;
				image.data.set( source.subarray( offset - 4, offset ), offset );
			}
		}
	}, regionalSnapshot );
	await expect( compareScreenshot( actual, regionalSnapshot, RegionalScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'regional threshold still rejects missing Continue text', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 767; y < 783; y++ ) {
			for ( let x = 1201; x < 1277; x++ ) {
				image.data.set( [ 117, 66, 47, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	}, regionalSnapshot );
	await expect( compareScreenshot( actual, regionalSnapshot, RegionalScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'regional threshold still rejects changed image dimensions', async () => {
	const actual = changedScreenshot( ( image ) => {
		image.height--;
		image.data = image.data.subarray( 0, image.width * image.height * 4 );
	}, regionalSnapshot );
	await expect( compareScreenshot( actual, regionalSnapshot, RegionalScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'regional threshold still rejects a changed Continue button fill', async () => {
	const actual = changedScreenshot( ( image ) => {
		for ( let y = 760; y < 766; y++ ) {
			for ( let x = 1210; x < 1220; x++ ) {
				image.data.set( [ 95, 45, 30, 255 ], ( y * image.width + x ) * 4 );
			}
		}
	}, regionalSnapshot );
	await expect( compareScreenshot( actual, regionalSnapshot, RegionalScreenshotColorOptions ) ).rejects.toThrow();
} );

test( 'regional threshold permits no extra pixels beyond its color policy', async () => {
	const actual = changedScreenshot( ( image ) => {
		image.data.set( [ 0, 0, 0, 255 ], ( 740 * image.width + 1200 ) * 4 );
	}, regionalSnapshot );
	await expect( compareScreenshot( actual, regionalSnapshot, RegionalScreenshotColorOptions ) ).rejects.toThrow();
} );
