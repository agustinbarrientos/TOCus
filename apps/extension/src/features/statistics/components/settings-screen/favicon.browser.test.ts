import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';

test.describe( 'Statistics website identities', () => {
	for ( const customName of [ undefined, 'Work search' ] ) {
		test( `keeps a registrable aggregate identity separate from a legacy product identity with name=${ String( customName ) }`, async ( { open } ) => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			await page.evaluate( ( { scopeId, customName } ) => {
				window.settingsTest.getConfiguration().sites = [ {
					identityHost: 'mail.google.com', ...( customName ? { displayNameOverride: customName } : {} ),
					rule: { host: 'google.com', includeSubdomains: true, scopeId },
				} ];
				window.settingsTest.setFaviconProvider( {
					/**
					 * Exposes a cached Gmail icon without a Google umbrella icon.
					 * @param host - Exact identity requested from the local cache.
					 * @return Product icon, or the umbrella cache miss.
					 */
					getSource: ( host ) => host === 'mail.google.com' || host === 'removed.example'
						? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="red"/%3E%3C/svg%3E' : null,
				} );
				window.settingsTest.externalStatistics( { visitOutcomes: {
					recordedFromDate: '2026-09-14',
					dailySites: [
						{ date: '2026-09-14', siteHost: 'google.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 1 },
						{ date: '2026-09-14', siteHost: 'removed.example', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 },
					],
					dailyHours: [ { date: '2026-09-14', hour: 19, reconsideredVisitCount: 3 } ],
				} } );
			}, { scopeId: DefaultProtectionScopeId, customName } );
			const configuration = await page.evaluate( () => window.settingsTest.getConfiguration() );
			const statistics = await page.evaluate( () => window.settingsTest.getStatistics() );
			await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
			await expect( page.locator( '.settings-statistics-site-list [data-site="removed.example"] img' ) ).toBeVisible();
			const aggregate = page.locator( '.settings-statistics-site-list [data-site="google.com"]' );
			await expect( aggregate.locator( '.settings-statistics-site-name' ) ).toHaveText( customName ?? 'Google' );
			await expect( aggregate.locator( 'img' ) ).toHaveCount( 0 );
			await expect( aggregate.locator( '.settings-site-monogram' ) ).toHaveText( customName ? 'W' : 'G' );
			expect( await page.evaluate( () => window.settingsTest.getConfiguration() ) ).toEqual( configuration );
			expect( await page.evaluate( () => window.settingsTest.getStatistics() ) ).toEqual( statistics );
			expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		} );
	}

	test( 'uses exact historical product icons without borrowing an umbrella or sibling product icon', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.evaluate( ( scopeId ) => {
			window.settingsTest.getConfiguration().sites = [ {
				identityHost: 'drive.google.com', displayNameOverride: 'Project files',
				rule: { host: 'drive.google.com', includeSubdomains: false, scopeId },
			} ];
			window.settingsTest.setFaviconProvider( {
				/**
				 * Distinguishes product cache entries from an available parent website icon.
				 * @param host - Exact canonical identity requested from the cache.
				 * @return Local source specific to this product or the parent.
				 */
				getSource: ( host ) => {
					const color = host === 'google.com' ? 'blue' : host === 'mail.google.com' ? 'red'
						: host === 'drive.google.com' ? 'green' : null;
					return color === null ? null : `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="${ color }"/%3E%3C/svg%3E`;
				},
			} );
			window.settingsTest.externalStatistics( { visitOutcomes: {
				recordedFromDate: '2026-09-14',
				dailySites: [
					{ date: '2026-09-14', siteHost: 'drive.google.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 },
					{ date: '2026-09-14', siteHost: 'google.com', reconsideredVisitCount: 3, visitedAfterPauseCount: 1 },
					{ date: '2026-09-14', siteHost: 'mail.google.com', reconsideredVisitCount: 2, visitedAfterPauseCount: 1 },
				],
				dailyHours: [ { date: '2026-09-14', hour: 19, reconsideredVisitCount: 6 } ],
			} } );
		}, DefaultProtectionScopeId );
		const configuration = await page.evaluate( () => window.settingsTest.getConfiguration() );
		const statistics = await page.evaluate( () => window.settingsTest.getStatistics() );
		await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
		for ( const { host, name, color } of [
			{ host: 'google.com', name: 'Google', color: 'blue' },
			{ host: 'mail.google.com', name: 'Gmail', color: 'red' },
			{ host: 'drive.google.com', name: 'Project files', color: 'green' },
		] ) {
			const row = page.locator( `.settings-statistics-site-list [data-site="${ host }"]` );
			await expect( row.locator( '.settings-statistics-site-name' ) ).toHaveText( name );
			await expect( row.locator( 'img' ) ).toHaveAttribute( 'src', new RegExp( `fill="${ color }"` ) );
		}
		expect( await page.evaluate( () => window.settingsTest.getConfiguration() ) ).toEqual( configuration );
		expect( await page.evaluate( () => window.settingsTest.getStatistics() ) ).toEqual( statistics );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

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
