import type { ImgHTMLAttributes } from 'react';

/**
 * Localized description shared by the rendered mascot and its original image.
 * @since 0.1.0
 */
export interface MascotProps {
	alt: string;
	loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
}
