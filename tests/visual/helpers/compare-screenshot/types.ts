import type { PngComparisonOptions } from '../../originals/helpers/compare-png/types';

/**
 * Selects exact/edge-guarded pixels or an explicit Playwright perceived-color threshold.
 * @since 0.1.0
 */
export interface ScreenshotComparisonOptions extends PngComparisonOptions {
	threshold?: number;
}
