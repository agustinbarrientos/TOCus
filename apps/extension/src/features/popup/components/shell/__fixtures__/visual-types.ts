/** Original popup compositions preserved by the component-owned golden images. */
export const PopupVisualScenario = {
	UNLISTED: 'unlisted',
	IDLE: 'idle',
	ACTIVE: 'active',
	UNAVAILABLE: 'unavailable',
	LONG_CONTENT: 'long-content',
} as const;

/** A deterministic original popup state, independent of real browser data. */
export type PopupVisualScenario = typeof PopupVisualScenario[ keyof typeof PopupVisualScenario ];
