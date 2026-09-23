import { release } from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ComponentInterruptionScreen } from '../../../apps/extension/src/features/interruption/components/screen';
import type { VisualAppearance } from './types';
import { captureStableScreenshot } from './capture-stable-screenshot';
import { compareScreenshot, ScreenshotColorOptions } from './compare-screenshot';
import { hasFocusedTextCaret } from '../originals/helpers/focused-text-caret';
import type {} from '../../../apps/extension/src/features/settings/components/shell/__fixtures__/types';
import type {} from '../../../apps/extension/src/features/interruption/components/screen/__fixtures__/browser-types';

/**
 * Local production-fixture server used only during visual comparisons.
 * @since 1.0.0
 */
export const ExtensionOrigin = 'http://127.0.0.1:4177';
/**
 * Local preview of the freshly built Astro output.
 * @since 1.0.0
 */
export const WebsiteOrigin = 'http://127.0.0.1:4178';
/**
 * Existing typed Settings fixture with real production editors.
 * @since 1.0.0
 */
export const SettingsFixture = `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/index.html`;
/**
 * Existing production onboarding and popup mounting fixture.
 * @since 1.0.0
 */
export const PresentationFixture = `${ ExtensionOrigin }/apps/extension/tests/ui/index.html`;
/**
 * Existing production pause adapter with its deterministic test clock.
 * @since 1.0.0
 */
export const PauseFixture = `${ ExtensionOrigin }/apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html`;

test.beforeAll( () => {
	if ( process.platform !== 'darwin' || process.arch !== 'arm64' || ! release().startsWith( '25.' ) ) {
		throw new Error( 'Visual baselines require macOS 26 ARM64 and pinned Chromium. Run the macos-26 CI visual job; do not update these baselines on another platform.' );
	}
} );

/**
 * Applies a visual-test preference through the same document attributes observed by production.
 * @param page - Existing Settings fixture page.
 * @param appearance - Valid product appearance to display.
 * @return Completion after the shared provider observes both attributes.
 * @since 1.0.0
 */
export async function setAppearance( page: Page, appearance: VisualAppearance ): Promise<void> {
	await page.evaluate( ( value ) => {
		window.settingsTest.externalPreferences( { theme: value.theme, palette: value.palette } );
		document.documentElement.setAttribute( 'data-tocus-theme', value.theme );
		document.documentElement.setAttribute( 'data-tocus-palette', value.palette );
	}, appearance );
	await expect( page.locator( '[data-tocus-ui]' ).first() ).toHaveAttribute( 'data-tocus-palette', appearance.palette );
}

/**
 * Freezes the preview on insertion, before its default-running clock can paint an intermediate frame.
 * @param page - Onboarding Language page before the preview mounts.
 * @param showPreview - Real user action that mounts the production Appearance preview.
 * @return Completion after a deterministic still frame renders.
 * @since 1.0.0
 */
export async function freezePreview( page: Page, showPreview: () => Promise<void> ): Promise<void> {
	const observer = await page.evaluateHandle( () => {
		const observer = new MutationObserver( () => {
			const element = document.querySelector<ComponentInterruptionScreen>( 'tocus-f-interruption-screen' );
			if ( ! element ) {
				return;
			}
			observer.disconnect();
			element.progressing = false;
			element.focusedProgressMilliseconds = 0;
			element.reducedMotion = true;
		} );
		observer.observe( document.body, { childList: true, subtree: true } );
		return observer;
	} );
	try {
		await showPreview();
		await page.locator( 'tocus-f-interruption-screen' ).evaluate( async ( element: ComponentInterruptionScreen ) => {
			await element.updateComplete;
			if ( element.progressing || element.focusedProgressMilliseconds !== 0 || ! element.reducedMotion ) {
				throw new Error( 'The regional preview must be frozen at zero before capture.' );
			}
		} );
	} finally {
		await observer.evaluate( ( value ) => {
			value.disconnect();
		} );
		await observer.dispose();
	}
}

/**
 * Waits for packaged fonts and a stable frame, then compares once using the website color threshold.
 * @param page - Fully rendered production fixture or built website page.
 * @param name - Reviewed golden filename.
 * @param fullPage - Whether document content rather than a fixed-position viewport is captured.
 * @return Completion of the strict Playwright screenshot comparison.
 * @since 1.0.0
 */
export async function comparePage( page: Page, name: string, fullPage = true ): Promise<void> {
	await page.evaluate( () => document.fonts.ready );
	const bounds = await page.evaluate( () => ( {
		content: document.documentElement.scrollWidth,
		viewport: window.innerWidth,
	} ) );
	expect( bounds.content, 'Page content must not overflow the screenshot viewport.' ).toBeLessThanOrEqual( bounds.viewport );
	const caret = await page.evaluate( hasFocusedTextCaret ) ? 'hide' : 'initial';
	const style = readFileSync( fileURLToPath( new URL( '../fixture-instrumentation.css', import.meta.url ) ), 'utf8' );
	const actual = await captureStableScreenshot( () => page.screenshot( {
		fullPage, caret, style, animations: 'disabled', scale: 'css', timeout: 15000,
	} ) );
	// Retain the deliberately requested website update command; normal runs never enter this branch.
	if ( test.info().config.updateSnapshots !== 'none' ) {
		expect( actual ).toMatchSnapshot( `${ name }.png`, { threshold: 0, maxDiffPixels: 0 } );
		return;
	}
	await compareScreenshot( actual, `${ name }.png`, ScreenshotColorOptions );
}

export { expect, test };
