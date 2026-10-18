import { expect } from '@playwright/test';
import { Language } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from './index';

test( 'waits for localized Settings controls before open resolves', async ( { page, open, setting, browserName } ) => {
	const releaseCatalog = Promise.withResolvers<undefined>();
	const catalogRequested = page.waitForRequest( /\/assets\/de-[^/]+\.js$/u );
	await page.route( /\/assets\/de-[^/]+\.js$/u, async ( route ) => {
		await releaseCatalog.promise;
		await route.continue();
	} );
	let opened = false;
	const opening = open( SettingsDestination.STATISTICS, Language.GERMAN ).then( ( result ) => {
		opened = true;
		return result;
	} );
	try {
		await catalogRequested;
		// Chromium can report load before an awaited catalog initializes the fixture; other engines may block it.
		if ( browserName === 'chromium' ) {
			await page.waitForLoadState( 'load' );
		}
		expect( await page.evaluate( () => Object.hasOwn( window, 'settingsTest' ) ) ).toBe( false );
		expect( opened ).toBe( false );
	} finally {
		releaseCatalog.resolve( undefined );
	}
	const ready = await opening;
	await setting( ready, 'unavailableStatistics', true );
	await ready.evaluate( () => {
		window.settingsTest.externalStatistics( {} );
	} );
	await expect( ready.getByRole( 'alert' ).getByRole( 'heading', {
		name: 'Statistiken sind nicht verf\u00fcgbar', exact: true,
	} ) ).toBeVisible();
} );
