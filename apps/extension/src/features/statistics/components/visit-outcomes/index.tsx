import { useId } from 'react';
import { Avatar, BarChart, FieldHelp, Group, VisuallyHidden } from '@tocus/ui';
import '@tocus/ui/charts.scss';
import '../../../protected-sites/components/site-item/style.scss';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import type { VisitOutcomesProps } from './types';
import type { DailyStatisticsChartAccessibility } from '../daily-statistics/types';

/**
 * Presents local aggregate outcomes with exact counts and independent recording coverage.
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
	const hasHours = breakdowns.hourlyReconsideredVisits.some( ( hour ) => hour.reconsideredVisitCount > 0 );
	return <section className="settings-statistics-breakdowns" aria-labelledby={ headingId }>
		<div className="settings-statistics-breakdown-title">
			<h2 id={ headingId }>{ copy.visitOutcomesTitle }</h2>
			<FieldHelp label={ copy.visitOutcomesHelpLabel } descriptionId={ methodId }
				description={ copy.visitOutcomesDescription } />
		</div>
		{ breakdowns.recordedFromDate === null ? <p>{ copy.breakdownsUnavailable }</p> : <>
			<div className="settings-statistics-breakdown-grid">
				<section className="settings-statistics-sites" aria-labelledby={ sitesId }>
					<div className="settings-statistics-sites-heading"><h3 id={ sitesId }>{ copy.websiteOutcomesTitle }</h3>
						{ breakdowns.siteOutcomes.length > 0 && <div className="settings-statistics-outcomes-legend" role="group" aria-label={ copy.visitOutcomesLegendLabel }>
							<span>{ copy.reconsideredOutcomeLabel }<span className="settings-statistics-outcome-key settings-statistics-reconsidered-fill" aria-hidden="true" /></span>
							<span>{ copy.visitedAfterPauseLabel }<span className="settings-statistics-outcome-key settings-statistics-continued-fill" aria-hidden="true" /></span>
						</div> }
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
						<BarChart h="15rem" data={ breakdowns.hourlyReconsideredVisits } dataKey="hour" maxBarWidth={ 20 }
							classNames={ { tooltip: 'settings-statistics-chart-tooltip' } }
							series={ [ { name: 'reconsideredVisitCount', label: copy.reconsideredVisitsLabel, color: 'var(--tocus-color-action)' } ] }
							xAxisProps={ { interval: 5, tickFormatter: copy.formatHour } }
							yAxisProps={ { width: 40, allowDecimals: false, tickFormatter: copy.formatCount } }
							valueFormatter={ copy.formatCount }
							barProps={ { isAnimationActive: false, radius: [ 2, 2, 0, 0 ] } }
							barChartProps={ { ...chartAccessibility, accessibilityLayer: true } } />
						<p className="settings-statistics-hour-caption">{ copy.localTimeLabel }</p>
						<VisuallyHidden><table><caption>{ copy.hourlyTitle }</caption>
							<thead><tr><th scope="col">{ copy.hourLabel }</th><th scope="col">{ copy.reconsideredVisitsLabel }</th></tr></thead>
							<tbody>{ breakdowns.hourlyReconsideredVisits.map( ( hour ) => <tr key={ hour.hour }>
								<th scope="row">{ copy.formatHour( hour.hour ) }</th><td>{ copy.formatCount( hour.reconsideredVisitCount ) }</td>
							</tr> ) }</tbody>
						</table></VisuallyHidden>
					</> }
				</section>
			</div>
			{ breakdowns.partialHistory && <p className="settings-statistics-coverage">{ copy.formatBreakdownsRecordedFrom( breakdowns.recordedFromDate ) }</p> }
		</> }
	</section>;
}
