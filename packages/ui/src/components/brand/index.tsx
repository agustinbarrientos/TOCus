import brand from '@tocus/theme/icon.svg?raw';
import { BrandSize, type BrandProps } from './types';

/**
 * Supplied local mascot with the accessible TOCus wordmark.
 * @since 1.0.0
 * @param root0 - Brand presentation.
 * @param root0.className - Optional composition class.
 * @param root0.size - Established wordmark scale for the surrounding surface.
 * @return Local brand icon and text.
 */
export function Brand( { className = '', size = BrandSize.STANDARD }: BrandProps ) {
	return <span className={`tocus-brand ${ className }`} data-brand-size={ size }><span aria-hidden="true" className="tocus-brand-icon"
		dangerouslySetInnerHTML={{ __html: brand }} /><span>TOCus</span></span>;
}
