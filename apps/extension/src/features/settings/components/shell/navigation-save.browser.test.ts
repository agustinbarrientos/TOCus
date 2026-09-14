import { expect } from '@playwright/test';
import { ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'Unsaved navigation Save', () => {
	test( 'saves timing before leaving and locks duplicate decisions during persistence', async ( { open, setting } ) => {
		const page = await open();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await setting( page, 'holdConfigurationWrites', true );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		const save = dialog.getByRole( 'button', { name: 'Save', exact: true } );
		await expect( save ).toBeVisible();
		await save.evaluate( ( button: HTMLButtonElement ) => {
			button.click(); button.click();
		} );
		await expect( dialog.getByRole( 'button', { name: 'Stay', exact: true } ) ).toBeDisabled();
		await expect( dialog.getByRole( 'button', { name: 'Discard', exact: true } ) ).toBeDisabled();
		await expect( dialog.getByRole( 'button', { name: 'Saving', exact: false } ) ).toBeDisabled();
		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeVisible();
		expect( await page.evaluate( () => location.hash ) ).toBe( '#timing' );
		await page.evaluate( () => {
			window.settingsTest.releaseConfigurationWrites();
		} );
		await expect( dialog ).toBeHidden();
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration.initialWaitMilliseconds ) ).toBe( 30000 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'keeps a rejected save and its draft in the dialog until retry succeeds', async ( { open, setting } ) => {
		const page = await open();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( dialog.getByRole( 'alert' ) ).toBeVisible();
		await expect( dialog.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeEnabled();
		expect( await page.evaluate( () => location.hash ) ).toBe( '#timing' );
		expect( await page.getByRole( 'slider', { includeHidden: true } ).first().getAttribute( 'aria-valuenow' ) ).toBe( '30' );
		await setting( page, 'rejectSaves', false );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration.initialWaitMilliseconds ) ).toBe( 30000 );
	} );

	test( 'retains invalid schedule fields without writing or leaving', async ( { open } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( dialog.getByRole( 'alert' ) ).toBeVisible();
		expect( await page.evaluate( () => location.hash ) ).toBe( '#schedule' );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await dialog.getByRole( 'button', { name: 'Stay', exact: true } ).click();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveAttribute( 'aria-invalid', 'true' );
	} );

	test( 'requests website permission from dialog Save and preserves denied drafts', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await page.locator( '#site-address' ).fill( 'example.com' );
		await setting( page, 'denyAccess', true );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( dialog.getByRole( 'alert' ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
		await setting( page, 'denyAccess', false );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ]?.identityHost ) ).toBe( 'example.com' );
		expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	} );

	test( 'saves preferences through Back and Forward without replacing history entries', async ( { open } ) => {
		const page = await open( SettingsDestination.ABOUT );
		await page.getByRole( 'link', { name: 'Appearance', exact: true } ).click();
		await page.getByRole( 'radio', { name: 'Dark', exact: true } ).click();
		await page.evaluate( () => {
			history.back();
		} );
		const dialog = page.getByRole( 'dialog' );
		await expect( dialog ).toBeVisible();
		await expect( page ).toHaveURL( /#appearance$/u );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () => window.settingsTest.getPreferences().theme ) ).toBe( ThemeMode.DARK );
		await page.evaluate( () => {
			history.forward();
		} );
		await expect( page.getByRole( 'radio', { name: 'Dark', exact: true } ) ).toBeChecked();
		await page.getByRole( 'link', { name: 'Pause timing', exact: true } ).click();
		await page.evaluate( () => {
			history.back();
		} );
		await page.getByRole( 'radio', { name: 'Light', exact: true } ).click();
		await page.evaluate( () => {
			history.forward();
		} );
		await expect( dialog ).toBeVisible();
		await expect( page ).toHaveURL( /#appearance$/u );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page ).toHaveURL( /#timing$/u );
		expect( await page.evaluate( () => window.settingsTest.getPreferences().theme ) ).toBe( ThemeMode.LIGHT );
	} );
} );
