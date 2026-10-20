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

for ( const legacy of [ false, true ] ) {
	test( `reuses a configured member's cached favicon across grouped screens with legacy=${ String( legacy ) }`, async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		const externalRequests: string[] = [];
		page.on( 'request', ( request ) => {
			if ( /^https?:/u.test( request.url() ) &&
				! [ '127.0.0.1', 'localhost' ].includes( new URL( request.url() ).hostname ) ) {
				externalRequests.push( request.url() );
			}
		} );
		if ( legacy ) {
			await page.goto( '/apps/extension/src/features/settings/components/shell/__fixtures__/?original=favicon-legacy-studio#websites' );
			await page.waitForFunction( () => Object.hasOwn( window, 'settingsTest' ) );
		}
		await page.evaluate( () => {
			window.settingsTest.setFaviconProvider( {
				/**
				 * Supplies no unresolved placeholder as a real site icon.
				 * @return No direct icon.
				 */
				getSource: () => null,
				/**
				 * Resolves only the configured Studio identity from the existing browser cache.
				 * @param host - Requested canonical host.
				 * @return Embedded Studio icon or the root cache miss.
				 */
				resolveSource: ( host ) => Promise.resolve( host === 'studio.youtube.com'
					? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="orange"/%3E%3C/svg%3E' : null ),
			} );
		} );
		if ( ! legacy ) {
			await page.getByLabel( 'Website address', { exact: true } ).fill( 'studio.youtube.com' );
			await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
			await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		}
		const row = page.locator( '.settings-site-item:not(.settings-site-exception)' );
		await expect( row.locator( 'img' ) ).toBeVisible();
		const source = await row.locator( 'img' ).getAttribute( 'src' );
		const requests = await page.evaluate( () => window.settingsTest.controls.requests );
		await page.evaluate( () => {
			window.settingsTest.externalStatistics( { visitOutcomes: {
				recordedFromDate: '2026-09-14',
				dailySites: [ { date: '2026-09-14', siteHost: 'youtube.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 } ],
				dailyHours: [ { date: '2026-09-14', hour: 19, reconsideredVisitCount: 1 } ],
			} } );
		} );
		await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
		const statistics = page.locator( '.settings-statistics-site-list [data-site="youtube.com"]' );
		await expect( statistics.locator( 'img' ) ).toBeVisible();
		await expect( statistics.locator( 'img' ) ).toHaveAttribute( 'src', source ?? '' );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
		expect( externalRequests ).toEqual( [] );
	} );
}


test( 'updates cached member candidates without applying stale lookups after members change', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.evaluate( () => {
		const ready = new Promise<void>( ( resolve ) => {
			window.addEventListener( 'release-member-favicon', () => {
				resolve();
			}, { once: true } );
		} );
		window.settingsTest.setFaviconProvider( {
			/**
			 * Keeps browser-default images out of the resolved cache.
			 * @return No direct source.
			 */
			getSource: () => null,
			/**
			 * Delays Studio while another configured member can provide an immediate cached image.
			 * @param host - Requested member or group host.
			 * @return Controlled cache result.
			 */
			resolveSource: async ( host ) => {
				if ( host === 'studio.youtube.com' ) {
					await ready;
				}
				return host === 'studio.youtube.com'
					? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="orange"/%3E%3C/svg%3E'
					: host === 'm.youtube.com'
						? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="blue"/%3E%3C/svg%3E' : null;
			},
		} );
	} );
	for ( const host of [ 'youtube.com' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( host );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	const row = page.locator( '.settings-site-item:not(.settings-site-exception)' );
	await expect( row.locator( 'img' ) ).toHaveCount( 0 );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'm.youtube.com' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await expect( row.locator( 'img' ) ).toHaveAttribute( 'src', /fill="blue"/ );
	await page.evaluate( () => window.dispatchEvent( new Event( 'release-member-favicon' ) ) );
	await page.evaluate( () => new Promise<void>( ( resolve ) => {
		requestAnimationFrame( () => requestAnimationFrame( () => {
			resolve();
		} ) );
	} ) );
	await expect( row.locator( 'img' ) ).toHaveAttribute( 'src', /fill="blue"/ );
	for ( const host of [ 'm.youtube.com', 'studio.youtube.com' ] ) {
		await page.locator( '.settings-site-exception' ).filter( { hasText: host } )
			.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
		if ( host === 'm.youtube.com' ) {
			await expect( row.locator( 'img' ) ).toHaveAttribute( 'src', /fill="orange"/ );
		}
	}
	await expect( row.locator( 'img' ) ).toHaveCount( 0 );
	await expect( row.locator( '.settings-site-monogram' ) ).toBeVisible();
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
} );
