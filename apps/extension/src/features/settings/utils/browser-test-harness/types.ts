import type { Page } from '@playwright/test';
import type { SettingsDestination } from '../../services/settings-navigation/types';
import type { SettingsFixtureControls } from '../../components/shell/__fixtures__/types';
import type { Language } from '../../../../domains/preferences/types';

/**
 * Reusable page setup and typed fault injection for all Settings browser suites.
 * @since 0.1.0
 */
export interface SettingsBrowserHarness {
	open: ( destination?: SettingsDestination, language?: Language ) => Promise<Page>;
	setting: <Key extends keyof SettingsFixtureControls>(
		page: Page,
		name: Key,
		value: SettingsFixtureControls[ Key ],
	) => Promise<void>;
}
