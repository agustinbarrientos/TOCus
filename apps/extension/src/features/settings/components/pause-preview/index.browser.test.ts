import { expect } from '@playwright/test';
import { Language, Palette, PauseMode, ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'Settings breathing preview', () => {
	test( 'renders applied shortcut drafts in order and reverses them on Discard without saving', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		const preview = page.locator( '.settings-pause-preview' );
		await expect( preview ).toBeVisible();
		const links = preview.locator( '.focus-link-button' );
		const initial = await page.evaluate( () => window.settingsTest.getStatistics() );
		for ( const label of [ 'Read', 'Write' ] ) {
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
			const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
			await dialog.getByLabel( 'Label', { exact: true } ).fill( label );
			await dialog.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
			await expect( links ).toHaveCount( label === 'Read' ? 0 : 1 );
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		}
		await expect( links ).toHaveText( [ 'Read', 'Write' ] );
		await page.locator( '.settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Move up', exact: true } ).click();
		await expect( links ).toHaveText( [ 'Write', 'Read' ] );
		await page.locator( '.settings-site-item' ).first().getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		const editor = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Cancelled edit' );
		await editor.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( links ).toHaveText( [ 'Write', 'Read' ] );
		await page.locator( '.settings-site-item' ).first().getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Plan' );
		await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( links ).toHaveText( [ 'Plan', 'Read' ] );
		await page.locator( '.settings-site-item' ).first().getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( links ).toHaveText( [ 'Read' ] );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( links ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.getPreferences().focusLinks ) ).toEqual( [] );
		expect( await page.evaluate( () => window.settingsTest.getStatistics() ) ).toEqual( initial );
		expect( await page.evaluate( () =>
			[ window.settingsTest.controls.writes, window.settingsTest.controls.requests ] ) ).toEqual( [ 0, 0 ] );
	} );

	test( 'shows unsaved appearance, pause mode, external shortcuts and reduced motion in the real renderer', async ( { page, open } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await open( SettingsDestination.APPEARANCE );
		const preview = page.locator( '.settings-pause-preview' );
		await expect( preview.locator( 'canvas' ) ).toBeVisible();
		await page.getByRole( 'radio', { name: 'Dark', exact: true } ).click();
		await page.getByRole( 'radio', { name: 'Purple', exact: true } ).click();
		await expect( preview ).toHaveAttribute( 'data-tocus-theme', 'dark' );
		await expect( preview ).toHaveAttribute( 'data-tocus-palette', 'purple' );
		await expect.poll( () => preview.locator( 'tocus-f-interruption-screen' ).evaluate( ( screen ) =>
			( screen as HTMLElementTagNameMap['tocus-f-interruption-screen'] ).reducedMotion ) ).toBe( true );
		await page.locator( 'input[value="quiet"]' ).check();
		await expect( preview.locator( '.cue' ) ).toHaveText( 'Take a moment' );
		await expect.poll( () => preview.locator( 'tocus-f-interruption-screen' ).evaluate( ( screen ) =>
			( screen as HTMLElementTagNameMap['tocus-f-interruption-screen'] ).mode ) ).toBe( 'quiet' );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [
				{ id: 'focus_link_read', label: 'Read', url: 'https://example.com/' },
			] } );
		} );
		await expect( preview.locator( '.focus-link-button' ) ).toHaveText( [ 'Read' ] );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( preview ).toHaveAttribute( 'data-tocus-theme', 'light' );
		await expect( preview ).toHaveAttribute( 'data-tocus-palette', 'brown' );
		await expect( preview.locator( 'canvas' ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

	for ( const destination of [ SettingsDestination.APPEARANCE, SettingsDestination.FOCUS_LINKS ] ) {
		test( `keeps ${ destination } controls clear of the preview across screen sizes`, async ( { open } ) => {
			const page = await open( destination );
			const preview = page.locator( '.settings-pause-preview' );
			const form = page.locator( 'main form' );
			for ( const viewport of [ { width: 1280, height: 900 }, { width: 320, height: 900 },
				{ width: 1280, height: 400 } ] ) {
				await page.setViewportSize( viewport );
				await expect( preview ).toBeVisible();
				const bounds = await preview.boundingBox();
				const controls = await form.boundingBox();
				if ( ! bounds || ! controls ) {
					throw new Error( 'Expected the preference form and its contained preview.' );
				}
				if ( viewport.width >= 1280 && viewport.height >= 900 ) {
					expect( bounds.x ).toBeGreaterThanOrEqual( controls.x + controls.width + 24 );
					expect( bounds.y + bounds.height ).toBeLessThanOrEqual( viewport.height );
					expect( bounds.y ).toBeGreaterThan( viewport.height / 2 );
				} else {
					expect( bounds.y ).toBeGreaterThanOrEqual( controls.y + controls.height + 24 );
				}
				expect( await page.evaluate( () => document.documentElement.scrollWidth ) ).toBe( viewport.width );
				await page.screenshot( { path: test.info().outputPath(
					`${ destination }-${ String( viewport.width ) }-${ String( viewport.height ) }.png`,
				), fullPage: true } );
			}
			await expect( preview.locator( '[aria-hidden="true"][inert]' ) ).toHaveCount( 1 );
			await page.getByRole( 'heading', { level: 1 } ).focus();
			for ( let step = 0; step < 14; step++ ) {
				await page.keyboard.press( 'Tab' );
				expect( await preview.evaluate( ( element ) =>
					element.contains( document.activeElement ) ) ).toBe( false );
			}
		} );
	}

	test( 'keeps the preview artwork unchanged with zero, one or three long shortcuts', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		const preview = page.locator( '.settings-pause-preview' );
		for ( const width of [ 1280, 320 ] ) {
			await page.setViewportSize( { width, height: 900 } );
			const sizes = [];
			for ( const count of [ 0, 1, 3 ] ) {
				await page.evaluate( ( count ) => {
					window.settingsTest.externalPreferences( { focusLinks: [
						{ id: 'focus_link_read', label: 'R'.repeat( 64 ), url: 'https://example.com/read' },
						{ id: 'focus_link_write', label: 'W'.repeat( 64 ), url: 'https://example.com/write' },
						{ id: 'focus_link_plan', label: 'P'.repeat( 64 ), url: 'https://example.com/plan' },
					].slice( 0, count ) } );
				}, count );
				await expect( preview.locator( '.focus-link-button' ) ).toHaveCount( count );
				const geometry = await preview.evaluate( async ( element ) => {
					await new Promise( requestAnimationFrame );
					const root = element.querySelector( 'tocus-f-interruption-screen' )?.shadowRoot;
					const canvas = root?.querySelector( 'tocus-f-breathing-sphere' )?.shadowRoot
						?.querySelector( 'canvas' )?.getBoundingClientRect();
					const viewport = element.querySelector( '.settings-pause-preview-viewport' )?.getBoundingClientRect();
					const cue = root?.querySelector( '.cue' )?.getBoundingClientRect();
					if ( ! canvas || ! viewport || ! cue ) {
						throw new Error( 'Expected a contained preview drawing surface.' );
					}
					return { width: canvas.width, height: canvas.height,
						artworkTop: canvas.top, artworkBottom: canvas.bottom, cueBottom: cue.bottom,
						viewportBottom: viewport.bottom,
						buttons: [ ...root?.querySelectorAll( '.focus-link-button' ) ?? [] ].map( ( button ) => {
							const bounds = button.getBoundingClientRect();
							const label = button.querySelector<HTMLElement>( '.focus-link-label' );
							if ( ! label ) {
								throw new Error( 'Expected the complete preview shortcut label.' );
							}
							const labelBounds = label.getBoundingClientRect();
							return { top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height,
								clientHeight: button.clientHeight, scrollHeight: button.scrollHeight,
								label: { top: labelBounds.top, bottom: labelBounds.bottom,
									clientHeight: label.clientHeight, scrollHeight: label.scrollHeight,
									clientWidth: label.clientWidth, scrollWidth: label.scrollWidth } };
						} ) };
				} );
				expect( geometry.height ).toBeGreaterThan( 0 );
				expect( geometry.cueBottom ).toBeLessThanOrEqual( geometry.artworkTop );
				for ( const button of geometry.buttons ) {
					expect( button.width ).toBeGreaterThan( button.height );
					expect( button.top ).toBeGreaterThanOrEqual( geometry.artworkBottom );
					expect( button.bottom ).toBeLessThanOrEqual( geometry.viewportBottom );
					expect( button.scrollHeight ).toBeLessThanOrEqual( button.clientHeight );
					expect( button.label.top ).toBeGreaterThanOrEqual( button.top );
					expect( button.label.bottom ).toBeLessThanOrEqual( button.bottom );
					expect( button.label.scrollHeight ).toBeLessThanOrEqual( button.label.clientHeight );
					expect( button.label.scrollWidth ).toBeLessThanOrEqual( button.label.clientWidth );
				}
				sizes.push( { width: geometry.width, height: geometry.height } );
			}
			expect( sizes[ 1 ] ).toEqual( sizes[ 0 ] );
			expect( sizes[ 2 ] ).toEqual( sizes[ 0 ] );
		}
	} );

	test( 'removes the preview on recovery and other destinations and keeps localized pause copy', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS, Language.GERMAN );
		const preview = page.locator( '.settings-pause-preview' );
		await expect( preview ).toBeVisible();
		await expect( preview.locator( '.cue' ) ).not.toHaveText( /Breathe/u );
		await page.evaluate( ( update ) => {
			window.settingsTest.externalPreferences( update );
		}, { theme: ThemeMode.DARK, palette: Palette.GREEN, pauseMode: PauseMode.QUIET } );
		await expect( preview ).toHaveAttribute( 'data-tocus-theme', 'dark' );
		await expect.poll( () => preview.locator( 'tocus-f-interruption-screen' ).evaluate( ( screen ) =>
			( screen as HTMLElementTagNameMap['tocus-f-interruption-screen'] ).mode ) ).toBe( 'quiet' );
		await page.evaluate( () => {
			window.settingsTest.malformPreferences();
		} );
		await expect( preview ).toHaveCount( 0 );
		await page.locator( 'a[href="#language"]' ).click();
		await expect( preview ).toHaveCount( 0 );
	} );
} );
