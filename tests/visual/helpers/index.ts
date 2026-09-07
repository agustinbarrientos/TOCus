import { release } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ComponentInterruptionScreen } from '../../../apps/extension/src/features/interruption/components/screen';
import type { VisualAppearance } from './types';
import type {} from '../../../apps/extension/src/features/settings/components/shell/__fixtures__/types';
import type {} from '../../../apps/extension/src/features/interruption/components/screen/__fixtures__/browser-types';

/**
 * Local production-fixture server used only during visual comparisons.
 * @since 0.1.0
 */
export const ExtensionOrigin = 'http://127.0.0.1:4177';
/**
 * Local preview of the freshly built Astro output.
 * @since 0.1.0
 */
export const WebsiteOrigin = 'http://127.0.0.1:4178';
/**
 * Existing typed Settings fixture with real production editors.
 * @since 0.1.0
 */
export const SettingsFixture = `${ ExtensionOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/index.html`;
/**
 * Existing production onboarding and popup mounting fixture.
 * @since 0.1.0
 */
export const PresentationFixture = `${ ExtensionOrigin }/apps/extension/tests/ui/index.html`;
/**
 * Existing production pause adapter with its deterministic test clock.
 * @since 0.1.0
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
 * @since 0.1.0
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
 * Freezes only the preview's supported focused-progress projection, retaining its actual Canvas renderer.
 * @param page - Onboarding Appearance page containing the production preview element.
 * @return Completion after a deterministic still frame renders.
 * @since 0.1.0
 */
export async function freezePreview( page: Page ): Promise<void> {
	await page.locator( 'tocus-f-interruption-screen' ).evaluate( async ( element: ComponentInterruptionScreen ) => {
		element.progressing = false;
		element.focusedProgressMilliseconds = 0;
		element.reducedMotion = true;
		await element.updateComplete;
	} );
}

/**
 * Waits for packaged fonts and compares actual pixels, hiding only fixture instrumentation.
 * @param page - Fully rendered production fixture or built website page.
 * @param name - Reviewed golden filename.
 * @param fullPage - Whether document content rather than a fixed-position viewport is captured.
 * @return Completion of the strict Playwright screenshot comparison.
 * @since 0.1.0
 */
export async function comparePage( page: Page, name: string, fullPage = true ): Promise<void> {
	await page.evaluate( () => document.fonts.ready );
	const bounds = await page.evaluate( () => ( {
		content: document.documentElement.scrollWidth,
		viewport: window.innerWidth,
	} ) );
	expect( bounds.content, 'Page content must not overflow the screenshot viewport.' ).toBeLessThanOrEqual( bounds.viewport );
	await expect( page ).toHaveScreenshot( `${ name }.png`, {
		fullPage,
		stylePath: fileURLToPath( new URL( '../fixture-instrumentation.css', import.meta.url ) ),
	} );
}

export { expect, test };
