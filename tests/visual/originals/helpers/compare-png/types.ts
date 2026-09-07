/**
 * Decoded image extent in physical pixels, independent of PNG encoding details.
 * @since 0.1.0
 */
export interface PngDimensions {
	width: number;
	height: number;
}

/**
 * Exact RGBA comparison, counting each changed or uncovered pixel position once.
 * @since 0.1.0
 */
export interface ExactPngComparison {
	expected: PngDimensions;
	actual: PngDimensions;
	differingPixels: number;
}
