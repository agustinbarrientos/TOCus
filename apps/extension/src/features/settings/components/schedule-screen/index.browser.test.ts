import { expect } from '@playwright/test';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { test } from '../../utils/browser-test-harness';

test.describe( 'schedule controls', () => {
	test( 'validates missing and equal times, retains rejected edits, and saves overnight windows', async ( { open, setting } ) => {
		test.setTimeout( 20000 );
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByText( 'Choose a start time.', { exact: true } ).waitFor();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByLabel( 'Start', { exact: true } ).fill( '23:00' );
		await page.getByLabel( 'End', { exact: true } ).fill( '23:00' );
		await page.getByText( 'Start and end time must be different.', { exact: true } ).waitFor();
		await page.getByLabel( 'End', { exact: true } ).fill( '01:00' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByRole( 'alert' ).waitFor();
		expect( await page.getByLabel( 'Start', { exact: true } ).inputValue() ).toBe( '23:00' );
		await setting( page, 'rejectSaves', false );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await page.getByText( 'Schedule saved.', { exact: true } ).waitFor();
		const schedule = await page.evaluate( () => window.settingsTest.getConfiguration().schedule );
		expect( schedule ).toMatchObject( { mode: ScheduleMode.CUSTOM, windows: [
			{ weekday: Weekday.MONDAY, startMinute: 1380, endMinute: 1440 },
			{ weekday: Weekday.TUESDAY, startMinute: 0, endMinute: 60 },
		] } );
	} );

	test( 'adds and removes staged windows and returns to the saved mode on Discard', async ( { open } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: /^Remove time window/ } ) ).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Add time window', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: /^Remove time window/ } ) ).toHaveCount( 2 );
		await expect( page.getByRole( 'button', { name: 'Remove time window 2', exact: true } ).locator( 'svg' ) )
			.toHaveCount( 1 );
		expect( await page.getByLabel( 'Start', { exact: true } ).count() ).toBe( 2 );
		await page.getByRole( 'button', { name: 'Remove time window 2', exact: true } ).click();
		expect( await page.getByLabel( 'Start', { exact: true } ).count() ).toBe( 1 );
		await expect( page.getByRole( 'button', { name: /^Remove time window/ } ) ).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		expect( await page.getByRole( 'radio', { name: 'All the time', exact: true } ).isChecked() ).toBe( true );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );
} );
