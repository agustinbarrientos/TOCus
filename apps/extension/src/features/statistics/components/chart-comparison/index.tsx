import { VisuallyHidden } from '@tocus/ui';
import type { ChartComparisonLegendProps, ChartComparisonMarkerProps, ChartComparisonTooltipProps } from './types';
import './style.scss';

/**
 * Distinguishes periods using the same solid and dashed circles as the chart tooltip.
 * @param props - Whether the mark represents the previous period.
 * @return Decorative period marker.
 * @since 1.1.0
 */
export function ChartComparisonMarker( props: ChartComparisonMarkerProps ) {
	return <svg className="settings-statistics-comparison-marker" viewBox="0 0 16 16" aria-hidden="true">
		<circle cx="8" cy="8" r="5.5" fill={ props.previous ? 'none' : 'currentColor' }
			stroke="currentColor" strokeWidth="1.5" strokeDasharray={ props.previous ? '2 2' : undefined } />
	</svg>;
}

/**
 * Labels both periods using their exact inclusive dates.
 * @param props - Localized names and dates from the selected comparison.
 * @return Solid and dashed chart legend.
 * @since 1.1.0
 */
export function ChartComparisonLegend( props: ChartComparisonLegendProps ) {
	return <div className="settings-statistics-comparison-legend">
		<span><ChartComparisonMarker /><span>
			<VisuallyHidden>{ props.currentLabel }{ ' ' }</VisuallyHidden>{ props.currentDates }</span></span>
		<span><ChartComparisonMarker previous /><span>
			<VisuallyHidden>{ props.previousLabel }{ ' ' }</VisuallyHidden>{ props.previousDates }</span></span>
	</div>;
}

/**
 * Keeps exact matched intervals available from pointer and keyboard chart selection.
 * @param props - Active chart selection and already-formatted period values.
 * @return Comparable values with accessible solid and dashed period markers.
 * @since 1.1.0
 */
export function ChartComparisonTooltip( props: ChartComparisonTooltipProps ) {
	if ( ! props.active || props.rows.length === 0 ) {
		return null;
	}
	return <div className="settings-statistics-chart-tooltip settings-statistics-comparison-tooltip">
		{ props.heading !== undefined && <strong>{ props.heading }</strong> }
		{ props.rows.map( ( row ) => <div key={ row.period } className="settings-statistics-comparison-tooltip-row">
			<ChartComparisonMarker previous={ row.period === 'previous' } />
			<div><span>{ row.label }</span><span>{ row.dates }</span></div><strong>{ row.value }</strong>
		</div> ) }
	</div>;
}
