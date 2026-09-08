import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { createSettingsBrowserHarness } from '../../../settings/utils/browser-test-harness';
import { Language } from '../../../../domains/preferences/types';

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s local statistics', ( _name, engine ) => {
		const { open, setting } = createSettingsBrowserHarness( engine );

		it( 'preserves readable estimate text when the user enlarges the base font', async () => {
			const page = await open( SettingsDestination.STATISTICS );
			await page.setViewportSize( { width: 320, height: 844 } );
			const amount = page.locator( '.settings-metrics > div:first-child dd' );
			await amount.waitFor();
			const before = await amount.evaluate( ( element ) => parseFloat( getComputedStyle( element ).fontSize ) );
			await page.evaluate( () => {
				document.documentElement.style.fontSize = '200%';
			} );
			const after = await amount.evaluate( ( element ) => parseFloat( getComputedStyle( element ).fontSize ) );
			expect( after ).toBeGreaterThan( before * 1.8 );
			await page.close();
		} );

		it.each( [
			[ Language.ENGLISH, 'Approximately' ],
			[ Language.SPANISH_VOS, 'Aproximadamente' ],
			[ Language.PORTUGUESE_BRAZIL, 'Aproximadamente' ],
		] )( 'keeps the %s estimate words intact on narrow screens', async ( language, firstWord ) => {
			const page = await open( SettingsDestination.STATISTICS );
			const url = new URL( page.url() );
			url.searchParams.set( 'language', language );
			await page.goto( url.href );
			const amount = page.locator( '.settings-metrics > div:first-child dd' );
			await expect.poll( () => amount.textContent() ).toMatch( new RegExp( `^${ firstWord } ` ) );
			await page.evaluate( () => document.fonts.ready );
			for ( const width of [ 320, 360, 390 ] ) {
				await page.setViewportSize( { width, height: 844 } );
				const layout = await amount.evaluate( ( element, firstWord ) => {
					const node = element.firstChild;
					if ( ! ( node instanceof Text ) ) {
						throw new TypeError( 'The metric amount must contain its localized text.' );
					}
					const range = document.createRange();
					range.setStart( node, 0 );
					range.setEnd( node, firstWord.length );
					const lines = [ ...range.getClientRects() ];
					const bounds = element.getBoundingClientRect();
					return {
						wordLines: new Set( lines.map( ( line ) => line.top ) ).size,
						wordFits: lines.every( ( line ) => line.left >= bounds.left && line.right <= bounds.right ),
						pageFits: document.documentElement.scrollWidth <= window.innerWidth,
						fontSize: getComputedStyle( element ).fontSize,
						availableWidth: bounds.width,
					};
				}, firstWord );
				expect( layout, `${ language } at ${ String( width ) }px: ${ JSON.stringify( layout ) }` ).toMatchObject( {
					wordLines: 1, wordFits: true, pageFits: true,
				} );
			}
			await page.close();
		} );

		it( 'emphasizes reclaimed time above four supporting metric cards', async () => {
			const page = await open( SettingsDestination.STATISTICS );
			const metrics = page.locator( '.settings-metrics' );
			await metrics.waitFor();
			const featured = await metrics.locator( ':scope > div' ).first().boundingBox();
			const supporting = await metrics.locator( ':scope > div' ).nth( 1 ).boundingBox();
			expect( featured?.width ).toBeGreaterThan( ( supporting?.width ?? 0 ) * 1.9 );
			const reset = await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).boundingBox();
			expect( reset?.width ).toBeLessThan( 250 );
			await page.close();
		} );

		it( 'keeps reset confirmation beside its local data context', async () => {
			const page = await open( SettingsDestination.STATISTICS );
			const button = page.getByRole( 'button', { name: 'Reset statistics', exact: true } );
			await button.click();
			const dialog = page.getByRole( 'dialog' );
			await dialog.waitFor();
			expect( await dialog.evaluate( ( element ) => element.closest( '.settings-statistics-data' ) !== null ) ).toBe( true );
			await page.keyboard.press( 'Escape' );
			await dialog.waitFor( { state: 'hidden' } );
			await expect.poll( () => button.evaluate( ( element ) =>
				document.activeElement === element ) ).toBe( true );
			await page.close();
		} );

		it( 'renders exactly five metrics, refreshes live and confirms reset', async () => {
			const page = await open( SettingsDestination.STATISTICS );
			const metrics = page.locator( '.settings-metrics' );
			await metrics.waitFor();
			expect( await metrics.locator( 'dt' ).allTextContents() ).toEqual( [
				'Estimated time reclaimed', 'Time you took to pause', 'Reconsidered visits',
				'Completed waits', 'Allowances granted',
			] );
			expect( await metrics.locator( 'dd' ).allTextContents() ).toEqual( [
				'Approximately 11 minutes', '1 minute', '2', '3', '4',
			] );
			await page.setViewportSize( { width: 390, height: 844 } );
			expect( await metrics.evaluate( ( element ) =>
				getComputedStyle( element ).gridTemplateColumns.split( ' ' ).length ) ).toBe( 1 );
			expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
			await page.evaluate( () => {
				window.settingsTest.externalStatistics( { reconsideredVisitCount: 8 } );
			} );
			await expect.poll( () => metrics.locator( 'dd' ).nth( 2 ).textContent() ).toBe( '8' );
			await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
			const dialog = page.getByRole( 'dialog' );
			await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
			await dialog.waitFor( { state: 'hidden' } );
			expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 0 );
			await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
			await dialog.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
			await page.locator( '.mantine-Alert-root[role="status"]' ).waitFor();
			expect( await metrics.locator( 'dd' ).allTextContents() ).toEqual( [
				'Approximately 0 minutes', '0 minutes', '0', '0', '0',
			] );
			expect( await page.locator( '.settings-statistics-empty' ).textContent() ).toBe( 'This is a moment just for you.' );
			await page.close();
		}, 20000 );

		it( 'hides stale totals after read or reset failure and recovers explicitly', async () => {
			const page = await open( SettingsDestination.STATISTICS );
			await page.locator( '.settings-metrics' ).waitFor();
			await setting( page, 'unavailableStatistics', true );
			await page.evaluate( () => {
				window.settingsTest.externalStatistics( {} );
			} );
			await page.getByRole( 'alert' ).waitFor();
			expect( await page.locator( '.settings-metrics' ).count() ).toBe( 0 );
			await setting( page, 'unavailableStatistics', false );
			await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
			await page.locator( '.settings-metrics' ).waitFor();
			await setting( page, 'rejectResets', true );
			await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
			await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
			await page.getByRole( 'alert' ).waitFor();
			expect( await page.locator( '.settings-metrics' ).count() ).toBe( 0 );
			await setting( page, 'rejectResets', false );
			await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
			await page.locator( '.settings-metrics' ).waitFor();
			expect( await page.getByRole( 'button', { name: 'Save', exact: true } ).count() ).toBe( 0 );
			await page.close();
		}, 20000 );
	},
);
