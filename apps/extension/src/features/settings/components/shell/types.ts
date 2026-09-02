/**
 * Stable browser families supported by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export const SettingsPlatform = {
	CHROME: 'chrome',
	FIREFOX: 'firefox',
	SAFARI: 'safari',
} as const;

/**
 * Browser family whose native visual conventions the settings shell follows.
 * @since 0.1.0 Initial implementation.
 */
export type SettingsPlatform = typeof SettingsPlatform[ keyof typeof SettingsPlatform ];

/**
 * Stable destinations available in extension settings.
 * @since 0.1.0 Initial implementation.
 */
export const SettingsDestination = {
	PROTECTED_SITES: 'protected-sites',
	SCHEDULE: 'schedule',
	TIMING: 'timing',
} as const;

/**
 * Active destination rendered by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export type SettingsDestination = typeof SettingsDestination[ keyof typeof SettingsDestination ];

/**
 * Localizable messages rendered by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsShellCopy {
	navigationLabel: string;
	protectedSites: string;
	schedule: string;
	timing: string;
}

/**
 * Default English messages rendered by the settings shell.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultSettingsShellCopy: Readonly<SettingsShellCopy> = Object.freeze( {
	navigationLabel: 'Settings',
	protectedSites: 'Protected sites',
	schedule: 'Schedule',
	timing: 'Timing',
} );
