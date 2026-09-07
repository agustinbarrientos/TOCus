import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { ThemeMode, Palette } from '../../../../domains/preferences/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { createSettingsBrowserHarness } from '../../../settings/utils/browser-test-harness';

const copy = TestEnglishLocalizationBundle.appearance;

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s shared appearance controls', ( name, engine ) => {
		const { open } = createSettingsBrowserHarness( engine );

		it( 'shows named two-column palette choices in forced colors', async ( context ) => {
			const page = await open( SettingsDestination.APPEARANCE );
			try {
				await page.emulateMedia( { forcedColors: 'active' } );
				if ( ! await page.evaluate( () => matchMedia( '(forced-colors: active)' ).matches ) ) {
					context.skip( 'This engine does not emulate forced colors.' );
					return;
				}
				const cards = page.locator( '.preferences-palette-card' );
				const rows = await cards.evaluateAll( ( elements ) => elements.map( ( element ) =>
					element.getBoundingClientRect().y ) );
				expect( rows[ 0 ] ).toBe( rows[ 1 ] );
				expect( rows[ 2 ] ).toBeGreaterThan( rows[ 0 ] ?? 0 );
				for ( const palette of Object.values( Palette ) ) {
					const card = page.getByRole( 'radio', { name: copy.paletteLabels[ palette ], exact: true } );
					const label = card.getByText( copy.paletteLabels[ palette ], { exact: true } );
					expect( await label.evaluate( ( element ) => element.getBoundingClientRect().width ) )
						.toBeGreaterThan( 10 );
					expect( await label.evaluate( ( element ) => getComputedStyle( element ).position ) ).toBe( 'static' );
					await card.click();
					expect( await card.getAttribute( 'aria-checked' ) ).toBe( 'true' );
				}
			} finally {
				await page.close();
			}
		} );

		it( 'retains clay swatches, framed miniatures and bottom-aligned preview content', async () => {
			const page = await open( SettingsDestination.APPEARANCE );
			try {
				const swatch = page.locator( '.preferences-palette-card' ).first();
				expect( await page.locator( '.mantine-RadioGroup-label' ).nth( 1 ).evaluate( ( element ) =>
					getComputedStyle( element, '::after' ).borderTopStyle ) ).toBe( 'solid' );
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
				await page.getByRole( 'radio', { name: copy.themeOptions[ ThemeMode.DARK ].label, exact: true } ).click();
				expect( await page.getByRole( 'radio', { name: copy.themeOptions[ ThemeMode.DARK ].label, exact: true } )
					.locator( '.preferences-theme-frame' ).evaluate( ( element ) => getComputedStyle( element ).boxShadow ) ).not.toBe( 'none' );
			} finally {
				await page.close();
			}
		} );

		it( 'previews all palettes and themes with compact named swatches and miniature screens', async () => {
			const page = await open( SettingsDestination.APPEARANCE );
			for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] as const ) {
				await page.getByRole( 'radio', { name: copy.themeOptions[ theme ].label, exact: true } ).click();
				for ( const palette of Object.values( Palette ) ) {
					const swatch = page.getByRole( 'radio', { name: copy.paletteLabels[ palette ], exact: true } );
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
			await page.close();
		}, 20000 );
	},
);
