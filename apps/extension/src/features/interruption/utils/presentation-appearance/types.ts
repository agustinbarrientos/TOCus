import type { TocusAppearance, TocusPalette } from '@tocus/ui';

/**
 * Validated inherited appearance for an owned screen.
 * @since 0.1.0
 */
export interface PresentationAppearance {
	appearance: TocusAppearance;
	palette: TocusPalette;
}
