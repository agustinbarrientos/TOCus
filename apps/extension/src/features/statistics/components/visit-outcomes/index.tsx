import { useId } from 'react';
import { Avatar, BarChart, FieldHelp, Group, VisuallyHidden } from '@tocus/ui';
import '@tocus/ui/charts.scss';
import '../../../protected-sites/components/site-item/style.scss';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import type { VisitOutcomesProps } from './types';
import type { DailyStatisticsChartAccessibility } from '../daily-statistics/types';
import { ChartComparisonLegend, ChartComparisonTooltip } from '../chart-comparison';
import type { ChartComparisonRow } from '../chart-comparison/types';
import { AllWebsites } from './all-websites';

/**
 * Presents local aggregate outcomes with exact counts and readable local-hour labels.
 * @param props - Selected website outcomes, local-hour counts and localized labels.
 * @return Stacked website list and hourly reconsidered-visit chart.
 * @since 1.1.0
 */
export function VisitOutcomes( props: VisitOutcomesProps ) {
	const { copy, breakdowns } = props;
	const headingId = useId();
	const sitesId = useId();
	const hoursId = useId();
	const methodId = useId();
	const chartAccessibility: DailyStatisticsChartAccessibility = { 'aria-labelledby': hoursId };
	const { currentRange } = props;
	const previousRange = currentRange !== undefined && ! breakdowns.partialHistory &&
		! currentRange.breakdowns.partialHistory && props.previousRange?.breakdowns.partialHistory === false ?
		props.previousRange : undefined;
	const currentDates = currentRange?.startDate === null || currentRange === undefined ? copy.allTimeTitle :
		copy.formatDateRange( currentRange.startDate, currentRange.endDate );
	const previousDates = previousRange === undefined || previousRange.startDate === null ? '' :
		copy.formatDateRange( previousRange.startDate, previousRange.endDate );
	const hasHours = breakdowns.hourlyReconsideredVisits.some( ( hour ) => hour.reconsideredVisitCount > 0 ) ||
		previousRange?.breakdowns.hourlyReconsideredVisits.some( ( hour ) => hour.reconsideredVisitCount > 0 );
	const hourlyData = breakdowns.hourlyReconsideredVisits.map( ( hour ) => ( {
		hour: copy.formatHour( hour.hour ), reconsideredVisitCount: hour.reconsideredVisitCount,
		previousCount: previousRange?.breakdowns.hourlyReconsideredVisits.find( ( previous ) =>
			previous.hour === hour.hour )?.reconsideredVisitCount ?? null,
	} ) );
	return <section className="settings-statistics-breakdowns" aria-labelledby={ headingId }>
		<div className="settings-statistics-breakdown-title">
			<h2 id={ headingId }>{ copy.visitOutcomesTitle }</h2>
			<FieldHelp label={ copy.visitOutcomesHelpLabel } descriptionId={ methodId }
				description={ copy.visitOutcomesDescription } />
		</div>
		{ breakdowns.recordedFromDate === null ? <p>{ copy.breakdownsUnavailable }</p> : <>
			<AllWebsites { ...props } previousRange={ previousRange } />
			<div className="settings-statistics-breakdown-grid">
				<section className="settings-statistics-sites" aria-labelledby={ sitesId }>
					<div className="settings-statistics-sites-heading"><h3 id={ sitesId }>{ copy.websiteOutcomesTitle }</h3>
					</div>
					{ breakdowns.siteOutcomes.length === 0 ? <p className="settings-statistics-empty">{ copy.noVisitOutcomes }</p> :
						<ul className="settings-statistics-site-list" aria-labelledby={ sitesId }>
							{ breakdowns.siteOutcomes.map( ( site ) => {
								const identity = props.siteIdentities?.get( site.siteHost ) ?? {
									...resolveSiteDisplayIdentity( {
										identityHost: site.siteHost, rule: { host: site.siteHost,
											includeSubdomains: false, scopeId: DefaultProtectionScopeId },
									} ), favicon: null };
								return <li key={ site.siteHost } className="settings-site-item" data-site={ site.siteHost }>
									<div className="settings-statistics-site-header">
										<Group className="settings-statistics-site-identity-row" wrap="nowrap" gap="var(--tocus-space-3)">
											<Avatar className="tocus-native-avatar" src={ identity.favicon } size="2.25rem"
												radius="var(--tocus-radius-small)" aria-hidden="true">
												<span className="settings-site-monogram">{ identity.monogram }</span>
											</Avatar>
											<div className="settings-site-identity"><strong className="settings-statistics-site-name">{ identity.name }</strong><p>{ site.siteHost }</p></div>
										</Group>
										<div className="settings-statistics-site-counts">
											<span data-outcome="reconsidered"><strong>{ copy.formatCount( site.reconsideredVisitCount ) }</strong>
												<VisuallyHidden>{ ' ' }{ copy.reconsideredVisitsLabel }</VisuallyHidden>
												<span className="settings-statistics-outcome-key settings-statistics-reconsidered-fill" aria-hidden="true" /></span>
											<span data-outcome="continued"><strong>{ copy.formatCount( site.visitedAfterPauseCount ) }</strong>
												<VisuallyHidden>{ ' ' }{ copy.visitedAfterPauseLabel }</VisuallyHidden>
												<span className="settings-statistics-outcome-key settings-statistics-continued-fill" aria-hidden="true" /></span>
										</div>
									</div>
									<div className="settings-statistics-site-track" aria-hidden="true">
										{ site.reconsideredVisitCount > 0 && <span className="settings-statistics-reconsidered-fill" style={ { flexGrow: site.reconsideredVisitCount } } /> }
										{ site.visitedAfterPauseCount > 0 && <span className="settings-statistics-continued-fill" style={ { flexGrow: site.visitedAfterPauseCount } } /> }
									</div>
								</li>;
							} ) }
						</ul> }
				</section>
				<section className="settings-statistics-hourly" aria-labelledby={ hoursId }>
					<h3 id={ hoursId }>{ copy.hourlyTitle }</h3>
					{ ! hasHours ? <p className="settings-statistics-empty">{ copy.noReconsideredVisits }</p> : <>
						{ previousRange !== undefined && <ChartComparisonLegend currentLabel={ copy.currentPeriodLabel }
							previousLabel={ copy.previousPeriodLabel } currentDates={ currentDates }
							previousDates={ previousDates } /> }
						<BarChart h="15rem" data={ hourlyData } dataKey="hour" maxBarWidth={ 20 }
							classNames={ { tooltip: 'settings-statistics-chart-tooltip' } }
							series={ [ { name: 'reconsideredVisitCount',
								label: previousRange === undefined ?
									copy.reconsideredVisitsLabel : copy.currentPeriodLabel,
								color: 'var(--tocus-color-action)' },
							...( previousRange === undefined ? [] : [ { name: 'previousCount', label: copy.previousPeriodLabel,
								color: 'var(--tocus-color-action)' } ] ) ] }
							xAxisProps={ { interval: 5 } }
							yAxisProps={ { width: 40, allowDecimals: false, tickFormatter: copy.formatCount } }
							valueFormatter={ copy.formatCount }
							tooltipProps={ previousRange === undefined ? {} : {
								/**
								 * Resolves the selected local hour with both exact calendar periods.
								 * @param props - Active keyboard or pointer chart selection.
								 * @param props.active - Whether a value is selected.
								 * @param props.label - Recorded local hour label.
								 * @return Matched recorded hourly values.
								 */
								content: ( { active, label } ) => {
									const hour = hourlyData.find( ( item ) => item.hour === label );
									const rows: ChartComparisonRow[] = hour === undefined ? [] : [ {
										period: 'current', label: copy.currentPeriodLabel, dates: currentDates,
										value: copy.formatCount( hour.reconsideredVisitCount ),
									}, {
										period: 'previous', label: copy.previousPeriodLabel, dates: previousDates,
										value: hour.previousCount === null ? '-' : copy.formatCount( hour.previousCount ),
									} ];
									return <ChartComparisonTooltip active={ active }
										heading={ hour?.hour } rows={ rows } />;
								},
							} }
							barProps={ ( series ) => ( { isAnimationActive: false, radius: [ 2, 2, 0, 0 ],
								...( series.name === 'previousCount' ? {
									fill: 'none', stroke: 'var(--tocus-color-action)', strokeOpacity: 1, strokeWidth: 1.5,
									strokeDasharray: '4 3', pointerEvents: 'all',
								} : {} ),
							} ) }
							barChartProps={ { ...chartAccessibility, accessibilityLayer: true } } />
						<VisuallyHidden><table><caption>{ copy.hourlyTitle }</caption>
							<thead><tr><th scope="col">{ copy.hourLabel }</th>
								<th scope="col">{ previousRange === undefined ? copy.reconsideredVisitsLabel : `${ copy.currentPeriodLabel } - ${ currentDates }` }</th>
								{ previousRange !== undefined && <th scope="col">{ copy.previousPeriodLabel } - { previousDates }</th> }</tr></thead>
							<tbody>{ hourlyData.map( ( hour ) => <tr key={ hour.hour }>
								<th scope="row">{ hour.hour }</th><td>{ copy.formatCount( hour.reconsideredVisitCount ) }</td>
								{ previousRange !== undefined && <td>{ hour.previousCount === null ? '-' : copy.formatCount( hour.previousCount ) }</td> }
							</tr> ) }</tbody>
						</table></VisuallyHidden>
					</> }
				</section>
			</div>
		</> }
	</section>;
}
