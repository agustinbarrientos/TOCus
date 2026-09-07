import type { Messages } from '@lingui/core';
import type { WebsiteCatalog } from '../../localization/types';
import type { DemoChapter } from '../product-demo/types';

/**
 * Localized captions and scroll state for the single browser illustration.
 * @since 0.1.0
 */
export interface ProductStoryProps {
	catalog: Readonly<WebsiteCatalog>;
	languageTag: string;
	messages: Messages;
	chapter: DemoChapter;
	progress: number;
	enhanced: boolean;
}
