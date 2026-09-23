import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SettingsFixtureControls } from '../../components/shell/__fixtures__/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import type { SettingsBrowserHarness } from './types';
import type { Language } from '../../../../domains/preferences/types';

/**
 * Provides Settings helpers using Playwright's isolated page and failure diagnostics.
 * @since 1.0.0
 */
export const test = base.extend<SettingsBrowserHarness>( {
	/**
	 * Binds Settings navigation to the test-scoped page.
	 * @param fixtures - Runner-owned browser fixtures.
	 * @param fixtures.page - Isolated Settings page.
	 * @param use - Runs the case with its Settings opener.
	 */
	open: async ( { page }, use ) => {
		/**
		 * Opens a production Settings destination on the current test page.
		 * @param destination - Initial Settings fragment.
		 * @param language - Locale loaded by the initial fixture navigation.
		 * @return Page ready for screen assertions.
		 */
		async function open(
			destination: SettingsDestination = SettingsDestination.TIMING,
			language?: Language,
		): Promise<Page> {
			const query = language === undefined ? '' : `?language=${ encodeURIComponent( language ) }`;
			await page.goto( `/apps/extension/src/features/settings/components/shell/__fixtures__/${ query }#${ destination }` );
			return page;
		}
		await use( open );
	},
	/**
	 * Provides typed fixture controls without bypassing the production editor.
	 * @param fixtures - Runner-owned browser fixtures.
	 * @param use - Runs the case with its control writer.
	 */
	// Playwright requires object destructuring even when this fixture has no dependencies.
	// eslint-disable-next-line no-empty-pattern
	setting: async ( {}, use ) => {
		/**
		 * Changes a typed browser fixture control.
		 * @template Key - Name of the browser-test control.
		 * @param page - Test-scoped Settings page.
		 * @param name - Fixture control to change.
		 * @param value - Value permitted by that control.
		 * @return Completion of the browser-side update.
		 */
		async function setting<Key extends keyof SettingsFixtureControls>(
			page: Page,
			name: Key,
			value: SettingsFixtureControls[ Key ],
		): Promise<void> {
			await page.evaluate( ( { name, value } ) => {
				Object.assign( window.settingsTest.controls, { [ name ]: value } );
			}, { name, value } );
		}
		await use( setting );
	},
} );
