import type { Messages } from '@lingui/core';

/**
 * Translated labels for the five scenes of the product story.
 * @since 0.1.0
 */
export interface ProductDemoCopy {
	label: string;
	chooseTitle: string;
	visitTitle: string;
	siteSelected: string;
	timeLeft: string;
}

/**
 * Serializable website copy and packaged extension translations.
 * @since 0.1.0
 */
export interface ProductDemoProps {
	languageTag: string;
	messages: Messages;
	copy: ProductDemoCopy;
	/** Current scene, controlled by the surrounding scroll story. */
	chapter?: DemoChapter;
	/** Reversible progress within the active chapter, from zero to one. */
	progress?: number;
}

/**
 * Ordered product steps selected by scrolling or the chapter buttons.
 * @since 0.1.0
 */
export const DemoChapter = {
	CHOOSE: 'choose', VISIT: 'visit', PAUSE: 'pause', CONTINUE: 'continue', BROWSE: 'browse',
} as const;

/**
 * Narrative chapter derived from the runtime catalog.
 * @since 0.1.0
 */
export type DemoChapter = typeof DemoChapter[keyof typeof DemoChapter];

/**
 * Packaged thumbnail compositions in the illustrative website feed.
 * @since 0.1.0
 */
export const DemoThumbnail = {
	LANDSCAPE: 'landscape', MUSIC: 'music', PORTRAIT: 'portrait', ARCHITECTURE: 'architecture',
} as const;

/**
 * Decorative browser glyphs drawn on the same 24-unit grid.
 * @since 0.1.0
 */
export const BrowserChromeIconPath = {
	CLOSE: 'M6 6l12 12M18 6 6 18',
	ADD: 'M12 5v14M5 12h14',
	BACK: 'M19 12H5m7-7-7 7 7 7',
	FORWARD: 'M5 12h14m-7-7 7 7-7 7',
	RELOAD: 'M20 4v6h-6m6 0a8 8 0 1 0 0 6',
	MORE: 'M12 5v.01M12 12v.01M12 19v.01',
} as const;

/**
 * One icon path from the decorative browser artwork catalog.
 * @since 0.1.0
 */
export interface BrowserChromeIconProps {
	path: typeof BrowserChromeIconPath[keyof typeof BrowserChromeIconPath];
}

/**
 * The illustrative tab title and local address shown above the demo scene.
 * @since 0.1.0
 */
export interface BrowserChromeProps {
	title: string;
	address: string;
}
