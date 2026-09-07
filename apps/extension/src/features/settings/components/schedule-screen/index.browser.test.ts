import { SettingsDestination } from '../../services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { createSettingsBrowserHarness } from '../../utils/browser-test-harness';

const copy = TestEnglishLocalizationBundle.schedule;

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s schedule controls', ( _name, engine ) => {
		const { open, setting } = createSettingsBrowserHarness( engine );

		it( 'validates missing and equal times, retains rejected edits, and saves overnight windows', async () => {
			const page = await open( SettingsDestination.SCHEDULE );
			await page.getByRole( 'radio', { name: copy.customLabel, exact: true } ).click();
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByText( copy.startTimeRequiredError, { exact: true } ).waitFor();
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await page.getByLabel( copy.startTimeLabel, { exact: true } ).fill( '23:00' );
			await page.getByLabel( copy.endTimeLabel, { exact: true } ).fill( '23:00' );
			await page.getByText( copy.equalTimeError, { exact: true } ).waitFor();
			await page.getByLabel( copy.endTimeLabel, { exact: true } ).fill( '01:00' );
			await setting( page, 'rejectSaves', true );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByRole( 'alert' ).waitFor();
			expect( await page.getByLabel( copy.startTimeLabel, { exact: true } ).inputValue() ).toBe( '23:00' );
			await setting( page, 'rejectSaves', false );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByText( copy.savedAnnouncement, { exact: true } ).waitFor();
			const schedule = await page.evaluate( ( scope ) =>
				window.settingsTest.getConfiguration().schedulesByScope[ scope ], DefaultProtectionScopeId );
			expect( schedule ).toMatchObject( { mode: ScheduleMode.CUSTOM, windows: [
				{ weekday: Weekday.MONDAY, startMinute: 1380, endMinute: 1440 },
				{ weekday: Weekday.TUESDAY, startMinute: 0, endMinute: 60 },
			] } );
			await page.close();
		}, 20000 );

		it( 'adds and removes staged windows and returns to the saved mode on Discard', async () => {
			const page = await open( SettingsDestination.SCHEDULE );
			await page.getByRole( 'radio', { name: copy.customLabel, exact: true } ).click();
			await page.getByRole( 'button', { name: copy.addWindow, exact: true } ).click();
			expect( await page.getByLabel( copy.startTimeLabel, { exact: true } ).count() ).toBe( 2 );
			await page.getByRole( 'button', { name: copy.formatRemoveWindowLabel( 2 ), exact: true } ).click();
			expect( await page.getByLabel( copy.startTimeLabel, { exact: true } ).count() ).toBe( 1 );
			await page.getByRole( 'button', { name: copy.discard, exact: true } ).click();
			expect( await page.getByRole( 'radio', { name: copy.alwaysLabel, exact: true } ).isChecked() ).toBe( true );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await page.close();
		} );
	},
);
