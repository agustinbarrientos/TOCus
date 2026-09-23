import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import inventory from '../inventory.json' with { type: 'json' };
import type { OriginalCaptureOptions, OriginalCase, OriginalClip, OriginalSnapshot } from './types';
import { compareScreenshot, ScreenshotColorOptions } from '../../helpers/compare-screenshot';
import { hasFocusedTextCaret } from './focused-text-caret';

/**
 * Exact pre-migration identities, including approved untracked screenshots.
 * @since 1.0.0
 */
export const OriginalSnapshots: readonly OriginalSnapshot[] = inventory;

/**
 * Local server for real React/native production fixtures.
 * @since 1.0.0
 */
export const OriginalFixtureOrigin = 'http://127.0.0.1:4177';

/**
 * Checks the original bytes before and after every screenshot operation.
 * @param path - Exact repository-relative original screenshot path.
 * @return Verified original inventory entry.
 * @since 1.0.0
 */
export function verifyOriginal( path: string ): OriginalSnapshot {
	const entry = OriginalSnapshots.find( ( original ) => original.path === path );
	if ( ! entry ) {
		throw new Error( `Unregistered original snapshot path: ${ path }` );
	}
	const bytes = readFileSync( fileURLToPath( new URL( `../../../../${ path }`, import.meta.url ) ) );
	expect( createHash( 'sha256' ).update( bytes ).digest( 'hex' ), `Original bytes changed: ${ path }` )
		.toBe( entry.sha256 );
	return entry;
}

/**
 * Registers an actual migrated case under its exact original filename and path.
 * @param path - Original screenshot path from the immutable inventory.
 * @param run - Matching viewport, input, state and capture implementation.
 * @since 1.0.0
 */
export function originalCase( path: string, run: OriginalCase ): void {
	test( path, async ( { page }, info ) => {
		expect( info.config.updateSnapshots, 'Original screenshots are immutable; update flags are forbidden.' ).toBe( 'none' );
		verifyOriginal( path );
		try {
			await run( { page }, info );
		} finally {
			verifyOriginal( path );
		}
	} );
}

/**
 * Reproduces Playwright ElementHandle.screenshot's enclosing integer rectangle used by the old runner.
 * The tolerance preserves exact integer edges while enclosing fractional device-independent bounds.
 * @param clip - Actual element bounds measured by the existing closed-shadow fixture bridge.
 * @return Integer capture rectangle, without changing rendered element geometry.
 * @since 1.0.0
 */
export function encloseOriginalClip( clip: OriginalClip ): OriginalClip {
	const epsilon = 1e-3;
	const x = Math.floor( clip.x + epsilon );
	const y = Math.floor( clip.y + epsilon );
	return {
		x, y,
		width: Math.ceil( clip.x + clip.width - epsilon ) - x,
		height: Math.ceil( clip.y + clip.height - epsilon ) - y,
	};
}

/**
 * Compares original framing with the approved library color threshold and preserves raw diagnostics.
 * @param page - Real browser page after original scenario inputs settle.
 * @param path - Exact original screenshot path, including its PNG filename.
 * @param target - Original component capture target; omit for a viewport screenshot.
 * @param options - Optional page clip measured from the original closed-shadow capture target.
 * @return Completion of a strict original comparison, never a baseline write.
 * @since 1.0.0
 */
export async function compareOriginal(
	page: Page, path: string, target?: Locator, options: OriginalCaptureOptions = {},
): Promise<void> {
	expect( test.info().config.updateSnapshots, 'Original screenshots are immutable; update flags are forbidden.' ).toBe( 'none' );
	verifyOriginal( path );
	const captureOptions = options.clip ? { ...options, clip: encloseOriginalClip( options.clip ) } : options;
	try {
		// Do not mutate unfocused fields merely to hide a caret that does not exist.
		const caret = await page.evaluate( hasFocusedTextCaret ) ? 'hide' : 'initial';
		// Archived visualDiff captured the element once. Retrying an oversized capture
		// can change Chromium's paint state, so compare that first image without repainting.
		// Playwright's screenshot operation already waits for document.fonts.ready.
		const actual = target
			? await target.screenshot( { caret } )
			: await page.screenshot( { ...captureOptions, caret } );
		await compareScreenshot( actual, path.split( '/' ), ScreenshotColorOptions );
	} finally {
		verifyOriginal( path );
	}
}

export { expect, test };
