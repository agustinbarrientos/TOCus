/**
 * Period identities shared by comparison chart values and markers.
 * @since 1.1.0
 */
export const ChartComparisonPeriod = { CURRENT: 'current', PREVIOUS: 'previous' } as const;

/**
 * One period's exact interval and formatted chart value.
 * @since 1.1.0
 */
export interface ChartComparisonRow {
	period: typeof ChartComparisonPeriod[ keyof typeof ChartComparisonPeriod ];
	label: string;
	dates: string;
	value: string;
}

/**
 * Decorative marker identifying the previous period with a dashed outline.
 * @since 1.1.0
 */
export interface ChartComparisonMarkerProps {
	previous?: boolean;
}

/**
 * Exact period labels shared by a chart and its accessible data table.
 * @since 1.1.0
 */
export interface ChartComparisonLegendProps {
	currentLabel: string;
	previousLabel: string;
	currentDates: string;
	previousDates: string;
}

/**
 * Selected chart interval supplied by the chart library's pointer or keyboard layer.
 * @since 1.1.0
 */
export interface ChartComparisonTooltipProps {
	active?: boolean;
	heading?: string | undefined;
	rows: readonly ChartComparisonRow[];
}
