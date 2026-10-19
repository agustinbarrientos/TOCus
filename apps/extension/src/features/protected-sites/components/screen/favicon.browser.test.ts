import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test( 'waits for the cached favicon resolver and reuses its icon in Websites and Statistics', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.evaluate( () => {
		const ready = new Promise<void>( ( resolve ) => {
			window.addEventListener( 'release-cached-favicon', () => {
				resolve();
			}, { once: true } );
		} );
		window.settingsTest.setFaviconProvider( {
			/**
			 * Supplies the valid placeholder while a cached icon is resolving.
			 * @return Embedded browser-default stand-in.
			 */
			getSource: () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="gray"/%3E%3C/svg%3E',
			/**
			 * Resolves the cache result after the controlled lookup completes.
			 * @return Embedded available icon.
			 */
			resolveSource: async () => {
				await ready;
				return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="orange"/%3E%3C/svg%3E';
			},
		} );
	} );
	await page.locator( '#site-address' ).fill( 'example.com' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	const row = page.locator( '.settings-site-item' );
	await expect( row.locator( '.settings-site-monogram' ) ).toBeVisible();
	await expect( row.locator( 'img' ) ).toHaveCount( 0 );
	await page.evaluate( () => window.dispatchEvent( new Event( 'release-cached-favicon' ) ) );
	await expect( row.locator( 'img' ) ).toBeVisible();
	await expect( row.locator( 'img' ) ).toHaveAttribute( 'src', /fill="orange"/ );
	const source = await row.locator( 'img' ).getAttribute( 'src' );
	const requests = await page.evaluate( () => window.settingsTest.controls.requests );
	await page.evaluate( () => {
		window.settingsTest.externalStatistics( { visitOutcomes: {
			recordedFromDate: '2026-09-14',
			dailySites: [ { date: '2026-09-14', siteHost: 'example.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 } ],
			dailyHours: [ { date: '2026-09-14', hour: 19, reconsideredVisitCount: 1 } ],
		} } );
	} );
	await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
	const statistics = page.locator( '.settings-statistics-site-list [data-site="example.com"]' );
	await expect( statistics.locator( 'img' ) ).toBeVisible();
	await expect( statistics.locator( 'img' ) ).toHaveAttribute( 'src', source ?? '' );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
} );

test( 'keeps the local monogram when no cached variant resolves or its reader fails', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.evaluate( () => {
		window.settingsTest.setFaviconProvider( {
			/**
			 * Supplies a placeholder which must not count as a website icon.
			 * @return Embedded browser-default stand-in.
			 */
			getSource: () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="gray"/%3E%3C/svg%3E',
			/**
			 * Reports the cache miss after every variant has been checked.
			 * @return Unavailable local icon.
			 */
			resolveSource: () => Promise.resolve( null ),
		} );
	} );
	await page.locator( '#site-address' ).fill( 'example.com' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	const row = page.locator( '.settings-site-item' );
	await expect( row.locator( '.settings-site-monogram' ) ).toBeVisible();
	await expect( row.locator( 'img' ) ).toHaveCount( 0 );
	await page.evaluate( () => {
		window.settingsTest.setFaviconProvider( {
			/**
			 * Keeps the fallback local when the cache is unavailable.
			 * @return No direct image source.
			 */
			getSource: () => null,
			/**
			 * Simulates a failed browser-local cache lookup.
			 * @return Rejected local read.
			 */
			resolveSource: () => Promise.reject( new Error( 'Local favicon cache is unavailable.' ) ),
		} );
	} );
	await expect( row.locator( '.settings-site-monogram' ) ).toBeVisible();
	await expect( row.locator( 'img' ) ).toHaveCount( 0 );
} );
