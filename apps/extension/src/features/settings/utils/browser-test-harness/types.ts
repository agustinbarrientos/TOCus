import type { Page } from 'playwright';
import type { SettingsFixtureControls } from '../../components/shell/__fixtures__/types';

/**
 * Reusable page setup and typed fault injection for all Settings browser suites.
 * @since 0.1.0
 */
export interface SettingsBrowserHarness {
	open: ( destination?: string ) => Promise<Page>;
	setting: <Key extends keyof SettingsFixtureControls>(
		page: Page,
		name: Key,
		value: SettingsFixtureControls[ Key ],
	) => Promise<void>;
}
