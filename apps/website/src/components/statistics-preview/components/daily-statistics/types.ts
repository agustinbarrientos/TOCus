import type { SampleDay, StatisticsPreviewProps } from '../../types';

/**
 * Website-owned daily chart records and localized presentation.
 * @since 0.1.0
 */
export interface DailyStatisticsPreviewProps extends StatisticsPreviewProps {
	days: readonly SampleDay[];
}
