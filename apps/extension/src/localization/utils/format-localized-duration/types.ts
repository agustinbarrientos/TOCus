/**
 * Stable duration units supported by localized copy.
 * @since 0.1.0 Initial implementation.
 */
export const DurationUnit = {
	SECOND: 'second',
	MINUTE: 'minute',
	HOUR: 'hour',
} as const;

/**
 * Stable duration unit supported by localized copy.
 * @since 0.1.0 Initial implementation.
 */
export type DurationUnit = typeof DurationUnit[ keyof typeof DurationUnit ];
