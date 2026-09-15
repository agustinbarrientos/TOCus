/**
 * Decoded image extent in physical pixels, independent of PNG encoding details.
 * @since 0.1.0
 */
export interface PngDimensions {
	width: number;
	height: number;
}

/**
 * Raw RGBA comparison, counting each changed or uncovered pixel position once.
 * @since 0.1.0
 */
export interface PngComparison {
	expected: PngDimensions;
	actual: PngDimensions;
	differingPixels: number;
}
