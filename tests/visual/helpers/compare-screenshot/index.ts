import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { comparePngPixels } from '../../originals/helpers/compare-png';
import type { ScreenshotComparisonOptions } from './types';

/**
 * Shared original-extension and website color allowance, with no changed-pixel budget.
 * @since 0.1.0
 */
export const ScreenshotColorOptions = { threshold: 0.01 } as const;

/**
 * Compares untouched screenshots with Playwright's selected perceived-color policy.
 * @param actual - Unmodified captured PNG, never a rewritten or masked image.
 * @param name - Reviewed snapshot name or original path segments.
 * @param options - Explicit opt-in to a perceived-color threshold; otherwise exact RGBA.
 * @return Completion of one baseline comparison, with untouched failure diagnostics.
 * @since 0.1.0
 */
export async function compareScreenshot(
	actual: Buffer, name: string | string[], options: ScreenshotComparisonOptions = {},
): Promise<void> {
	const { threshold = 0 } = options;
	const info = test.info();
	expect( info.config.updateSnapshots, 'Reviewed screenshots cannot be updated during comparison.' ).toBe( 'none' );
	const segments = typeof name === 'string' ? [ name ] : name;
	const expected = readFileSync( info.snapshotPath( ...segments ) );
	const comparison = comparePngPixels( expected, actual );
	if ( comparison.differingPixels > 0 ) {
		await Promise.all( [
			info.attach( 'exact-rgba-expected', { body: expected, contentType: 'image/png' } ),
			info.attach( 'exact-rgba-actual', { body: actual, contentType: 'image/png' } ),
			info.attach( 'exact-rgba-comparison', {
				body: JSON.stringify( { ...comparison, threshold } ), contentType: 'application/json',
			} ),
		] );
	}
	// The library owns color and antialiasing comparison; no additional differing pixels are allowed.
	expect( actual ).toMatchSnapshot( name, { threshold, maxDiffPixels: 0 } );
	if ( threshold > 0 ) {
		return;
	}
	expect( comparison.differingPixels,
		`RGBA comparison: ${ String( comparison.differingPixels ) } differing pixels, `
		+ `expected ${ String( comparison.expected.width ) }x${ String( comparison.expected.height ) }, `
		+ `actual ${ String( comparison.actual.width ) }x${ String( comparison.actual.height ) }.`,
	).toBe( 0 );
}
