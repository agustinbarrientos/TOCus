import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { Language } from '../../../../domains/preferences/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { createSettingsBrowserHarness } from '../../../settings/utils/browser-test-harness';
import { BrowserLanguageOption } from './types';

const copy = TestEnglishLocalizationBundle.languageScreen;

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s language controls', ( _name, engine ) => {
		const { open, setting } = createSettingsBrowserHarness( engine );

		it( 'aligns the field label with its input and preserves readable helper spacing', async () => {
			const page = await open( SettingsDestination.LANGUAGE );
			const selector = page.getByRole( 'combobox', { name: copy.languageLabel, exact: true } );
			await selector.waitFor();
			const geometry = await selector.evaluate( ( input ) => {
				if ( ! ( input instanceof HTMLSelectElement ) ) {
					throw new Error( 'The language field must preserve its native select semantics.' );
				}
				const label = input.labels[ 0 ];
				const description = input.getAttribute( 'aria-describedby' );
				const helper = description ? document.getElementById( description ) : null;
				if ( ! label || ! helper ) {
					throw new Error( 'The language field requires its accessible label and description.' );
				}
				return {
					alignment: getComputedStyle( label ).textAlign,
					gap: helper.getBoundingClientRect().top - input.getBoundingClientRect().bottom,
				};
			} );
			expect( [ 'start', 'left' ] ).toContain( geometry.alignment );
			expect( geometry.gap ).toBeCloseTo( 8, 1 );
			await page.close();
		} );

		it( 'uses the available narrow form width for Save and Discard', async () => {
			const page = await open( SettingsDestination.LANGUAGE );
			await page.setViewportSize( { width: 420, height: 900 } );
			const save = page.getByRole( 'button', { name: copy.save, exact: true } );
			await save.waitFor();
			const geometry = await save.evaluate( ( button ) => {
				const row = button.parentElement;
				if ( ! row ) {
					throw new Error( 'Save must belong to the shared form actions.' );
				}
				const actions = Array.from( row.querySelectorAll( 'button' ) );
				return {
					available: row.getBoundingClientRect().width,
					used: actions.reduce( ( width, action ) => width + action.getBoundingClientRect().width, 0 )
						+ parseFloat( getComputedStyle( row ).columnGap ),
				};
			} );
			expect( geometry.used ).toBeCloseTo( geometry.available, 1 );
			await page.close();
		} );

		it( 'returns keyboard focus to the native language field after Save and Discard', async () => {
			const page = await open( SettingsDestination.LANGUAGE );
			const selector = page.getByRole( 'combobox', { name: copy.languageLabel, exact: true } );
			await selector.selectOption( Language.JAPANESE );
			await page.getByRole( 'button', { name: copy.discard, exact: true } ).press( 'Enter' );
			await expect.poll( () => selector.evaluate( ( input ) => input === document.activeElement ) ).toBe( true );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await selector.selectOption( Language.JAPANESE );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).press( 'Enter' );
			await expect.poll( () => page.evaluate( () => window.settingsTest.getPreferences().language ) )
				.toBe( Language.JAPANESE );
			await expect.poll( () => selector.evaluate( ( input ) => input === document.activeElement ) ).toBe( true );
			await page.close();
		} );

		it( 'guards navigation while explicit malformed-preference recovery is pending', async () => {
			const page = await open( SettingsDestination.LANGUAGE );
			await page.getByRole( 'combobox', { name: copy.languageLabel, exact: true } ).waitFor();
			await page.evaluate( () => {
				window.settingsTest.malformPreferences();
			} );
			await setting( page, 'holdPreferenceWrites', true );
			await page.getByRole( 'button', { name: copy.restoreDefaults, exact: true } ).click();
			expect( await page.getByRole( 'button', { name: copy.restoreDefaults, exact: true } ).isDisabled() ).toBe( true );
			await page.getByRole( 'link', { name: 'About', exact: true } ).click();
			expect( await page.evaluate( () => location.hash ) ).toBe( '#language' );
			expect( await page.getByRole( 'dialog' ).count() ).toBe( 0 );
			await page.evaluate( () => {
				window.settingsTest.releasePreferenceWrites();
			} );
			await page.getByRole( 'combobox', { name: copy.languageLabel, exact: true } ).waitFor();
			await page.getByRole( 'link', { name: 'About', exact: true } ).click();
			await expect.poll( () => page.evaluate( () => location.hash ) ).toBe( '#about' );
			await page.close();
		}, 20000 );

		it( 'renders every exact locale and persists browser-following as null with explicit Save', async () => {
			const page = await open( SettingsDestination.LANGUAGE );
			const selector = page.getByRole( 'combobox', { name: copy.languageLabel, exact: true } );
			expect( await page.getByRole( 'option' ).count() ).toBe( 11 );
			for ( const language of Object.values( Language ) ) {
				expect( await page.getByRole( 'option', { name: copy.languageLabels[ language ], exact: true } ).count() ).toBe( 1 );
			}
			await selector.selectOption( Language.JAPANESE );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await setting( page, 'rejectSaves', true );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByRole( 'alert' ).waitFor();
			expect( await selector.inputValue() ).toBe( Language.JAPANESE );
			await setting( page, 'rejectSaves', false );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByText( copy.savedAnnouncement, { exact: true } ).waitFor();
			expect( await page.evaluate( () => window.settingsTest.getPreferences().language ) )
				.toBe( Language.JAPANESE );
			await selector.selectOption( BrowserLanguageOption );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await expect.poll( () => page.evaluate( () => window.settingsTest.getPreferences().language ) ).toBeNull();
			await page.close();
		}, 20000 );
	},
);
