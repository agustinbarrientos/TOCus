import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { comparePngPixels } from '../../originals/helpers/compare-png';
import type { ScreenshotComparisonOptions } from './types';

/**
 * Website-only perceived-color allowance; every pixel beyond it still fails.
 * @since 0.1.0
 */
export const WebsiteScreenshotOptions = { threshold: 0.01 } as const;

/**
 * Compares untouched screenshots with the selected strict-edge or perceived-color policy.
 * @param actual - Unmodified captured PNG, never a rewritten or masked image.
 * @param name - Reviewed snapshot name or original path segments.
 * @param options - Explicit opt-in to an edge allowance or perceived-color threshold; otherwise exact.
 * @return Completion of one baseline comparison, with untouched failure diagnostics.
 * @since 0.1.0
 */
export async function compareScreenshot(
	actual: Buffer, name: string | string[], options: ScreenshotComparisonOptions = {},
): Promise<void> {
	const { threshold = 0, ...pixelOptions } = options;
	const info = test.info();
	expect( info.config.updateSnapshots, 'Reviewed screenshots cannot be updated during comparison.' ).toBe( 'none' );
	const segments = typeof name === 'string' ? [ name ] : name;
	const expected = readFileSync( info.snapshotPath( ...segments ) );
	const comparison = comparePngPixels( expected, actual, pixelOptions );
	const rejectedPixels = comparison.differingPixels - comparison.toleratedEdgePixels;
	if ( comparison.differingPixels > 0 ) {
		await Promise.all( [
			info.attach( 'exact-rgba-expected', { body: expected, contentType: 'image/png' } ),
			info.attach( 'exact-rgba-actual', { body: actual, contentType: 'image/png' } ),
			info.attach( 'exact-rgba-comparison', {
				body: JSON.stringify( { ...comparison, threshold } ), contentType: 'application/json',
			} ),
		] );
	}
	// Perceived-color comparisons have no pixel budget; strict comparisons retain their independent edge guard.
	expect( actual ).toMatchSnapshot( name, {
		threshold, maxDiffPixels: threshold === 0 && rejectedPixels === 0 ? comparison.toleratedEdgePixels : 0,
	} );
	if ( threshold > 0 ) {
		return;
	}
	expect( rejectedPixels,
		`RGBA comparison: ${ String( comparison.differingPixels ) } differing pixels, `
		+ `${ String( comparison.toleratedEdgePixels ) } approved edge pixels; `
		+ `expected ${ String( comparison.expected.width ) }x${ String( comparison.expected.height ) }, `
		+ `actual ${ String( comparison.actual.width ) }x${ String( comparison.actual.height ) }.`,
	).toBe( 0 );
}
