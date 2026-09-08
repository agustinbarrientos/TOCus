/**
 * Media behavior choices submitted by the shared-controls scenario.
 * @since 0.1.0
 */
export const FixtureMediaMode = { MUTE: 'mute', PAUSE: 'pause' } as const;

/**
 * Media behavior inferred from the fixture catalog.
 * @since 0.1.0
 */
export type FixtureMediaMode = ( typeof FixtureMediaMode )[ keyof typeof FixtureMediaMode ];

/**
 * Radio-card choices in the shared selection-state scenario.
 * @since 0.1.0
 */
export const FixtureChoice = { FIRST: 'first', SECOND: 'second' } as const;

/**
 * Radio-card choice inferred from the fixture catalog.
 * @since 0.1.0
 */
export type FixtureChoice = ( typeof FixtureChoice )[ keyof typeof FixtureChoice ];

/**
 * Frequency choices submitted by the shared select scenario.
 * @since 0.1.0
 */
export const FixtureFrequency = { DAILY: 'daily', WEEKLY: 'weekly' } as const;

/**
 * Frequency choice inferred from the fixture catalog.
 * @since 0.1.0
 */
export type FixtureFrequency = ( typeof FixtureFrequency )[ keyof typeof FixtureFrequency ];
