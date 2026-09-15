import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { test } from '../../../settings/utils/browser-test-harness';

test.describe( 'website draft controls', () => {
	test( 'reveals an optional schedule while typing and saves a site exception with automatic naming', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		const address = page.getByLabel( 'Website address', { exact: true } );
		await expect( address ).toBeVisible();
		await expect( page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ) ).toHaveCount( 0 );
		await expect( page.getByRole( 'button', { name: 'Advanced', exact: true } ) ).toHaveCount( 0 );
		await expect( page.getByLabel( 'Name', { exact: true } ) ).toHaveCount( 0 );
		await address.fill( 'e' );
		await expect( page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ) ).toBeVisible();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 0 );
		await address.fill( 'example.com' );
		await page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
		await expect( page.getByRole( 'table', { name: 'Active time windows', exact: true } ) ).toBeVisible();
		await expect( page.getByLabel( 'Name', { exact: true } ) ).toHaveCount( 0 );
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Remove time window 1', exact: true } ) ).toHaveCount( 0 );
		await page.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
		await page.getByLabel( 'End', { exact: true } ).fill( '17:00' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const site = await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] );
		expect( site?.rule.scopeId ).toBe( DefaultProtectionScopeId );
		expect( site?.schedule ).toMatchObject( { mode: ScheduleMode.CUSTOM,
			windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 1020 } ] } );
		expect( site?.displayNameOverride ).toBeUndefined();
		await expect( page.locator( '.settings-site-schedule' ) ).toContainText( '09:00' );
	} );
	test( 'clears a pending custom schedule with a blank address so other website edits can save', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		const address = page.getByLabel( 'Website address', { exact: true } );
		await address.fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await address.fill( 'example.org' );
		await page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
		await page.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
		await address.fill( '   ' );
		await expect( page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ) ).toHaveCount( 0 );
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 0 );
		await address.fill( 'example.net' );
		await expect( page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ) ).not.toBeChecked();
		await address.fill( '' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
		expect( sites ).toHaveLength( 1 );
		expect( sites[ 0 ]?.identityHost ).toBe( 'example.com' );
		expect( sites[ 0 ]?.schedule ).toBeUndefined();
	} );
	test( 'opens removal directly from the row and preserves storage until page Save', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const row = page.locator( '.settings-site-list > li' ).first();
		const remove = row.getByRole( 'button', { name: 'Remove site', exact: true } );
		const manage = row.getByRole( 'button', { name: 'Change schedule or site name', exact: true } );
		await manage.focus();
		await page.keyboard.press( 'Shift+Tab' );
		await expect( page.getByRole( 'tooltip', { name: 'Remove site', exact: true } ) ).toBeVisible();
		await page.keyboard.press( 'Tab' );
		await expect( page.getByRole( 'tooltip', { name: 'Change schedule or site name', exact: true } ) ).toBeVisible();
		const [ removeBounds, manageBounds ] = await Promise.all( [ remove.boundingBox(), manage.boundingBox() ] );
		expect( removeBounds ).not.toBeNull();
		expect( manageBounds ).not.toBeNull();
		expect( removeBounds?.x ).toBeLessThan( manageBounds?.x ?? 0 );
		await remove.click();
		await expect( row.getByLabel( 'Name', { exact: true } ) ).toHaveCount( 0 );
		const dialog = page.getByRole( 'dialog' );
		await expect( dialog.getByRole( 'button', { name: 'Remove', exact: true } ) ).toBeFocused();
		await dialog.getByRole( 'button', { name: 'Keep site', exact: true } ).click();
		await expect( row ).toBeVisible();
		await remove.click();
		await dialog.getByRole( 'button', { name: 'Remove', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > li' ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 1 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > li' ) ).toHaveCount( 1 );
	} );
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

	test( 'stages multiple additions without writes or permission requests and discards all of them',
		async ( { open } ) => {
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

	test( 'finishes the dialog draft with Enter without persisting the page', async ( { open } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const row = page.locator( '.settings-site-list > li' ).first();
		await row.getByRole( 'button', { name: 'Change schedule or site name', exact: true } ).click();
		const displayName = page.getByRole( 'dialog' ).getByLabel( 'Name', { exact: true } );
		await expect( displayName ).toBeFocused();
		await expect( row.getByRole( 'button', { name: 'Advanced', exact: true } ) ).toHaveCount( 0 );
		expect( await page.locator( '.settings-site-form' ).evaluate( ( element ) =>
			getComputedStyle( element ).paddingTop ) ).toBe( '0px' );
		await displayName.fill( 'Reading' );
		await displayName.press( 'Enter' );
		await displayName.waitFor( { state: 'hidden' } );
		expect( await row.getByRole( 'heading', { name: 'Reading', exact: true } ).count() ).toBe( 1 );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
	} );

	test( 'saves dialog naming and active hours atomically, restores automatic naming, and confirms removal',
		async ( { open } ) => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
			const row = page.locator( '.settings-site-list > li' ).first();
			await expect( row.locator( '.settings-site-schedule' ) ).toHaveCount( 0 );
			await row.getByRole( 'button', { name: 'Change schedule or site name', exact: true } ).click();
			const dialog = page.getByRole( 'dialog' );
			await dialog.getByLabel( 'Name', { exact: true } ).fill( 'Reading' );
			await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
			await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toBeVisible();
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
			await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveAttribute( 'aria-invalid', 'true' );
			expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await dialog.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
			await dialog.getByLabel( 'End', { exact: true } ).fill( '17:00' );
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
			await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
			await page.getByText( 'Website changes saved.', { exact: true } ).waitFor();
			const site = await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] );
			expect( site?.displayNameOverride ).toBe( 'Reading' );
			expect( site?.rule.scopeId ).toBe( DefaultProtectionScopeId );
			expect( site?.schedule ).toMatchObject( { mode: ScheduleMode.CUSTOM } );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
			await row.getByRole( 'button', { name: 'Change schedule or site name', exact: true } ).click();
			await dialog.getByLabel( 'Name', { exact: true } ).fill( '' );
			await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
			await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
			await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
			expect( await page.evaluate( () =>
				window.settingsTest.getConfiguration().sites[ 0 ]?.displayNameOverride ) ).toBeUndefined();
			await expect( row.locator( '.settings-site-schedule' ) ).toHaveCount( 0 );
			await row.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
			await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
			expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 1 );
			await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
			await expect.poll( () => page.evaluate( () =>
				window.settingsTest.getConfiguration().sites.length ) ).toBe( 0 );
		} );
} );
