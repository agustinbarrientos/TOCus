import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { createSettingsBrowserHarness } from '../../utils/browser-test-harness';

describe.each( [
	[ 'Chromium', chromium ],
	[ 'Firefox', firefox ],
	[ 'WebKit', webkit ],
] as const )( '%s React settings', ( _name, engine ) => {
	const { open, setting } = createSettingsBrowserHarness( engine );

	it( 'preserves the approved edge navigation and spacious page composition', async () => {
		const page = await open( SettingsDestination.APPEARANCE );
		await page.setViewportSize( { width: 1280, height: 1200 } );
		const navigation = await page.locator( '.settings-navigation' ).boundingBox();
		const main = await page.getByRole( 'main' ).boundingBox();
		expect( navigation?.x ).toBe( 0 );
		expect( navigation?.width ).toBe( 264 );
		expect( main?.x ).toBe( 328 );
		expect( main?.width ).toBe( 888 );
		expect( await page.locator( '.tocus-page-header' ).textContent() ).toContain( 'Personalization' );
		await page.close();
	} );

	it( 'saves keyboard timing, preserves rejection, and discards without writes', async () => {
		const page = await open();
		const slider = page.getByRole( 'slider' ).first();
		await slider.focus();
		await page.keyboard.press( 'End' );
		expect( await slider.getAttribute( 'aria-valuenow' ) ).toBe( '30' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByRole( 'alert' ).waitFor();
		expect( await slider.getAttribute( 'aria-valuenow' ) ).toBe( '30' );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		expect( await slider.getAttribute( 'aria-valuenow' ) ).toBe( '10' );
		await expect.poll( () => slider.evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
		await setting( page, 'rejectSaves', false );
		await slider.focus();
		await page.keyboard.press( 'ArrowRight' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.locator( '.mantine-Alert-root[role="status"]' ).waitFor();
		await expect.poll( () => slider.evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
		const initialWait = await page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration.initialWaitMilliseconds );
		expect( initialWait ).toBe( 15000 );
		await page.close();
	}, 20000 );
	it( 'guards clicked and back/forward navigation while preserving the draft', async () => {
		const page = await open( SettingsDestination.ABOUT );
		await page.getByRole( 'link', { name: 'Pause timing', exact: true } ).click();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'dialog' ).waitFor();
		await page.getByRole( 'button', { name: 'Stay', exact: true } ).click();
		expect( await page.getByRole( 'slider' ).first().getAttribute( 'aria-valuenow' ) ).toBe( '30' );
		await page.evaluate( () => {
			history.back();
		} );
		await page.getByRole( 'dialog' ).waitFor();
		await expect.poll( () => page.evaluate( () => location.hash ) ).toBe( '#timing' );
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => location.hash ) ).toBe( '#about' );
		await page.evaluate( () => {
			history.forward();
		} );
		await page.getByRole( 'slider' ).first().waitFor();
		expect( await page.getByRole( 'slider' ).first().getAttribute( 'aria-valuenow' ) ).toBe( '10' );
		await page.close();
	}, 20000 );
	it( 'previews preferences, merges external fields and restores them on discard', async () => {
		const page = await open( SettingsDestination.APPEARANCE );
		await page.getByRole( 'radio', { name: 'Dark', exact: true } ).click();
		await expect.poll( () => page.locator( 'html' ).getAttribute( 'data-tocus-theme' ) ).toBe( ThemeMode.DARK );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { palette: window.settingsTest.palettes.BLUE } );
		} );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect.poll( () => page.locator( 'html' ).getAttribute( 'data-tocus-theme' ) ).toBe( ThemeMode.LIGHT );
		expect( await page.locator( 'html' ).getAttribute( 'data-tocus-palette' ) ).toBe( Palette.BLUE );
		await page.close();
	}, 20000 );
	it( 'keeps denied website drafts and requests browser access from Save', async () => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		const input = page.locator( '#site-address' );
		await input.fill( 'example.com' );
		await setting( page, 'denyAccess', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByRole( 'alert' ).waitFor();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 0 );
		await setting( page, 'denyAccess', false );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 1 );
		expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
		await page.evaluate( () => window.settingsTest.revoke() );
		await page.getByRole( 'button', { name: 'Allow access', exact: true } ).click();
		await expect.poll( () => page.getByRole( 'button', { name: 'Allow access', exact: true } ).count() ).toBe( 0 );
		await page.close();
	}, 20000 );
	it( 'renders every destination at one width and keeps read-only pages free of Save', async () => {
		const page = await open( SettingsDestination.ABOUT );
		for ( const destination of [ 'About', 'Privacy and local data', 'Statistics', 'Language', 'Appearance', 'Pause timing', 'Schedule', 'Websites' ] ) {
			await page.getByRole( 'link', { name: destination, exact: true } ).click();
			await page.getByRole( 'heading', { level: 1 } ).waitFor();
			expect( await page.locator( '.settings-content' ).evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBeGreaterThan( 500 );
			if ( [ 'About', 'Privacy and local data', 'Statistics' ].includes( destination ) ) {
				expect( await page.getByRole( 'button', { name: 'Save', exact: true } ).count() ).toBe( 0 );
			}
		}
		await page.setViewportSize( { width: 390, height: 844 } );
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		await page.close();
	}, 20000 );
	it( 'covers a tall narrow viewport on every destination without horizontal overflow', async () => {
		const page = await open( SettingsDestination.TIMING );
		await page.setViewportSize( { width: 390, height: 1200 } );
		for ( const destination of Object.values( SettingsDestination ) ) {
			await page.locator( `nav a[href="#${ destination }"]` ).click();
			await expect.poll( () => page.evaluate( () => location.hash ) ).toBe( `#${ destination }` );
			const geometry = await page.locator( '.settings-layout' ).evaluate( ( element ) => ( {
				bottom: element.getBoundingClientRect().bottom,
				viewportHeight: innerHeight,
				viewportWidth: innerWidth,
				pageWidth: document.documentElement.scrollWidth,
			} ) );
			expect( geometry.bottom, destination ).toBeGreaterThanOrEqual( geometry.viewportHeight );
			expect( geometry.pageWidth, destination ).toBeLessThanOrEqual( geometry.viewportWidth );
		}
		await page.close();
	} );
} );
