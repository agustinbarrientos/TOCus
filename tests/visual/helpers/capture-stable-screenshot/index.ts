import { expect } from '@playwright/test';
import { comparePngPixels } from '../../originals/helpers/compare-png';
import type { ScreenshotCapture } from './types';

/**
 * Uses Playwright polling to require two consecutive, exactly equal decoded captures before consulting any baseline.
 * @param capture - Fresh browser screenshot operation.
 * @param timeoutMilliseconds - Maximum duration of the stabilization check.
 * @return The settled frame, without reading or changing a reference image.
 * @since 1.0.0
 */
export async function captureStableScreenshot(
	capture: ScreenshotCapture, timeoutMilliseconds = 15000,
): Promise<Buffer> {
	let actual: Buffer = Buffer.alloc( 0 );
	await expect.poll( async () => {
		const previous = actual;
		actual = await capture();
		return previous.length > 0 && comparePngPixels( previous, actual ).differingPixels === 0;
	}, {
		timeout: timeoutMilliseconds,
		message: 'Screenshots must settle before comparison with the reference image.',
	} ).toBe( true );
	return actual;
}
