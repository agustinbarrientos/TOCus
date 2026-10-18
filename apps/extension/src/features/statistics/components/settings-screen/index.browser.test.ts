import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';
import { Language } from '../../../../domains/preferences/types';
import { StatisticsRange } from '../../utils/select-statistics-range/types';

test.describe( 'local statistics', () => {
	test( 'aligns unequal website count columns without losing full values in narrow or enlarged text', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS, Language.GERMAN );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { visitOutcomes: {
				recordedFromDate: '2026-09-14',
				dailySites: [
					{ date: '2026-09-14', siteHost: 'a.example', reconsideredVisitCount: 1_234_567, visitedAfterPauseCount: 7 },
					{ date: '2026-09-14', siteHost: 'b.example', reconsideredVisitCount: 1_200, visitedAfterPauseCount: 9_876_543 },
					{ date: '2026-09-14', siteHost: 'long-project-reference.example', reconsideredVisitCount: 37, visitedAfterPauseCount: 42 },
				],
				dailyHours: [ { date: '2026-09-14', hour: 9, reconsideredVisitCount: 1_235_804 } ],
			} } );
		} );
		const sites = page.locator( '.settings-statistics-site-list' );
		await expect( sites.locator( '[data-outcome] strong' ) ).toHaveText( [
			'1.234.567', '7', '1.200', '9.876.543', '37', '42',
		] );
		await page.evaluate( () => document.fonts.ready );
		const initialFont = await sites.locator( '[data-outcome] strong' ).first().evaluate( ( element ) =>
			parseFloat( getComputedStyle( element ).fontSize ) );
		for ( const [ width, fontSize, fontFamily ] of [
			[ 1280, '100%', '' ], [ 320, '100%', '' ], [ 320, '200%', '' ], [ 320, '200%', 'monospace' ],
		] as const ) {
			await page.setViewportSize( { width, height: 1000 } );
			await page.evaluate( ( { size, family } ) => {
				document.documentElement.style.fontSize = size;
				const provider = document.querySelector<HTMLElement>( '[data-tocus-ui]' );
				if ( provider === null ) {
					throw new TypeError( 'Statistics must retain its themed provider.' );
				}
				// System fonts differ by platform; retain a wide generic fallback reflow case.
				provider.style.setProperty( '--tocus-font-family-body', family );
			}, { size: fontSize, family: fontFamily } );
			await sites.scrollIntoViewIfNeeded();

			await expect.poll( () => sites.evaluate( ( list ) => {
				const rows = [ ...list.querySelectorAll( '.settings-statistics-site-header' ) ];
				/**
				 * Measures a required rendered child rather than ignoring absent outcome marks.
				 * @param row - Website header containing the identity and both outcomes.
				 * @param selector - Child whose visible bounds are required.
				 * @return Browser layout bounds of the real rendered child.
				 */
				function bounds( row: Element, selector: string ): DOMRect {
					const child = row.querySelector( selector );
					if ( child === null ) {
						throw new TypeError( 'Each website must retain its identity, both full counts and outcome marks.' );
					}
					return child.getBoundingClientRect();
				}
				const solid = rows.map( ( row ) =>
					bounds( row, '[data-outcome="reconsidered"] .settings-statistics-outcome-key' ).right );
				const striped = rows.map( ( row ) =>
					bounds( row, '[data-outcome="continued"] .settings-statistics-outcome-key' ).right );
				const listBounds = list.getBoundingClientRect();
				return {
					solidSpread: Math.max( ...solid ) - Math.min( ...solid ),
					stripedSpread: Math.max( ...striped ) - Math.min( ...striped ),
					fits: list.scrollWidth <= list.clientWidth,
					withinViewport: listBounds.left >= 0 && listBounds.right <= innerWidth,
					pageFits: document.documentElement.scrollWidth <= innerWidth,
					valuesFit: [ ...list.querySelectorAll( '[data-outcome] strong' ) ].every( ( number ) => {
						const text = document.createRange();
						text.selectNodeContents( number );
						return [ ...text.getClientRects() ].every( ( rect ) =>
							rect.left >= listBounds.left && rect.right <= listBounds.right );
					} ),
					disjoint: rows.every( ( row ) => {
						const identity = bounds( row, '.settings-statistics-site-identity-row' );
						const counts = bounds( row, '.settings-statistics-site-counts' );
						return identity.right <= counts.left || identity.bottom <= counts.top;
					} ),
				};
			} ), { message: `Shared website columns at ${ String( width ) }px and ${ fontSize } ${ fontFamily } text` } ).toEqual( {
				solidSpread: 0, stripedSpread: 0, fits: true, withinViewport: true,
				pageFits: true, valuesFit: true, disjoint: true,
			} ).catch( async ( error: unknown ) => {
				const geometry = await page.evaluate( () => {
					const viewport = {
						innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth,
						clientHeight: document.documentElement.clientHeight,
						scrollWidth: document.documentElement.scrollWidth,
						scrollHeight: document.documentElement.scrollHeight,
						bodyWidth: document.body.getBoundingClientRect().width, scrollX, scrollY,
						devicePixelRatio, visualViewportWidth: visualViewport?.width,
						rootFontSize: getComputedStyle( document.documentElement ).fontSize,
						fonts: document.fonts.status,
					};
					/**
					 * Records the exact box and clipping context of a potential overflow source.
					 * @param element - Real rendered element from the failing fixture.
					 * @return Geometry and computed layout values needed to identify platform differences.
					 */
					function describe( element: Element ) {
						const rect = element.getBoundingClientRect();
						const style = getComputedStyle( element );
						return { tag: element.tagName, id: element.id, className: element.getAttribute( 'class' ),
							left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width,
							clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
							position: style.position, display: style.display, visibility: style.visibility,
							overflowX: style.overflowX, overflowY: style.overflowY, clipPath: style.clipPath,
							whiteSpace: style.whiteSpace, minWidth: style.minWidth, maxWidth: style.maxWidth,
							fontSize: style.fontSize, fontFamily: style.fontFamily, transform: style.transform };
					}
					const elements = [ ...document.querySelectorAll( 'body *' ) ].filter( ( element ) => {
						const box = element.getBoundingClientRect();
						return box.width > 0 && ( box.right > viewport.clientWidth ||
							element.scrollWidth > element.clientWidth );
					} ).slice( 0, 400 ).map( ( element ) => {
						const ancestors = [];
						let parent = element.parentElement;
						while ( parent !== null ) {
							ancestors.push( describe( parent ) );
							parent = parent.parentElement;
						}
						return { element: describe( element ), ancestors };
					} );
					const text = [];
					const walker = document.createTreeWalker( document.body, NodeFilter.SHOW_TEXT );
					let node = walker.nextNode();
					while ( node !== null ) {
						const range = document.createRange();
						range.selectNodeContents( node );
						const rects = [ ...range.getClientRects() ];
						if ( rects.some( ( rect ) => rect.width > 0 && rect.right > viewport.clientWidth ) ) {
							text.push( { text: node.textContent?.slice( 0, 100 ),
								rights: rects.map( ( rect ) => rect.right ),
								parent: node.parentElement === null ? null : describe( node.parentElement ) } );
						}
						node = walker.nextNode();
					}
					return { viewport, elements, text };
				} );
				await test.info().attach( 'statistics-overflow-geometry', {
					body: JSON.stringify( geometry, null, 2 ), contentType: 'application/json',
				} );
				await test.info().attach( 'statistics-overflow-full-page', {
					body: await page.screenshot( { fullPage: true } ), contentType: 'image/png',
				} );
				throw error;
			} );
			await expect( sites.locator( '[data-outcome] strong' ) ).toHaveText( [
				'1.234.567', '7', '1.200', '9.876.543', '37', '42',
			] );
		}
		const enlargedFont = await sites.locator( '[data-outcome] strong' ).first().evaluate( ( element ) =>
			parseFloat( getComputedStyle( element ).fontSize ) );
		expect( enlargedFont ).toBeGreaterThan( initialFont * 1.8 );
	} );
	test( 'defaults to current week and updates counts, estimate, websites and hours together for calendar periods', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( {
				currentDate: '2026-09-16', firstRecordedDate: '2026-08-31',
				estimatedReclaimedMilliseconds: 720_000, focusedPauseMilliseconds: 360_000,
				reconsideredVisitCount: 6, completedWaitCount: 12, allowanceGrantedCount: 18,
				dailyTotals: [
					{ date: '2026-08-31', estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 60_000,
						reconsideredVisitCount: 1, completedWaitCount: 2, allowanceGrantedCount: 3 },
					{ date: '2026-09-13', estimatedReclaimedMilliseconds: 240_000, focusedPauseMilliseconds: 120_000,
						reconsideredVisitCount: 2, completedWaitCount: 4, allowanceGrantedCount: 6 },
					{ date: '2026-09-14', estimatedReclaimedMilliseconds: 360_000, focusedPauseMilliseconds: 180_000,
						reconsideredVisitCount: 3, completedWaitCount: 6, allowanceGrantedCount: 9 },
				],
				visitOutcomes: {
					recordedFromDate: '2026-08-31',
					dailySites: [
						{ date: '2026-08-31', siteHost: 'youtube.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 3 },
						{ date: '2026-09-13', siteHost: 'youtube.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 6 },
						{ date: '2026-09-14', siteHost: 'youtube.com', reconsideredVisitCount: 3, visitedAfterPauseCount: 9 },
					],
					dailyHours: [
						{ date: '2026-08-31', hour: 8, reconsideredVisitCount: 1 },
						{ date: '2026-09-13', hour: 12, reconsideredVisitCount: 2 },
						{ date: '2026-09-14', hour: 23, reconsideredVisitCount: 3 },
					],
				},
			} );
		} );
		const selector = page.getByRole( 'combobox', { name: 'Period', exact: true } );
		await expect( selector ).toHaveValue( StatisticsRange.CURRENT_WEEK );
		const totals = page.locator( '.settings-statistics-estimate dd, .settings-metrics dd' );
		const rows = page.getByRole( 'region', { name: 'Daily activity', exact: true } ).locator( 'tbody tr' );
		const website = page.locator( '.settings-statistics-site-list [data-site="youtube.com"]' );
		const hours = page.getByRole( 'region', { name: 'Reconsidered visits by hour', exact: true } ).getByRole( 'table' );
		await expect( totals ).toHaveText( [ '3', '6', 'Approximately 6 minutes' ] );
		await expect( rows ).toHaveCount( 1 );
		await expect( rows ).toContainText( 'Sep 14, 2026' );
		await expect( website.locator( '[data-outcome] strong' ) ).toHaveText( [ '3', '9' ] );
		await expect( hours.getByRole( 'row', { name: '23:00 3', exact: true } ) ).toHaveCount( 1 );
		await selector.selectOption( StatisticsRange.CURRENT_MONTH );
		await expect( totals ).toHaveText( [ '5', '10', 'Approximately 10 minutes' ] );
		await expect( rows ).toHaveCount( 2 );
		await expect( website.locator( '[data-outcome] strong' ) ).toHaveText( [ '5', '15' ] );
		await expect( hours.getByRole( 'row', { name: '08:00 0', exact: true } ) ).toHaveCount( 1 );
		await expect( hours.getByRole( 'row', { name: '12:00 2', exact: true } ) ).toHaveCount( 1 );
		await selector.selectOption( StatisticsRange.ALL_TIME );
		await expect( totals ).toHaveText( [ '6', '12', 'Approximately 12 minutes' ] );
		await expect( rows ).toHaveCount( 3 );
		await expect( website.locator( '[data-outcome] strong' ) ).toHaveText( [ '6', '18' ] );
		await expect( hours.locator( 'tbody tr' ) ).toHaveCount( 24 );
		await expect( hours.getByRole( 'row', { name: '08:00 1', exact: true } ) ).toHaveCount( 1 );
	} );

	test( 'places primary counts above the estimate and daily activity before visit outcomes', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { dailyTotals: [ {
				date: '2026-09-14', estimatedReclaimedMilliseconds: 360000, focusedPauseMilliseconds: 60000,
				reconsideredVisitCount: 1, completedWaitCount: 1, allowanceGrantedCount: 1,
			} ] } );
		} );
		const chart = page.getByRole( 'region', { name: 'Daily activity', exact: true } );
		await expect( chart ).toBeVisible();
		await expect( chart.getByRole( 'table' ) ).toContainText( '1' );
		const estimate = await page.locator( '.settings-statistics-estimate' ).boundingBox();
		const chartBox = await chart.boundingBox();
		const primary = await page.locator( '.settings-metrics' ).boundingBox();
		const outcomes = await page.getByRole( 'region', { name: 'Visit outcomes', exact: true } ).boundingBox();
		expect( estimate?.y ).toBeGreaterThan( primary?.y ?? 0 );
		expect( chartBox?.y ).toBeGreaterThan( estimate?.y ?? 0 );
		expect( outcomes?.y ).toBeGreaterThan( chartBox?.y ?? 0 );
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
			for ( const width of [ 320, 360, 390, 404 ] ) {
				await page.setViewportSize( { width, height: 844 } );
				// Chart dimensions follow the viewport through an asynchronous ResizeObserver update.
				await expect.poll( () => amount.evaluate( ( element, firstWord ) => {
					const node = element.firstChild;
					if ( ! ( node instanceof Text ) ) {
						throw new TypeError( 'The metric amount must contain its localized text.' );
					}
					const range = document.createRange();
					range.setStart( node, 0 );
					range.setEnd( node, firstWord.length );
					const lines = [ ...range.getClientRects() ];
					const bounds = element.getBoundingClientRect();
					const completeText = document.createRange();
					completeText.selectNodeContents( element );
					const finalLine = [ ...completeText.getClientRects() ].at( -1 );
					const help = element.closest( '.settings-statistics-estimate' )?.querySelector( 'button' );
					if ( finalLine === undefined || help === null || help === undefined ) {
						throw new TypeError( 'The estimate must retain its value and help control.' );
					}
					const helpBounds = help.getBoundingClientRect();
					return {
						wordLines: new Set( lines.map( ( line ) => line.top ) ).size,
						wordFits: lines.every( ( line ) => line.left >= bounds.left && line.right <= bounds.right ),
						helpBesideValue: helpBounds.left >= finalLine.right &&
							helpBounds.top < finalLine.bottom && helpBounds.bottom > finalLine.top,
						pageFits: document.documentElement.scrollWidth <= window.innerWidth,
						fontSize: getComputedStyle( element ).fontSize,
						availableWidth: bounds.width,
					};
				}, firstWord ), { message: `${ language } at ${ String( width ) }px` } ).toMatchObject( {
					wordLines: 1, wordFits: true, helpBesideValue: true, pageFits: true,
				} );
			}
		} );
	}

	test( 'emphasizes the two count cards above the secondary estimate', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		const metrics = page.locator( '.settings-metrics' );
		await metrics.waitFor();
		await expect( metrics.locator( ':scope > div' ) ).toHaveCount( 2 );
		const primarySize = await metrics.locator( 'dd' ).first().evaluate( ( element ) => parseFloat( getComputedStyle( element ).fontSize ) );
		const estimateSize = await page.locator( '.settings-statistics-estimate dd' ).evaluate( ( element ) => parseFloat( getComputedStyle( element ).fontSize ) );
		expect( primarySize ).toBeGreaterThan( estimateSize );
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
					dailyTotals: [ { date: '2026-09-14', estimatedReclaimedMilliseconds: 0,
						focusedPauseMilliseconds: 0, reconsideredVisitCount: 2,
						completedWaitCount: 3, allowanceGrantedCount: 4 } ],
				} );
			} );
			const amount = page.locator( '.settings-statistics-estimate dd' );
			await expect.poll( () => amount.textContent() ).toBe( expected );
			expect( await metrics.locator( 'dd' ).first().textContent() ).toBe( '2' );
			expect( await page.locator( '.settings-statistics-daily .settings-statistics-empty' ).count() ).toBe( 0 );
			await page.evaluate( () => document.fonts.ready );
			for ( const width of [ 320, 390 ] ) {
				await page.setViewportSize( { width, height: 844 } );
				expect( await amount.evaluate( ( element ) =>
					element.scrollWidth <= element.clientWidth ) ).toBe( true );
				// The responsive chart applies its new width after the viewport resize.
				await expect.poll( () => page.evaluate( () =>
					document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
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
				window.settingsTest.externalStatistics( { estimatedReclaimedMilliseconds: milliseconds,
					dailyTotals: [ { date: '2026-09-14', estimatedReclaimedMilliseconds: milliseconds,
						focusedPauseMilliseconds: 0, reconsideredVisitCount: 2,
						completedWaitCount: 3, allowanceGrantedCount: 4 } ],
				} );
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
		expect( await dialog.evaluate( ( element ) => element.closest( '.settings-data-reset' ) !== null ) ).toBe( true );
		await page.keyboard.press( 'Escape' );
		await dialog.waitFor( { state: 'hidden' } );
		await expect.poll( () => button.evaluate( ( element ) =>
			document.activeElement === element ) ).toBe( true );
	} );

	test( 'refreshes primary counts and secondary estimate live, then clears all aggregates after confirmed reset', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.STATISTICS );
		const metrics = page.locator( '.settings-metrics' );
		await metrics.waitFor();
		const totals = page.locator( '.settings-statistics-estimate, .settings-metrics' );
		expect( await totals.locator( 'dt' ).allTextContents() ).toEqual( [
			'Reconsidered visits', 'Completed pauses', 'Estimated time reclaimed',
		] );
		expect( await totals.locator( 'dd' ).allTextContents() ).toEqual( [
			'2', '3', 'Approximately 11 minutes',
		] );
		await page.setViewportSize( { width: 390, height: 844 } );
		expect( await metrics.evaluate( ( element ) =>
			getComputedStyle( element ).gridTemplateColumns.split( ' ' ).length ) ).toBe( 2 );
		// The responsive chart updates its measured width after the viewport resize.
		await expect.poll( () => page.evaluate( () =>
			document.documentElement.scrollWidth - innerWidth ) ).toBeLessThanOrEqual( 0 );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { reconsideredVisitCount: 8,
				dailyTotals: [ { date: '2026-09-14', estimatedReclaimedMilliseconds: 660_000,
					focusedPauseMilliseconds: 60_000, reconsideredVisitCount: 8,
					completedWaitCount: 3, allowanceGrantedCount: 4 } ],
			} );
		} );
		await expect( metrics.locator( 'dd' ).first() ).toHaveText( '8' );
		await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await dialog.waitFor( { state: 'hidden' } );
		expect( await page.evaluate( () => window.settingsTest.controls.resetCount ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
		await dialog.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
		await page.locator( '.mantine-Notification-root[role="status"]' ).waitFor();
		expect( await totals.locator( 'dd' ).allTextContents() ).toEqual( [
			'0', '0', 'Not enough data yet',
		] );
		await expect( page.locator( '.settings-statistics-estimate' ) ).toBeVisible();
		await expect( page.getByText( 'No visit outcomes recorded in this period.', { exact: true } ) ).toBeVisible();
		await expect( page.getByText( 'No reconsidered visits recorded in this period.', { exact: true } ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.getStatistics() ) ).toMatchObject( {
			firstRecordedDate: null, dailyTotals: [], visitOutcomes: {
				recordedFromDate: '2026-09-14', dailySites: [], dailyHours: [],
			},
		} );
		await expect( page.locator( '.settings-statistics-site-list' ) ).toHaveCount( 0 );
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

	test( 'uses current editable website names, cached icons and local monogram fallbacks without requesting access', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.locator( '#site-address' ).fill( 'youtube.com' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByLabel( 'Name', { exact: true } ).fill( 'Evening videos' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
		await page.evaluate( () => {
			window.settingsTest.setFaviconProvider( {
				/**
				 * Supplies one local icon and one unreadable local source to exercise fallback.
				 * @param host - Canonical configured host requested by the production screen.
				 * @return Embedded fixture icon or invalid local image, without a network request.
				 */
				getSource: ( host ) => host === 'youtube.com'
					? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="red"/%3E%3C/svg%3E'
					: 'data:image/png;base64,AA==',
			} );
		} );
		const requests = await page.evaluate( () => window.settingsTest.controls.requests );
		await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
		const youtube = page.locator( '.settings-statistics-site-list [data-site="youtube.com"]' );
		const reddit = page.locator( '.settings-statistics-site-list [data-site="reddit.com"]' );
		await expect( youtube.locator( '.settings-statistics-site-name' ) ).toHaveText( 'Evening videos' );
		await expect( youtube.locator( '.settings-site-identity p' ) ).toHaveText( 'youtube.com' );
		await expect( youtube.locator( 'img' ) ).toBeVisible();
		await expect( reddit.locator( '.settings-statistics-site-name' ) ).toHaveText( 'Reddit' );
		await expect( reddit.locator( '.settings-site-monogram' ) ).toBeVisible();
		await expect( reddit.locator( '.settings-site-monogram' ) ).toHaveText( 'R' );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	} );

	for ( const theme of [ 'light', 'dark' ] as const ) {
		test( `keeps ${ theme } website counts and solid or striped keys aligned at desktop and narrow widths`, async ( { page } ) => {
			await page.goto( `/apps/extension/src/features/settings/components/shell/__fixtures__/?theme=${ theme }#${ SettingsDestination.STATISTICS }` );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			const outcomes = page.getByRole( 'region', { name: 'Visit outcomes', exact: true } );
			const key = outcomes.getByRole( 'group', { name: 'Visit outcome key', exact: true } );
			await expect( key ).toHaveCount( 1 );
			await expect( key ).toContainText( 'Reconsidered' );
			await expect( key ).toContainText( 'Visited after pause' );
			const rows = outcomes.locator( '.settings-statistics-site-list > li' );
			await expect( rows.locator( '.settings-statistics-site-name' ) ).toHaveText( [ 'YouTube', 'Reddit' ] );
			await expect( rows.first().locator( '[data-outcome] strong' ) ).toHaveText( [ '1', '3' ] );
			await expect( rows.last().locator( '[data-outcome] strong' ) ).toHaveText( [ '1', '1' ] );
			await expect( rows.first().locator( '[data-outcome="reconsidered"]' ) ).toContainText( 'Reconsidered visits' );
			await expect( rows.first().locator( '[data-outcome="continued"]' ) ).toContainText( 'Visited after pause' );
			await expect( rows.first().locator( '.settings-statistics-site-track .settings-statistics-reconsidered-fill' ) )
				.toHaveCSS( 'background-image', 'none' );
			await expect( rows.first().locator( '.settings-statistics-site-track .settings-statistics-continued-fill' ) )
				.toHaveCSS( 'background-image', /repeating-linear-gradient/ );
			await page.evaluate( () => document.fonts.ready );
			for ( const width of [ 1280, 768, 600, 390, 320 ] ) {
				await page.setViewportSize( { width, height: 1000 } );
				await expect.poll( () => page.evaluate( () =>
					document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
				const alignment = await outcomes.evaluate( ( region ) => {
					const ends = [ ...region.querySelectorAll( '.settings-statistics-site-counts' ) ].map( ( item ) => item.getBoundingClientRect().right );
					const key = region.querySelector( '.settings-statistics-outcomes-legend' )?.getBoundingClientRect();
					const track = region.querySelector( '.settings-statistics-site-track' )?.getBoundingClientRect();
					const heading = region.querySelector( '.settings-statistics-sites-heading h3' )
						?.getBoundingClientRect();
					return { keyStart: key?.left, keyTop: key?.top,
						headingStart: heading?.left, headingBottom: heading?.bottom,
						spread: Math.max( ...ends ) - Math.min( ...ends ), keyEnd: key?.right,
						countEnd: ends[ 0 ], trackHeight: track?.height };
				} );
				expect( alignment.spread ).toBeLessThanOrEqual( 1 );
				if ( width > 768 ) {
					expect( Math.abs( ( alignment.keyEnd ?? 0 ) - ( alignment.countEnd ?? 0 ) ) )
						.toBeLessThanOrEqual( 1 );
				} else {
					expect( alignment.keyTop ).toBeGreaterThan( alignment.headingBottom ?? Infinity );
					expect( Math.abs( ( alignment.keyStart ?? 0 ) - ( alignment.headingStart ?? Infinity ) ) )
						.toBeLessThanOrEqual( 1 );
				}
				expect( alignment.trackHeight ).toBe( 6 );
			}
		} );
	}

	for ( const empty of [ false, true ] ) {
		test( `keeps the ${ empty ? 'empty' : 'populated' } activity and outcome sections free of a divider`, async ( { open } ) => {
			const page = await open( SettingsDestination.STATISTICS );
			if ( empty ) {
				await page.evaluate( () => {
					window.settingsTest.externalStatistics( { firstRecordedDate: null,
						estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
						reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0, dailyTotals: [],
						visitOutcomes: { recordedFromDate: '2026-09-14', dailySites: [], dailyHours: [] },
					} );
				} );
			}
			const daily = page.getByRole( 'region', { name: 'Daily activity', exact: true } );
			const outcomes = page.getByRole( 'region', { name: 'Visit outcomes', exact: true } );
			await expect( daily ).toHaveCSS( 'border-bottom-width', '0px' );
			await expect( outcomes ).toHaveCSS( 'border-top-width', '0px' );
			if ( empty ) {
				await expect( page.locator( '.settings-metrics dd' ) ).toHaveText( [ '0', '0' ] );
				await expect( page.locator( '.settings-statistics-estimate dd' ) ).toHaveText( 'Not enough data yet' );
				for ( const width of [ 1280, 390 ] ) {
					await page.setViewportSize( { width, height: 1000 } );
					for ( const period of [
						StatisticsRange.CURRENT_WEEK, StatisticsRange.CURRENT_MONTH, StatisticsRange.ALL_TIME,
					] ) {
						await page.getByRole( 'combobox', { name: 'Period', exact: true } ).selectOption( period );
						await expect( daily.getByRole( 'heading', { name: 'No activity in this period', exact: true } ) ).toBeVisible();
						await expect( daily.getByText( 'Your pauses and reconsidered visits will appear here.', { exact: true } ) ).toBeVisible();
						await expect( page.locator( '.settings-statistics-empty' ) ).toHaveCount( 3 );
						await expect( outcomes.getByText( 'No visit outcomes recorded in this period.', { exact: true } ) ).toBeVisible();
						await expect( outcomes.getByText( 'No reconsidered visits recorded in this period.', { exact: true } ) ).toBeVisible();
						await expect( outcomes.getByRole( 'group', { name: 'Visit outcome key', exact: true } ) )
							.toHaveCount( 0 );
						await expect( page.locator( '.settings-statistics-summary .recharts-surface' ) )
							.toHaveCount( 0 );
						await expect( daily.getByRole( 'combobox', { name: 'Daily activity metric', exact: true } ) )
							.toBeEnabled();
						expect( await page.evaluate( () =>
							document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
					}
				}
			}
		} );
	}

	test( 'keeps legacy totals without fabricated breakdowns and explains partial recording coverage', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { firstRecordedDate: '2026-09-01', visitOutcomes: undefined } );
		} );
		const outcomes = page.getByRole( 'region', { name: 'Visit outcomes', exact: true } );
		await expect( outcomes.getByText( 'Website and hourly breakdowns will appear as new visits are recorded.', { exact: true } ) ).toBeVisible();
		await expect( outcomes.locator( '.settings-statistics-site-list, .settings-statistics-hourly' ) ).toHaveCount( 0 );
		await expect( page.locator( '.settings-metrics dd' ) ).toHaveText( [ '2', '3' ] );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { visitOutcomes: {
				recordedFromDate: '2026-09-14', dailySites: [ {
					date: '2026-09-14', siteHost: 'youtube.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 4,
				} ], dailyHours: [ { date: '2026-09-14', hour: 9, reconsideredVisitCount: 2 } ],
			} } );
		} );
		const period = page.getByRole( 'combobox', { name: 'Period', exact: true } );
		await period.selectOption( StatisticsRange.ALL_TIME );
		await expect( outcomes.getByText( 'Breakdowns recorded from Sep 14, 2026.', { exact: true } ) ).toBeVisible();
		await expect( page.locator( '.settings-statistics-dates' ) ).toContainText( 'Sep 1' );
		await period.selectOption( StatisticsRange.CURRENT_WEEK );
		await expect( outcomes.locator( '.settings-statistics-coverage' ) ).toHaveCount( 0 );
		await expect( outcomes.locator( '[data-outcome] strong' ) ).toHaveText( [ '2', '4' ] );
	} );

	test( 'shows continued-only website outcomes without inventing hourly reconsiderations', async ( { open } ) => {
		const page = await open( SettingsDestination.STATISTICS );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { visitOutcomes: {
				recordedFromDate: '2026-09-14', dailySites: [ {
					date: '2026-09-14', siteHost: 'youtube.com', reconsideredVisitCount: 0, visitedAfterPauseCount: 1,
				} ], dailyHours: [],
			} } );
		} );
		await expect( page.locator( '.settings-statistics-site-list [data-outcome] strong' ) ).toHaveText( [ '0', '1' ] );
		const hourly = page.getByRole( 'region', { name: 'Reconsidered visits by hour', exact: true } );
		await expect( hourly.getByText( 'No reconsidered visits recorded in this period.', { exact: true } ) ).toBeVisible();
		await expect( hourly.getByRole( 'application' ) ).toHaveCount( 0 );
		await expect( hourly.getByRole( 'table' ) ).toHaveCount( 0 );
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
