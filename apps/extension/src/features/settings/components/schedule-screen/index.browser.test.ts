import { expect } from '@playwright/test';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { test } from '../../utils/browser-test-harness';

test.describe( 'schedule controls', () => {
	test( 'frames weekly rows with rounded edges and keeps Add row compact', async ( { open } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		const add = page.getByRole( 'button', { name: 'Add row', exact: true } );
		await add.click();
		const table = page.getByRole( 'table', { name: 'Active time windows', exact: true } );
		const presentation = await table.evaluate( ( element ) => {
			const frame = element.parentElement;
			const row = element.querySelector( 'tbody tr' );
			if ( ! frame || ! row ) {
				throw new Error( 'Expected framed weekly rows.' );
			}
			const frameStyle = getComputedStyle( frame );
			const rowStyle = getComputedStyle( row );
			return { borderWidth: parseFloat( frameStyle.borderTopWidth ), borderStyle: frameStyle.borderTopStyle,
				borderColor: frameStyle.borderTopColor, radius: parseFloat( frameStyle.borderTopLeftRadius ),
				separatorWidth: parseFloat( rowStyle.borderBottomWidth ), separatorStyle: rowStyle.borderBottomStyle,
				separatorColor: rowStyle.borderBottomColor };
		} );
		expect.soft( presentation.borderWidth ).toBeGreaterThanOrEqual( 1 );
		expect.soft( presentation.borderStyle ).toBe( 'solid' );
		expect.soft( presentation.radius ).toBeGreaterThanOrEqual( 8 );
		expect.soft( presentation.separatorWidth ).toBeGreaterThanOrEqual( 1 );
		expect.soft( presentation.separatorStyle ).toBe( 'solid' );
		expect.soft( presentation.separatorColor ).toBe( presentation.borderColor );
		expect.soft( await add.evaluate( ( element ) => element.getBoundingClientRect().height ) ).toBeLessThan( 36 );
		expect.soft( await add.evaluate( ( element ) =>
			parseFloat( getComputedStyle( element ).paddingInlineStart ) ) ).toBeLessThan( 24 );
	} );
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
		await page.getByText( 'Changes saved.', { exact: true } ).waitFor();
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
		await page.getByRole( 'button', { name: 'Add row', exact: true } ).click();
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
	test( 'keeps weekly rows labeled and usable in a compact table at narrow widths', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		await page.getByRole( 'radio', { name: 'On a weekly schedule', exact: true } ).click();
		const table = page.getByRole( 'table', { name: 'Active time windows', exact: true } );
		await expect( table ).toBeVisible();
		await expect( table.getByRole( 'columnheader', { name: 'Day', exact: true } ) ).toHaveCount( 1 );
		await expect( table.getByRole( 'columnheader', { name: 'Start', exact: true } ) ).toHaveCount( 1 );
		await expect( table.getByRole( 'columnheader', { name: 'End', exact: true } ) ).toHaveCount( 1 );
		const fields = await table.locator( 'select, input' ).evaluateAll( ( elements ) => elements.map( ( element ) => {
			const bounds = element.getBoundingClientRect();
			return { top: bounds.top, height: bounds.height };
		} ) );
		expect( fields.map( ( field ) => field.height ) ).toEqual( [ 48, 48, 48 ] );
		expect( new Set( fields.map( ( field ) => field.top ) ).size ).toBe( 1 );
		await table.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
		await table.getByLabel( 'End', { exact: true } ).fill( '17:00' );
		await page.getByRole( 'button', { name: 'Add row', exact: true } ).click();
		await expect( table.getByRole( 'row', { name: 'Time window 2', exact: true } ) ).toBeVisible();
		await expect( table.getByLabel( 'Start', { exact: true } ).first() ).toHaveValue( '09:00' );
		await page.setViewportSize( { width: 320, height: 844 } );
		const second = table.getByRole( 'row', { name: 'Time window 2', exact: true } );
		await second.getByLabel( 'Day', { exact: true } ).selectOption( Weekday.WEDNESDAY );
		await second.getByLabel( 'Start', { exact: true } ).fill( '18:00' );
		await second.getByLabel( 'End', { exact: true } ).fill( '19:00' );
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		await second.getByRole( 'button', { name: 'Remove time window 2', exact: true } ).click();
		await expect( table.getByLabel( 'Start', { exact: true } ) ).toHaveValue( '09:00' );
		await setting( page, 'holdConfigurationWrites', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( table.getByLabel( 'Day', { exact: true } ) ).toBeDisabled();
		await expect( table.getByLabel( 'Start', { exact: true } ) ).toBeDisabled();
		await expect( table.getByLabel( 'End', { exact: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Add row', exact: true } ) ).toBeDisabled();
		await page.evaluate( () => {
			window.settingsTest.releaseConfigurationWrites();
		} );
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );
} );
