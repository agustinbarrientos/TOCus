import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';
import { Language } from '../../../../domains/preferences/types';
import { StatisticsRange } from '../../utils/select-statistics-range/types';

test.describe( 'local statistics', () => {
	test( 'defaults to all time and updates the chart and every metric together for calendar periods', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( {
				currentDate: '2026-09-16', estimatedReclaimedMilliseconds: 720_000, focusedPauseMilliseconds: 360_000,
				reconsideredVisitCount: 6, completedWaitCount: 12, allowanceGrantedCount: 18,
				dailyTotals: [
					{ date: '2026-08-31', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 60_000,
						reconsideredVisitCount: 1, completedWaitCount: 2, allowanceGrantedCount: 3 },
					{ date: '2026-09-13', estimatedReclaimedMilliseconds: 240_000, focusedPauseMilliseconds: 120_000,
						reconsideredVisitCount: 2, completedWaitCount: 4, allowanceGrantedCount: 6 },
					{ date: '2026-09-14', estimatedReclaimedMilliseconds: 360_000, focusedPauseMilliseconds: 180_000,
						reconsideredVisitCount: 3, completedWaitCount: 6, allowanceGrantedCount: 9 },
				],
			} );
		} );
		const selector = page.getByRole( 'combobox', { name: 'Period', exact: true } );
		await expect( selector ).toHaveValue( StatisticsRange.ALL_TIME );
		const totals = page.locator( '.settings-statistics-estimate dd, .settings-metrics dd' );
		const rows = page.getByRole( 'region', { name: 'Activity', exact: true } ).locator( 'tbody tr' );
		await expect( totals ).toHaveText( [ 'Approximately 12 minutes', '6 minutes', '6', '12', '18' ] );
		await expect( rows ).toHaveCount( 3 );
		await selector.selectOption( StatisticsRange.CURRENT_WEEK );
		await expect( totals ).toHaveText( [ 'Approximately 6 minutes', '3 minutes', '3', '6', '9' ] );
		await expect( rows ).toHaveCount( 1 );
		await expect( rows ).toContainText( 'Sep 14, 2026' );
		await selector.selectOption( StatisticsRange.CURRENT_MONTH );
		await expect( totals ).toHaveText( [ 'Approximately 10 minutes', '5 minutes', '5', '10', '15' ] );
		await expect( rows ).toHaveCount( 2 );
		await selector.selectOption( StatisticsRange.ALL_TIME );
		await expect( totals ).toHaveText( [ 'Approximately 12 minutes', '6 minutes', '6', '12', '18' ] );
		await expect( rows ).toHaveCount( 3 );
	} );

	test( 'places recorded daily totals between the estimate and supporting lifetime metrics', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { dailyTotals: [ {
				date: '2026-09-14', estimatedReclaimedMilliseconds: 360000, focusedPauseMilliseconds: 60000,
				reconsideredVisitCount: 1, completedWaitCount: 1, allowanceGrantedCount: 1,
			} ] } );
		} );
		const chart = page.getByRole( 'region', { name: 'Activity', exact: true } );
		await expect( chart ).toBeVisible();
		await expect( chart.getByRole( 'table' ) ).toContainText( '6 minutes' );
		const estimate = await page.locator( '.settings-statistics-estimate' ).boundingBox();
		const chartBox = await chart.boundingBox();
		const supporting = await page.locator( '.settings-metrics' ).boundingBox();
		expect( chartBox?.y ).toBeGreaterThan( estimate?.y ?? 0 );
		expect( supporting?.y ).toBeGreaterThan( chartBox?.y ?? 0 );
	} );
	test( 'preserves readable estimate text when the user enlarges the base font', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.setViewportSize( { width: 320, height: 844 } );
		const amount = page.locator( '.settings-statistics-estimate dd' );
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
			const page = await open( SettingsDestination.STATISTICS, language );
			const amount = page.locator( '.settings-statistics-estimate dd' );
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
		const featured = await page.locator( '.settings-statistics-estimate' ).boundingBox();
		const supporting = await metrics.locator( ':scope > div' ).first().boundingBox();
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
			const page = await open( SettingsDestination.STATISTICS, language );
			const metrics = page.locator( '.settings-metrics' );
			await metrics.waitFor();
			await page.evaluate( () => {
				window.settingsTest.externalStatistics( {
					estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
				} );
			} );
			const amount = page.locator( '.settings-statistics-estimate dd' );
			await expect.poll( () => amount.textContent() ).toBe( expected );
			expect( await metrics.locator( 'dd' ).nth( 1 ).textContent() ).toBe( '2' );
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
		const amount = page.locator( '.settings-statistics-estimate dd' );
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
		const totals = page.locator( '.settings-statistics-estimate, .settings-metrics' );
		expect( await totals.locator( 'dt' ).allTextContents() ).toEqual( [
			'Estimated time reclaimed', 'Time you took to pause', 'Reconsidered visits',
			'Completed waits', 'Allowances granted',
		] );
		expect( await totals.locator( 'dd' ).allTextContents() ).toEqual( [
			'Approximately 11 minutes', '1 minute', '2', '3', '4',
		] );
		await page.setViewportSize( { width: 390, height: 844 } );
		expect( await metrics.evaluate( ( element ) =>
			getComputedStyle( element ).gridTemplateColumns.split( ' ' ).length ) ).toBe( 1 );
		// The responsive chart updates its measured width after the viewport resize.
		await expect.poll( () => page.evaluate( () =>
			document.documentElement.scrollWidth - innerWidth ) ).toBeLessThanOrEqual( 0 );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { reconsideredVisitCount: 8 } );
		} );
		await expect.poll( () => metrics.locator( 'dd' ).nth( 1 ).textContent() ).toBe( '8' );
		await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await dialog.waitFor( { state: 'hidden' } );
		expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
		await dialog.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
		await page.locator( '.mantine-Alert-root[role="status"]' ).waitFor();
		expect( await totals.locator( 'dd' ).allTextContents() ).toEqual( [
			'Not enough data yet', '0 minutes', '0', '0', '0',
		] );
		await expect( page.locator( '.settings-statistics-estimate' ) ).toBeVisible();
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

	for ( const [ language, unavailableTitle, retryLabel, resetLabel ] of [
		[ Language.ENGLISH, 'Statistics are unavailable', 'Try again', 'Reset statistics' ],
		[ Language.GERMAN, 'Statistiken sind nicht verf\u00fcgbar', 'Erneut versuchen', 'Statistiken zur\u00fccksetzen' ],
	] as const ) {
		test( `keeps ${ language } unavailable recovery warning beside its heading while keyboard reset expands confirmation`, async ( { open, setting } ) => {
			const page = await open( SettingsDestination.STATISTICS, language );
			await setting( page, 'unavailableStatistics', true );
			await page.evaluate( () => {
				window.settingsTest.externalStatistics( {} );
			} );
			const alert = page.getByRole( 'alert' );
			const warning = alert.locator( '.mantine-Alert-icon' );
			const heading = alert.getByRole( 'heading', { name: unavailableTitle, exact: true } );
			const description = alert.locator( '.tocus-alert-copy p' );
			const message = alert.locator( '.mantine-Alert-message' );
			const retry = alert.getByRole( 'button', { name: retryLabel, exact: true } );
			const reset = alert.getByRole( 'button', { name: resetLabel, exact: true } ).first();
			await expect( alert ).toBeVisible();
			expect( await description.evaluate( ( element ) => getComputedStyle( element ).color ) )
				.toBe( await message.evaluate( ( element ) => getComputedStyle( element ).color ) );
			await page.setViewportSize( { width: 320, height: 844 } );
			const beforeExpansion = await reset.evaluate( ( button ) => {
				const label = button.querySelector<HTMLElement>( '.mantine-Button-label' );
				const text = label?.firstChild;
				if ( ! label || ! ( text instanceof Text ) ) {
					throw new TypeError( 'The reset action must retain a real text label.' );
				}
				const range = document.createRange();
				range.selectNodeContents( text );
				const buttonBox = button.getBoundingClientRect();
				const style = getComputedStyle( button );
				const contentTop = buttonBox.top + parseFloat( style.paddingTop );
				const contentBottom = buttonBox.bottom - parseFloat( style.paddingBottom );
				return {
					labelFits: label.scrollHeight <= label.clientHeight,
					rangeFits: [ ...range.getClientRects() ].every( ( rect ) =>
						rect.top >= contentTop && rect.bottom <= contentBottom ),
				};
			} );
			expect( beforeExpansion, `${ language } before confirmation at 320px` ).toEqual( {
				labelFits: true, rangeFits: true,
			} );
			await reset.focus();
			await page.keyboard.press( 'Enter' );
			const confirmation = alert.getByRole( 'dialog' );
			await expect( confirmation ).toBeVisible();

			for ( const width of [ 800, 600, 320 ] ) {
				await page.setViewportSize( { width, height: 844 } );
				const [ alertBox, iconBox, headingBox, confirmationBox, retryBox, resetBox ] = await Promise.all( [
					alert.boundingBox(), warning.boundingBox(), heading.boundingBox(), confirmation.boundingBox(),
					retry.boundingBox(), reset.boundingBox(),
				] );
				if ( ! alertBox || ! iconBox || ! headingBox || ! confirmationBox || ! retryBox || ! resetBox ) {
					throw new TypeError( 'The recovery alert must retain warning, heading, confirmation, and action regions.' );
				}
				expect( iconBox.y, `${ language } at ${ String( width ) }px` )
					.toBeLessThanOrEqual( headingBox.y + headingBox.height );
				expect( iconBox.y + iconBox.height, `${ language } at ${ String( width ) }px` )
					.toBeGreaterThanOrEqual( headingBox.y );
				expect( iconBox.y + iconBox.height, `${ language } at ${ String( width ) }px` )
					.toBeLessThan( confirmationBox.y );
				for ( const action of [ retryBox, resetBox ] ) {
					expect( action.x, `${ language } at ${ String( width ) }px` ).toBeGreaterThanOrEqual( alertBox.x );
					expect( action.x + action.width, `${ language } at ${ String( width ) }px` )
						.toBeLessThanOrEqual( alertBox.x + alertBox.width );
				}
				const resetText = await reset.evaluate( ( button ) => {
					const label = button.querySelector<HTMLElement>( '.mantine-Button-label' );
					const text = label?.firstChild;
					if ( ! label || ! ( text instanceof Text ) ) {
						throw new TypeError( 'The reset action must retain a real text label.' );
					}
					const range = document.createRange();
					range.selectNodeContents( text );
					const buttonBox = button.getBoundingClientRect();
					const style = getComputedStyle( button );
					const contentTop = buttonBox.top + parseFloat( style.paddingTop );
					const contentBottom = buttonBox.bottom - parseFloat( style.paddingBottom );
					return {
						labelFits: label.scrollHeight <= label.clientHeight,
						rangeFits: [ ...range.getClientRects() ].every( ( rect ) =>
							rect.top >= contentTop && rect.bottom <= contentBottom ),
					};
				} );
				expect( resetText, `${ language } at ${ String( width ) }px` ).toEqual( {
					labelFits: true, rangeFits: true,
				} );
				expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ),
					`${ language } at ${ String( width ) }px` ).toBe( true );
			}
		} );
	}
} );
