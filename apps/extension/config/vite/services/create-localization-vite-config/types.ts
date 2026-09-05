import { type WxtViteConfig } from 'wxt';

/**
 * Vite localization configuration with its plugin pipeline guaranteed.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationViteConfig extends WxtViteConfig {
	plugins: NonNullable<WxtViteConfig[ 'plugins' ]>;
}
