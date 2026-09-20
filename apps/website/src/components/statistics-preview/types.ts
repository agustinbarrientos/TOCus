import type { WebsiteCatalog } from '../../localization/types';

/**
 * Accessible name forwarded to the chart's SVG.
 * @since 0.1.0
 */
export interface StatisticsChartAccessibility {
	'aria-labelledby': string;
}

/**
 * Website sample metrics, with no production persistence or validation contract.
 * @since 0.1.0
 */
export interface SampleTotals {
	estimatedReclaimedMilliseconds: number;
	focusedPauseMilliseconds: number;
	reconsideredVisitCount: number;
	completedWaitCount: number;
	allowanceGrantedCount: number;
}

/**
 * One calendar day in the website's illustrative dataset.
 * @since 0.1.0
 */
export interface SampleDay extends SampleTotals { date: string; }

/**
 * Available periods in the website illustration.
 * @since 0.1.0
 */
export const SamplePeriod = { CURRENT_WEEK: 'current-week', CURRENT_MONTH: 'current-month', ALL: 'all' } as const;

/**
 * Selected sample period.
 * @since 0.1.0
 */
export type SamplePeriod = typeof SamplePeriod[keyof typeof SamplePeriod];

/**
 * Server-formatted sample values prevent locale differences during hydration.
 * @since 0.1.0
 */
export interface StatisticsPreviewFormatting {
	durations: Readonly<Record<number, string>>;
	counts: Readonly<Record<number, string>>;
	dates: Readonly<Record<string, string>>;
	dateRanges: Readonly<Record<string, string>>;
	periodRanges: Readonly<Record<SamplePeriod, string>>;
}

/**
 * Website-owned copy and serializable sample formatting.
 * @since 0.1.0
 */
export interface StatisticsPreviewProps {
	languageTag: string;
	catalog: Readonly<WebsiteCatalog>;
	formatting: StatisticsPreviewFormatting;
}
