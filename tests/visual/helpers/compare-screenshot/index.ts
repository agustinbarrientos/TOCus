import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { comparePngPixels } from '../../originals/helpers/compare-png';
import type { PngComparisonOptions } from '../../originals/helpers/compare-png/types';

/**
 * Applies the decoded-pixel guard before granting Playwright only the independently verified edge count.
 * @param actual - Unmodified captured PNG, never a rewritten or masked image.
 * @param name - Reviewed snapshot name or original path segments.
 * @param options - Explicit opt-in to the shared bounded edge policy; otherwise exact.
 * @return Completion of one baseline comparison, with untouched failure diagnostics.
 * @since 0.1.0
 */
export async function compareScreenshot(
	actual: Buffer, name: string | string[], options: PngComparisonOptions = {},
): Promise<void> {
	const info = test.info();
	expect( info.config.updateSnapshots, 'Reviewed screenshots cannot be updated during comparison.' ).toBe( 'none' );
	const segments = typeof name === 'string' ? [ name ] : name;
	const expected = readFileSync( info.snapshotPath( ...segments ) );
	const comparison = comparePngPixels( expected, actual, options );
	const rejectedPixels = comparison.differingPixels - comparison.toleratedEdgePixels;
	if ( comparison.differingPixels > 0 ) {
		await Promise.all( [
			info.attach( 'exact-rgba-expected', { body: expected, contentType: 'image/png' } ),
			info.attach( 'exact-rgba-actual', { body: actual, contentType: 'image/png' } ),
			info.attach( 'exact-rgba-comparison', {
				body: JSON.stringify( comparison ), contentType: 'application/json',
			} ),
		] );
	}
	// A fixed pixel budget could conceal unrelated changes. Only independently accepted samples qualify.
	expect( actual ).toMatchSnapshot( name, {
		threshold: 0, maxDiffPixels: rejectedPixels === 0 ? comparison.toleratedEdgePixels : 0,
	} );
	expect( rejectedPixels,
		`RGBA comparison: ${ String( comparison.differingPixels ) } differing pixels, `
		+ `${ String( comparison.toleratedEdgePixels ) } approved edge pixels; `
		+ `expected ${ String( comparison.expected.width ) }x${ String( comparison.expected.height ) }, `
		+ `actual ${ String( comparison.actual.width ) }x${ String( comparison.actual.height ) }.`,
	).toBe( 0 );
}
