/**
 * Production surface mounted by the browser presentation fixture.
 * @since 0.1.0
 */
export const PresentationSurface = {
	ONBOARDING: 'onboarding',
	POPUP: 'popup',
} as const;

/**
 * Available browser fixture surfaces.
 * @since 0.1.0
 */
export type PresentationSurface = typeof PresentationSurface[ keyof typeof PresentationSurface ];

/**
 * Storage outcomes injected at the onboarding preference boundary.
 * @since 0.1.0
 */
export const PreferenceSaveScenario = {
	PENDING: 'pending',
	REJECT: 'reject',
	NULL: 'null',
	MISSING_LANGUAGE: 'missing-language',
	MISSING_EDITOR: 'missing-editor',
} as const;

/**
 * Preference failure or pending scenario selected by the browser test.
 * @since 0.1.0
 */
export type PreferenceSaveScenario = typeof PreferenceSaveScenario[ keyof typeof PreferenceSaveScenario ];

/**
 * Permission-release outcomes injected after a saved website is removed.
 * @since 0.1.0
 */
export const SiteRemovalScenario = {
	PENDING: 'pending',
	REJECT: 'reject',
	RETAINED: 'retained',
} as const;

/**
 * Website-removal scenario selected by the browser test.
 * @since 0.1.0
 */
export type SiteRemovalScenario = typeof SiteRemovalScenario[ keyof typeof SiteRemovalScenario ];

/**
 * Enrollment outcomes injected into the final onboarding consent operation.
 * @since 0.1.0
 */
export const SiteBatchScenario = {
	PENDING: 'pending',
	SUCCESS: 'success',
	REJECT: 'reject',
} as const;

/**
 * Batch-enrollment scenario selected by the browser test.
 * @since 0.1.0
 */
export type SiteBatchScenario = typeof SiteBatchScenario[ keyof typeof SiteBatchScenario ];

/**
 * Fixture-only signals that settle explicitly held asynchronous boundaries.
 * @since 0.1.0
 */
export const PresentationFixtureEvent = {
	SETTLE_SAVE: 'fixture-settle-save',
	SETTLE_REMOVE: 'fixture-settle-remove',
	SETTLE_BATCH: 'fixture-settle-batch',
} as const;

/**
 * Deterministic fixture settlement event.
 * @since 0.1.0
 */
export type PresentationFixtureEvent = typeof PresentationFixtureEvent[ keyof typeof PresentationFixtureEvent ];
