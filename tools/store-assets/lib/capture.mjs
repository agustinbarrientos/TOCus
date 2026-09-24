/* global window, document */
import { readFile } from 'node:fs/promises';

const settings = '/apps/extension/src/features/settings/components/shell/__fixtures__/index.html';
const pause = '/apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html';

/**
 * Captures real production components using the existing isolated browser fixtures.
 * @param {import('playwright').Page} page - Fresh browser context, never a user's profile.
 * @param {string} origin - Loopback-only fixture server.
 * @param {object} scene - Ordered screenshot descriptor.
 * @param {string} locale - Production language code.
 * @return {Promise<Buffer>} Current UI pixels, without marketing decoration.
 * @since 1.0.0
 */
export async function captureScene( page, origin, scene, locale ) {
	await page.setViewportSize( { width: 1200, height: 900 } );
	await page.emulateMedia( { reducedMotion: 'reduce', colorScheme: scene.id === 'appearance' ? 'dark' : 'light' } );
	if ( scene.id === 'breathing' ) {
		await page.goto( `${ origin }${ pause }` );
		await page.locator( 'html[data-ready="true"]' ).waitFor();
		await page.evaluate( async ( language ) => {
			const { loadLocalizationBundle } = await import( '/apps/extension/src/localization/index.ts' );
			const bundle = await loadLocalizationBundle( language );
			const screen = window.pauseFixture.screen;
			document.documentElement.lang = bundle.languageTag;
			screen.copy = bundle.interruption;
			screen.progressing = false;
			screen.reducedMotion = false;
			screen.focusedProgressMilliseconds = 3000;
			screen.wellbeingSummary = '';
			screen.reviewPrompt = null;
			await screen.updateComplete;
		}, locale );
	} else {
		const params = new URLSearchParams( { language: locale,
			theme: scene.id === 'appearance' ? 'dark' : 'light',
			palette: scene.id === 'appearance' ? 'blue' : 'brown' } );
		await page.goto( `${ origin }${ settings }?${ params }#${ scene.destination }` );
		await page.locator( 'h1' ).waitFor();
		if ( scene.id === 'websites' ) {
			await page.evaluate( () => {
				window.settingsTest.setFaviconProvider( {
					/**
					 * Resolves bundled logos as simulated browser-cache entries.
					 * @param {string} host - Selected website identity.
					 * @return {string|null} Local image URL.
					 */
					getSource: ( host ) => {
						const icons = { 'instagram.com': 'instagram', 'reddit.com': 'reddit', 'x.com': 'x', 'youtube.com': 'youtube' };
						return icons[ host ] ? `/packages/theme/assets/site-icons/site-${ icons[ host ] }.svg` : null;
					},
				} );
			} );
			for ( const site of [ 'instagram.com', 'reddit.com', 'x.com', 'youtube.com' ] ) {
				await page.locator( '#site-address' ).fill( site );
				await page.locator( '.settings-site-add button' ).click();
				await page.locator( '#site-address' ).filter( { visible: true } ).waitFor();
			}
			await page.locator( '.tocus-form-actions button' ).first().click();
			await page.waitForFunction( () => window.settingsTest.getConfiguration().sites.length === 4 );
			await page.locator( 'img[src$="site-instagram.svg"]' ).waitFor();
		} else if ( scene.id === 'schedule' ) {
			await page.locator( 'input[name="schedule-mode"][value="custom"]' ).check();
			await page.locator( '.settings-schedule-presets button' ).nth( 2 ).click();
		} else if ( scene.id === 'statistics' ) {
			const statistics = JSON.parse( await readFile( new URL( '../assets/statistics.json', import.meta.url ), 'utf8' ) );
			await page.evaluate( ( values ) => window.settingsTest.externalStatistics( values ), statistics );
			await page.locator( '.recharts-wrapper svg' ).waitFor();
			const metrics = await page.locator( '.settings-statistics-lifetime' ).boundingBox();
			await page.setViewportSize( {
				width: 1200, height: Math.max( 900, Math.ceil( metrics.y + metrics.height + 32 ) ),
			} );
		}
	}
	await page.evaluate( async () => {
		await document.fonts.ready;
		await Promise.all( Array.from( document.images, ( image ) => image.decode() ) );
		if ( document.activeElement instanceof window.HTMLElement ) {
			document.activeElement.blur();
		}
		window.scrollTo( 0, 0 );
	} );
	await page.mouse.move( 1199, 899 );
	// Allow the production chart and notifications to settle before freezing animation.
	await page.waitForTimeout( scene.id === 'websites' ? 4500 : 350 );
	return page.screenshot( { animations: 'disabled', caret: 'hide', type: 'png' } );
}
