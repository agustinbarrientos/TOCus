import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test.describe( 'Statistics website identities', () => {
	test( 'reuses the configured website icon and name for rule-host aggregates while retaining removed hosts', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.evaluate( () => {
			const cachedIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="orange"/%3E%3C/svg%3E';
			window.settingsTest.setFaviconProvider( {
				/**
				 * Simulates an existing browser cache entry for the exact configured identity.
				 * @param host - Exact identity requested by the production destination.
				 * @return Readable embedded icon only for cached hosts, without network access.
				 */
				getSource: ( host ) => host === 'www.infobae.com' || host === 'removed.example'
					? cachedIcon : 'data:image/png;base64,AA==',
				/**
				 * Distinguishes cached site icons from the placeholder, as the real provider does.
				 * @param host - Canonical identity checked in the browser-local cache.
				 * @return Valid cached icon or a cache miss, without visiting the website.
				 */
				resolveSource: ( host ) => Promise.resolve( host === 'www.infobae.com' || host === 'removed.example'
					? cachedIcon : null ),
			} );
		} );
		await page.locator( '#site-address' ).fill( 'www.infobae.com' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByLabel( 'Name', { exact: true } ).fill( 'Morning news' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
		const websiteIcon = page.locator( '.settings-site-item img' );
		await expect( websiteIcon ).toBeVisible();
		const websiteIconSource = await websiteIcon.getAttribute( 'src' );
		const requests = await page.evaluate( () => window.settingsTest.controls.requests );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { visitOutcomes: {
				recordedFromDate: '2026-09-14',
				dailySites: [
					{ date: '2026-09-14', siteHost: 'infobae.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 1 },
					{ date: '2026-09-14', siteHost: 'removed.example', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 },
				],
				dailyHours: [ { date: '2026-09-14', hour: 19, reconsideredVisitCount: 3 } ],
			} } );
		} );
		await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
		const news = page.locator( '.settings-statistics-site-list [data-site="infobae.com"]' );
		await expect( news.locator( 'img' ) ).toBeVisible();
		await expect( news.locator( 'img' ) ).toHaveAttribute( 'src', websiteIconSource ?? '' );
		await expect( news.locator( '.settings-statistics-site-name' ) ).toHaveText( 'Morning news' );
		await expect( news.locator( '.settings-site-identity p' ) ).toHaveText( 'infobae.com' );
		const historical = page.locator( '.settings-statistics-site-list [data-site="removed.example"]' );
		await expect( historical.locator( 'img' ) ).toBeVisible();
		await expect( historical.locator( '.settings-statistics-site-name' ) ).toHaveText( 'Removed' );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	} );
} );
