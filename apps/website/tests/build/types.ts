/**
 * Browser-resolved foreground and background with their measured contrast.
 * @since 0.1.0
 */
export interface ContrastMeasurement {
	background: string;
	foreground: string;
	ratio: number;
}

/**
 * Foreground paint inspected by the real-browser interaction audit.
 * @since 0.1.0
 */
export const ForegroundSource = {
	BOX_SHADOW: 'box-shadow',
	OUTLINE: 'outline',
	TEXT: 'text',
} as const;

/**
 * Foreground paint derived from its runtime catalog.
 * @since 0.1.0
 */
export type ForegroundSource = typeof ForegroundSource[keyof typeof ForegroundSource];

/**
 * Operating-system motion preference used by generated website browser checks.
 * @since 0.1.0 Initial implementation.
 */
export const MotionPreference = {
	NO_PREFERENCE: 'no-preference',
	REDUCE: 'reduce',
} as const;

/**
 * Motion preference derived from its runtime catalog.
 * @since 0.1.0 Initial implementation.
 */
export type MotionPreference = typeof MotionPreference[keyof typeof MotionPreference];

/**
 * Readonly viewport dimensions used to select responsive website behavior.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteViewport {
	/** CSS viewport width in pixels. */
	readonly width: number;
	/** CSS viewport height in pixels. */
	readonly height: number;
}
