/**
 * Established wordmark scales shared by extension surfaces and miniature previews.
 * @since 0.1.0
 */
export const BrandSize = {
	STANDARD: 'standard',
	LARGE: 'large',
	HERO: 'hero',
	MINIATURE: 'miniature',
} as const;

/**
 * Wordmark scale inferred from the single runtime catalog.
 * @since 0.1.0
 */
export type BrandSize = ( typeof BrandSize )[ keyof typeof BrandSize ];

/**
 * Wordmark presentation.
 * @since 0.1.0
 */
export interface BrandProps {
	className?: string;
	size?: BrandSize;
}
