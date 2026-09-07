import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { comparePngPixels } from '../../originals/helpers/compare-png';
import { hasFocusedTextCaret } from '../../originals/helpers/focused-text-caret';

/**
 * Captures a regional onboarding flow once, retaining the original named supplemental path.
 * @remarks These full-flow captures supplement, never replace, the immutable pre-migration inventory.
 * Only an explicit update run may refresh them after reviewing the captured production layout.
 * @param page - Production onboarding mounted through its normal presentation service.
 * @param name - Existing regional screenshot filename without the extension.
 * @param fullPage - Whether to include content below the viewport.
 * @return Completion after both the supported matcher and exact RGBA comparison.
 * @since 0.1.0
 */
export async function compareRegionalPage( page: Page, name: string, fullPage = true ): Promise<void> {
	const info = test.info();
	expect( info.project.name ).toBe( 'chromium-onboarding' );
	const bounds = await page.evaluate( () => ( {
		content: document.documentElement.scrollWidth, viewport: window.innerWidth,
	} ) );
	expect( bounds.content, 'Onboarding must not overflow the viewport horizontally.' ).toBeLessThanOrEqual( bounds.viewport );
	const caret = await page.evaluate( hasFocusedTextCaret ) ? 'hide' : 'initial';
	const actual = await page.screenshot( {
		fullPage, caret, animations: 'disabled',
		style: readFileSync( fileURLToPath( new URL( '../../fixture-instrumentation.css', import.meta.url ) ), 'utf8' ),
	} );
	// Soft assertions preserve every state in the real Language → Appearance → Websites flow.
	// They do not retry captures or permit a failing comparison to pass.
	expect.soft( actual ).toMatchSnapshot( `${ name }.png`, { threshold: 0, maxDiffPixels: 0 } );
	const expected = readFileSync( info.snapshotPath( `${ name }.png` ) );
	const comparison = comparePngPixels( expected, actual );
	if ( comparison.differingPixels > 0 ) {
		await Promise.all( [
			info.attach( `${ name }-rgba-expected`, { body: expected, contentType: 'image/png' } ),
			info.attach( `${ name }-rgba-actual`, { body: actual, contentType: 'image/png' } ),
			info.attach( `${ name }-rgba-comparison`, {
				body: JSON.stringify( comparison ), contentType: 'application/json',
			} ),
		] );
	}
	expect.soft( comparison.differingPixels, `Exact RGBA mismatch: ${ name }` ).toBe( 0 );
}
