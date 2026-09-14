import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';
import { Language } from '../../../../domains/preferences/types';

test.describe( 'local statistics', () => {
	test( 'preserves readable estimate text when the user enlarges the base font', async ( { open } ) => {
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
	} );

	for ( const [ language, firstWord ] of [
		[ Language.ENGLISH, 'Approximately' ],
		[ Language.SPANISH_VOS, 'Aproximadamente' ],
		[ Language.PORTUGUESE_BRAZIL, 'Aproximadamente' ],
	] as const ) {
		test( `keeps the ${ language } estimate words intact on narrow screens`, async ( { open } ) => {
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
		} );
	}

	test( 'emphasizes reclaimed time above four supporting metric cards', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		const metrics = page.locator( '.settings-metrics' );
		await metrics.waitFor();
		const featured = await metrics.locator( ':scope > div' ).first().boundingBox();
		const supporting = await metrics.locator( ':scope > div' ).nth( 1 ).boundingBox();
		expect( featured?.width ).toBeGreaterThan( ( supporting?.width ?? 0 ) * 1.9 );
		const reset = await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).boundingBox();
		expect( reset?.width ).toBeLessThan( 250 );
	} );

	for ( const [ language, expected ] of [
		[ Language.ENGLISH, 'Not enough data yet' ],
		[ Language.SPANISH_TU, 'Todav\u00eda no hay suficientes datos' ],
		[ Language.SPANISH_VOS, 'Todav\u00eda no hay suficientes datos' ],
		[ Language.PORTUGUESE_BRAZIL, 'Ainda n\u00e3o h\u00e1 dados suficientes' ],
		[ Language.PORTUGUESE_PORTUGAL, 'Ainda n\u00e3o h\u00e1 dados suficientes' ],
		[ Language.ITALIAN, 'Non ci sono ancora dati sufficienti' ],
		[ Language.FRENCH, 'Pas encore assez de donn\u00e9es' ],
		[ Language.GERMAN, 'Noch nicht gen\u00fcgend Daten' ],
		[ Language.JAPANESE, '\u307e\u3060\u5341\u5206\u306a\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093' ],
		[ Language.RUSSIAN, '\u041f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0434\u0430\u043d\u043d\u044b\u0445' ],
	] as const ) {
		test( `renders the ${ language } zero estimate independently of recorded counts on narrow screens`, async ( { open } ) => {
			const page = await open( SettingsDestination.STATISTICS );
			const url = new URL( page.url() );
			url.searchParams.set( 'language', language );
			await page.goto( url.href );
			const metrics = page.locator( '.settings-metrics' );
			await metrics.waitFor();
			await page.evaluate( () => {
				window.settingsTest.externalStatistics( {
					estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
				} );
			} );
			const amount = metrics.locator( 'dd' ).first();
			await expect.poll( () => amount.textContent() ).toBe( expected );
			expect( await metrics.locator( 'dd' ).nth( 2 ).textContent() ).toBe( '2' );
			expect( await page.locator( '.settings-statistics-empty' ).count() ).toBe( 0 );
			await page.evaluate( () => document.fonts.ready );
			for ( const width of [ 320, 390 ] ) {
				await page.setViewportSize( { width, height: 844 } );
				expect( await amount.evaluate( ( element ) =>
					element.scrollWidth <= element.clientWidth ) ).toBe( true );
				expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
			}
		} );
	}

	test( 'updates the estimate from no data to a positive subminute duration and a rounded minute', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		const amount = page.locator( '.settings-metrics > div:first-child dd' );
		await amount.waitFor();
		for ( const [ milliseconds, expected ] of [
			[ 0, 'Not enough data yet' ],
			[ 1, 'Less than 1 minute' ],
			[ 60_000, 'Approximately 1 minute' ],
		] as const ) {
			await page.evaluate( ( milliseconds ) => {
				window.settingsTest.externalStatistics( { estimatedReclaimedMilliseconds: milliseconds } );
			}, milliseconds );
			await expect.poll( () => amount.textContent() ).toBe( expected );
		}
	} );

	test( 'keeps reset confirmation beside its local data context', async ( { open } ) => {
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
	} );

	test( 'renders exactly five metrics, refreshes live and confirms reset', async ( { open } ) => {
		test.setTimeout( 20000 );
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
			'Not enough data yet', '0 minutes', '0', '0', '0',
		] );
		expect( await page.locator( '.settings-statistics-empty' ).textContent() ).toBe( 'This is a moment just for you.' );
	} );

	test( 'hides stale totals after read or reset failure and recovers explicitly', async ( { open, setting } ) => {
		test.setTimeout( 20000 );
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
	} );
} );
