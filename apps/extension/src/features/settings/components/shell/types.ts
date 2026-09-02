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
