import type { TocusColorScheme, TocusPalette } from '../../../../packages/ui/src/types';
import type { Language } from '../../../../apps/extension/src/domains/preferences/types';
import type { ViewportSize } from '@playwright/test';

/**
 * Original production component boundaries captured by the retired browser suite.
 * @since 0.1.0
 */
export const SharedOriginalSurface = {
	APPEARANCE: 'appearance',
	APPEARANCE_STEP: 'appearance-step',
	LANGUAGE_STEP: 'language-step',
	NOTICES: 'notices',
} as const;

/**
 * Original component boundary inferred from the runtime fixture catalog.
 * @since 0.1.0
 */
export type SharedOriginalSurface = typeof SharedOriginalSurface[keyof typeof SharedOriginalSurface];

/**
 * Original notice-fixture radio values.
 * @since 0.1.0
 */
export const OriginalNoticeChoice = { MANUAL: 'manual', AUTOMATIC: 'automatic' } as const;

/**
 * Radio values inferred from the fixture catalog.
 * @since 0.1.0
 */
export type OriginalNoticeChoice = typeof OriginalNoticeChoice[keyof typeof OriginalNoticeChoice];

/**
 * Exact original capture inputs without screenshot-specific production branches.
 * @since 0.1.0
 */
export interface SharedOriginalCase {
	path: string;
	surface: SharedOriginalSurface;
	scheme: TocusColorScheme;
	palette: TocusPalette;
	language?: Language;
	viewport: ViewportSize;
	width: string;
}
