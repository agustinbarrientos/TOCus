import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { ThemeMode, Palette } from '../../../../domains/preferences/types';
import { BrowserPaletteLabels, BrowserThemeLabels } from '../../types/__fixtures__/browser-labels';
import { test } from '../../../settings/utils/browser-test-harness';
import type {} from '../../../../../../../tests/visual/originals/presentation/types';

test.describe( 'shared appearance controls', () => {
	test( 'keeps optional palette help between the label and choices with one gap on each side', async ( { page } ) => {
		await page.goto( '/tests/visual/originals/presentation/?scenario=appearance' );
		await expect( page.locator( '.preferences-palette-options' ) ).toBeVisible();
		await page.evaluate( () => {
			const copy = window.onboardingOriginal.copy;
			if ( ! copy ) {
				throw new Error( 'Expected initialized onboarding copy.' );
			}
			window.onboardingOriginal.copy = { ...copy, appearance: { ...copy.appearance, paletteHelp: 'Choose a color.' } };
		} );
		const description = page.getByText( 'Choose a color.', { exact: true } );
		await expect( description ).toBeVisible();
		expect( await description.evaluate( ( element ) => {
			const label = element.previousElementSibling;
			const options = element.parentElement?.querySelector( '.preferences-palette-options' );
			if ( ! label || ! options ) {
				throw new Error( 'Expected the palette label and choices.' );
			}
			return [ element.getBoundingClientRect().top - label.getBoundingClientRect().bottom,
				options.getBoundingClientRect().top - element.getBoundingClientRect().bottom ];
		} ) ).toEqual( [ expect.closeTo( 8, 2 ), expect.closeTo( 8, 2 ) ] );
	} );
	test( 'keeps a single field gap below onboarding language and regional labels', async ( { page } ) => {
		await page.goto( '/tests/visual/originals/presentation/?scenario=language' );
		await page.getByRole( 'radio', { name: 'Espa\u00f1ol', exact: true } ).click();
		await expect( page.locator( '.preferences-language-section-label' ) ).toHaveCount( 2 );
		const gaps = await page.locator( '.preferences-language-options' ).evaluateAll( ( options ) => options.map( ( element ) => {
			const label = element.parentElement?.parentElement?.querySelector( '.preferences-language-section-label' );
			if ( ! label ) {
				throw new Error( 'Expected the language group label.' );
			}
			return element.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
		} ) );
		expect( gaps ).toEqual( [ 8, 8 ] );
	} );
	for ( const surface of [ 'settings', 'onboarding' ] ) {
		test( `keeps a single field gap below appearance labels in ${ surface }`, async ( { open, page } ) => {
			if ( surface === 'settings' ) {
				await open( SettingsDestination.APPEARANCE );
			} else {
				await page.goto( '/tests/visual/originals/presentation/?scenario=appearance' );
			}
			await expect( page.locator( '.preferences-theme-options' ) ).toBeVisible();
			const metrics = await page.locator( '.preferences-appearance-controls' ).evaluate( ( element ) => {
				const labels = element.querySelectorAll( '.preferences-section-label' );
				const theme = element.querySelector( '.preferences-theme-options' );
				const palette = element.querySelector( '.preferences-palette-options' );
				if ( ! labels[ 0 ] || ! labels[ 1 ] || ! theme || ! palette ) {
					throw new Error( 'Expected labeled theme and palette choices.' );
				}
				return {
					theme: theme.getBoundingClientRect().top - labels[ 0 ].getBoundingClientRect().bottom,
					palette: palette.getBoundingClientRect().top - labels[ 1 ].getBoundingClientRect().bottom,
				};
			} );
			expect( metrics ).toEqual( { theme: 8, palette: 8 } );
		} );
	}
	test( 'uses padded preview focus and neutral swatch hover instead of palette floods', async ( { open } ) => {
		const page = await open( SettingsDestination.APPEARANCE );
		const preview = page.locator( '.preferences-theme-card' ).first();
		await preview.focus();
		const focus = await preview.evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return { padding: parseFloat( style.paddingTop ), radius: parseFloat( style.borderRadius ) };
		} );
		expect( focus.padding ).toBeGreaterThan( 0 );
		expect( focus.radius ).toBeGreaterThan( focus.padding );
		const swatch = page.locator( '.preferences-palette-card' ).last();
		const resting = await swatch.evaluate( ( element ) => getComputedStyle( element ).backgroundColor );
		await swatch.hover();
		expect( await swatch.evaluate( ( element ) => getComputedStyle( element ).backgroundColor ) ).toBe( resting );
	} );
	test( 'shows named two-column palette choices in forced colors', async ( { open } ) => {
		const page = await open( SettingsDestination.APPEARANCE );

		await page.emulateMedia( { forcedColors: 'active' } );

		const cards = page.locator( '.preferences-palette-card' );
		const rows = await cards.evaluateAll( ( elements ) => elements.map( ( element ) =>
			element.getBoundingClientRect().y ) );
		expect( rows[ 0 ] ).toBe( rows[ 1 ] );
		expect( rows[ 2 ] ).toBeGreaterThan( rows[ 0 ] ?? 0 );
		for ( const palette of Object.values( Palette ) ) {
			const card = page.getByRole( 'radio', { name: BrowserPaletteLabels[ palette ], exact: true } );
			const label = card.getByText( BrowserPaletteLabels[ palette ], { exact: true } );
			expect( await label.evaluate( ( element ) => element.getBoundingClientRect().width ) )
				.toBeGreaterThan( 10 );
			expect( await label.evaluate( ( element ) => getComputedStyle( element ).position ) ).toBe( 'static' );
			await card.click();
			expect( await card.getAttribute( 'aria-checked' ) ).toBe( 'true' );
		}
	} );

	test( 'retains clay swatches, framed miniatures and bottom-aligned preview content', async ( { open } ) => {
		const page = await open( SettingsDestination.APPEARANCE );

		const swatch = page.locator( '.preferences-palette-card' ).first();
		expect( await page.locator( '.mantine-RadioGroup-label' ).nth( 1 ).evaluate( ( element ) =>
			getComputedStyle( element, '::after' ).borderTopStyle ) ).toBe( 'none' );
		const geometry = await swatch.evaluate( ( element ) => ( {
			width: element.getBoundingClientRect().width,
			height: element.getBoundingClientRect().height,
		} ) );
		expect( geometry.width ).toBe( 44 );
		expect( geometry.height ).toBe( 44 );
		const clay = await swatch.locator( '.tocus-choice-clay' ).evaluate( ( element ) => ( {
			width: element.getBoundingClientRect().width,
			shadow: getComputedStyle( element ).boxShadow,
		} ) );
		expect( clay.width ).toBeCloseTo( 35.2, 0 );
		expect( clay.shadow ).toContain( 'inset' );
		expect( clay.shadow.split( 'rgba' ).length ).toBeGreaterThan( 1 );
		const preview = page.locator( '.preferences-theme-preview' ).first();
		expect( await preview.evaluate( ( element ) => {
			const brand = element.querySelector( '.tocus-brand' )?.getBoundingClientRect();
			const line = element.querySelector( '.preferences-preview-lines span' )?.getBoundingClientRect();
			return brand !== undefined && line !== undefined
						&& line.top - brand.bottom > element.clientHeight / 2;
		} ) ).toBe( true );
		expect( await page.locator( '.preferences-theme-preview[data-preview-theme="system"] .preferences-preview-lines' ).count() ).toBe( 2 );
		await page.getByRole( 'radio', { name: BrowserThemeLabels[ ThemeMode.DARK ], exact: true } ).click();
		expect( await page.getByRole( 'radio', { name: BrowserThemeLabels[ ThemeMode.DARK ], exact: true } )
			.locator( '.preferences-theme-frame' ).evaluate( ( element ) => getComputedStyle( element ).boxShadow ) ).not.toBe( 'none' );
	} );

	test( 'previews all palettes and themes with compact named swatches and miniature screens', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.APPEARANCE );
		for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] as const ) {
			await page.getByRole( 'radio', { name: BrowserThemeLabels[ theme ], exact: true } ).click();
			for ( const palette of Object.values( Palette ) ) {
				const swatch = page.getByRole( 'radio', { name: BrowserPaletteLabels[ palette ], exact: true } );
				await swatch.click();
				await expect.poll( () =>
					page.locator( 'html' ).getAttribute( 'data-tocus-palette' ) ).toBe( palette );
				expect( await swatch.getAttribute( 'aria-checked' ) ).toBe( 'true' );
			}
			expect( await page.locator( 'html' ).getAttribute( 'data-tocus-theme' ) ).toBe( theme );
		}
		expect( await page.locator( '.preferences-palette-card' ).count() ).toBe( 6 );
		expect( await page.locator( '.preferences-palette-card' ).first().evaluate( ( element ) => {
			const rectangle = element.getBoundingClientRect();
			return rectangle.width / rectangle.height;
		} ) ).toBeCloseTo( 1, 1 );
		expect( await page.locator( '.preferences-theme-preview' ).first().evaluate( ( element ) => {
			const rectangle = element.getBoundingClientRect();
			return rectangle.width / rectangle.height;
		} ) ).toBeCloseTo( 4 / 3, 1 );
		await page.setViewportSize( { width: 390, height: 844 } );
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );
} );
