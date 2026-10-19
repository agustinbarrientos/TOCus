/**
 * Neutral directions supported by statistics trend labels and icons.
 * @since 1.1.0
 */
export const StatisticsChangeDirection = {
	UP: 'up',
	DOWN: 'down',
	SAME: 'same',
} as const;

/**
 * Direction of a change without judging either result.
 * @since 1.1.0
 */
export type StatisticsChangeDirection = typeof StatisticsChangeDirection[keyof typeof StatisticsChangeDirection];

/**
 * Neutral difference between two known recorded metric values.
 * @since 1.1.0
 */
export interface StatisticsChange {
	direction: StatisticsChangeDirection;
	difference: number;
	percentage: number | null;
}
