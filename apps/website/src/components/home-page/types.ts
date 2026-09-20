import type { LocalizedHomePageProperties } from '../../localization';
import type { StatisticsPreviewFormatting } from '../statistics-preview/types';

/**
 * Server-rendered marketing copy and serializable packaged product messages.
 * @since 0.1.0
 */
export interface HomePageProps extends LocalizedHomePageProperties {
	/** Serialized values keep SSR metrics stable while the chart hydrates inside the page provider. */
	statisticsFormatting: StatisticsPreviewFormatting;
}
