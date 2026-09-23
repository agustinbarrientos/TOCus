import type axe from 'axe-core';
import type { z } from 'zod';
import type { AvailableStatisticsProjectionSchema } from '../../../../../domains/statistics/types/statistics-projection';
import type { ProtectionConfigurationDocument } from '../../../../../domains/protection/types/protected-site-configuration';
import type { PreferencesDocument } from '../../../../../domains/preferences/types';
import type { ThemeMode, Palette, Language } from '../../../../../domains/preferences/types';

/**
 * Observable counters and failure switches for browser-only Settings scenarios.
 * @since 1.0.0
 */
export interface SettingsFixtureControls {
	rejectSaves: boolean;
	denyAccess: boolean;
	requests: number;
	userActivation: boolean;
	writes: number;
	resetCount: number;
	rejectResets: boolean;
	unavailableStatistics: boolean;
	holdPreferenceWrites: boolean;
	holdConfigurationWrites: boolean;
	malformedPreferences: boolean;
}

/**
 * Typed bridge between Playwright and the mounted production Settings presentation.
 * @since 1.0.0
 */
export interface SettingsFixtureBridge {
	themes: typeof ThemeMode;
	palettes: typeof Palette;
	languages: typeof Language;
	controls: SettingsFixtureControls;
	getConfiguration: () => ProtectionConfigurationDocument;
	getPreferences: () => PreferencesDocument;
	revoke: () => Promise<void>;
	externalPreferences: ( update: Partial<PreferencesDocument> ) => void;
	externalStatistics: ( update: Partial<SettingsFixtureStatistics> ) => void;
	malformPreferences: () => void;
	releasePreferenceWrites: () => void;
	releaseConfigurationWrites: () => void;
}

/**
 * Observable counters supported by the statistics fixture's live-update bridge.
 * @since 1.0.0
 */
export type SettingsFixtureStatistics = Omit<z.input<typeof AvailableStatisticsProjectionSchema>, 'status'>;

declare global {
	/**
	 * Browser fixture instrumentation, unavailable to production entrypoints.
	 * @since 1.0.0
	 */
	interface Window {
		settingsTest: SettingsFixtureBridge;
		axe: typeof axe;
	}
}
