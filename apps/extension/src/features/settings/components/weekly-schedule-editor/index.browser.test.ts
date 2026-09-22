import { expect } from '@playwright/test';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'weekly schedule quick actions', () => {
	for ( const preset of [
		{ label: 'Mon - Fri, 9 AM - 5 PM', weekdays: [ Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY,
			Weekday.THURSDAY, Weekday.FRIDAY ], start: '09:00', end: '17:00', startMinute: 540, endMinute: 1020 },
		{ label: 'Mon - Fri, all day', weekdays: [ Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY,
			Weekday.THURSDAY, Weekday.FRIDAY ], start: '00:00', end: '00:00', startMinute: 0, endMinute: 1440 },
		{ label: 'Sat - Sun, all day', weekdays: [ Weekday.SATURDAY, Weekday.SUNDAY ],
			start: '00:00', end: '00:00', startMinute: 0, endMinute: 1440 },
	] ) {
		test( `replaces draft rows with ${ preset.label } and persists only on Save`, async ( { open } ) => {
			const page = await open( SettingsDestination.SCHEDULE );
			await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
			await page.getByLabel( 'Start', { exact: true } ).fill( '18:00' );
			await page.getByLabel( 'End', { exact: true } ).fill( '20:00' );
			await page.getByRole( 'button', { name: preset.label, exact: true } ).click();
			const rows = page.locator( '.settings-weekly-table tbody tr' );
			await expect( rows ).toHaveCount( preset.weekdays.length );
			for ( const [ index, weekday ] of preset.weekdays.entries() ) {
				await expect( rows.nth( index ).getByLabel( 'Day', { exact: true } ) ).toHaveValue( weekday );
				await expect( rows.nth( index ).getByLabel( 'Start', { exact: true } ) ).toHaveValue( preset.start );
				await expect( rows.nth( index ).getByLabel( 'End', { exact: true } ) ).toHaveValue( preset.end );
			}
			if ( preset.endMinute === 1440 ) {
				await expect( page.getByText( 'All day', { exact: true } ) ).toHaveCount( preset.weekdays.length );
			}
			await page.getByRole( 'button', { name: preset.label, exact: true } ).click();
			await expect( rows ).toHaveCount( preset.weekdays.length );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
			await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
			expect( await page.evaluate( () => window.settingsTest.getConfiguration().schedule ) ).toEqual( {
				mode: ScheduleMode.CUSTOM,
				windows: preset.weekdays.map( ( weekday ) => ( {
					weekday, startMinute: preset.startMinute, endMinute: preset.endMinute,
				} ) ),
			} );
		} );
	}

	test( 'requires confirmation to clear rows and retains the saved schedule while the draft is empty', async ( { open } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Mon - Fri, 9 AM - 5 PM', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const saved = await page.evaluate( () => window.settingsTest.getConfiguration().schedule );
		const clear = page.getByRole( 'form', { name: 'Schedule', exact: true } )
			.getByRole( 'button', { name: 'Clear all', exact: true } );
		const confirmation = page.getByRole( 'dialog', { name: 'Clear all schedule rows?', exact: true } );
		await clear.click();
		await expect( confirmation.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeFocused();
		await confirmation.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( confirmation ).toBeHidden();
		await expect( clear ).toBeFocused();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 5 );
		await clear.click();
		await page.keyboard.press( 'Escape' );
		await expect( confirmation ).toBeHidden();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 5 );
		await clear.click();
		await confirmation.getByRole( 'button', { name: 'Clear all', exact: true } ).click();
		await expect( confirmation ).toBeHidden();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 0 );
		await expect( clear ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Add row', exact: true } ) ).toBeFocused();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'alert' ) ).toContainText( 'Add a row or choose a preset before saving.' );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().schedule ) ).toEqual( saved );
		await page.getByRole( 'button', { name: 'Add row', exact: true } ).click();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 1 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 5 );
	} );

	test( 'locks every quick action while a schedule save is pending', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Sat - Sun, all day', exact: true } ).click();
		await setting( page, 'holdConfigurationWrites', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		for ( const name of [ 'Mon - Fri, 9 AM - 5 PM', 'Mon - Fri, all day', 'Sat - Sun, all day', 'Add row', 'Clear all' ] ) {
			await expect( page.getByRole( 'button', { name, exact: true } ) ).toBeDisabled();
		}
		await page.evaluate( () => {
			window.settingsTest.releaseConfigurationWrites();
		} );
		await expect( page.getByRole( 'button', { name: 'Clear all', exact: true } ) ).toBeEnabled();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	for ( const reducedMotion of [ 'reduce', 'no-preference' ] as const ) {
		test( `retains the website dialog and keyboard focus with ${ reducedMotion } motion`, async ( { open, page: browserPage } ) => {
			await browserPage.emulateMedia( { reducedMotion } );
			const page = await open( SettingsDestination.PROTECTED_SITES );
			await page.getByLabel( 'Website address', { exact: true } ).fill( 'chess.com' );
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
			await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
			const editor = page.getByRole( 'dialog', { name: 'Chess.com', exact: true } );
			await editor.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
			await editor.getByRole( 'button', { name: 'Sat - Sun, all day', exact: true } ).click();
			await editor.getByRole( 'button', { name: 'Clear all', exact: true } ).click();
			const confirmation = page.getByRole( 'dialog', { name: 'Clear all schedule rows?', exact: true } );
			await expect( confirmation ).toBeVisible();
			await page.keyboard.press( 'Escape' );
			await expect( confirmation ).toBeHidden();
			await expect( editor ).toBeVisible();
			await expect( editor.getByRole( 'button', { name: 'Clear all', exact: true } ) ).toBeFocused();
			await expect( editor.getByLabel( 'Start', { exact: true } ) ).toHaveCount( 2 );
			await editor.getByRole( 'button', { name: 'Clear all', exact: true } ).click();
			await confirmation.getByRole( 'button', { name: 'Clear all', exact: true } ).click();
			await expect( confirmation ).toBeHidden();
			await expect( editor.getByRole( 'button', { name: 'Add row', exact: true } ) ).toBeFocused();
			await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
			await expect( editor ).toBeVisible();
			await expect( editor.getByRole( 'alert' ) ).toContainText( 'Add a row or choose a preset before saving.' );
			await editor.getByRole( 'button', { name: 'Sat - Sun, all day', exact: true } ).click();
			await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
			await expect( editor ).toBeHidden();
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
			await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
			const configuration = await page.evaluate( () => window.settingsTest.getConfiguration() );
			expect( configuration.schedule ).toEqual( { mode: ScheduleMode.ALWAYS } );
			expect( configuration.sites[ 0 ]?.schedule ).toEqual( {
				mode: ScheduleMode.CUSTOM, windows: [
					{ weekday: Weekday.SATURDAY, startMinute: 0, endMinute: 1440 },
					{ weekday: Weekday.SUNDAY, startMinute: 0, endMinute: 1440 },
				],
			} );
		} );
	}
} );
