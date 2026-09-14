import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { test } from '../../../settings/utils/browser-test-harness';

test.describe( 'website draft controls', () => {
	test( 'shows granted browser access after saving and reopening Websites', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByText( 'Website changes saved.', { exact: true } ).waitFor();
		const accessAction = page.getByRole( 'button', { name: 'Allow access', exact: true } );
		expect( await accessAction.count() ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
		await page.locator( '.settings-site-list > li' ).waitFor();
		expect( await accessAction.count() ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
	} );

	test( 'rejects unfinished invalid addresses without changing storage or requesting access', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.PROTECTED_SITES );
		const address = page.getByLabel( 'Website address', { exact: true } );
		await address.fill( 'not a website' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByRole( 'alert' ).waitFor();
		expect( await address.inputValue() ).toBe( 'not a website' );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		expect( await address.inputValue() ).toBe( '' );
	} );

	test( 'stages multiple additions without writes or permission requests and discards all of them', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.PROTECTED_SITES );
		for ( const host of [ 'example.com', 'example.org' ] ) {
			await page.getByLabel( 'Website address', { exact: true } ).fill( host );
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		}
		expect( await page.locator( '.settings-site-list > li' ).count() ).toBe( 2 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		expect( await page.locator( '.settings-site-list > li' ).count() ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
	} );

	test( 'finishes the inline draft with Enter without persisting the page', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const row = page.locator( '.settings-site-list > li' ).first();
		await row.getByRole( 'button', { name: 'Manage this website', exact: true } ).click();
		const displayName = row.getByLabel( 'Display name', { exact: true } );
		await displayName.fill( 'Reading' );
		await displayName.press( 'Enter' );
		await displayName.waitFor( { state: 'hidden' } );
		expect( await row.getByRole( 'heading', { name: 'Reading', exact: true } ).count() ).toBe( 1 );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
	} );

	test( 'saves inline names and separate behavior, locks dirty schedule scope, and confirms removal', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const row = page.locator( '.settings-site-list > li' ).first();
		await row.getByRole( 'button', { name: 'Manage this website', exact: true } ).click();
		const displayName = row.getByLabel( 'Display name', { exact: true } );
		await expect.poll( () => displayName.evaluate(
			( element ) => document.activeElement === element,
		) ).toBe( true );
		await displayName.fill( 'Reading' );
		await row.getByRole( 'button', { name: 'Use automatic name', exact: true } ).click();
		expect( await displayName.inputValue() ).toBe( '' );
		expect( await displayName.evaluate( ( element ) => document.activeElement === element ) ).toBe( true );
		await displayName.fill( 'Reading' );
		await row.getByRole( 'radio', { name: 'Give this website its own timing', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByText( 'Website changes saved.', { exact: true } ).waitFor();
		const site = await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] );
		expect( site?.displayNameOverride ).toBe( 'Reading' );
		expect( site?.rule.scopeId ).not.toBe( DefaultProtectionScopeId );
		await page.getByRole( 'link', { name: 'Schedule', exact: true } ).click();
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		expect( await page.locator( '#schedule-scope' ).isDisabled() ).toBe( true );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		expect( await page.locator( '#schedule-scope' ).isDisabled() ).toBe( false );
		await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
		await row.getByRole( 'button', { name: 'Manage this website', exact: true } ).click();
		await row.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 1 );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () =>
			window.settingsTest.getConfiguration().sites.length ) ).toBe( 0 );
	} );
} );
