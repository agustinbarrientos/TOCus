import { useId } from 'react';
import { VisuallyHidden } from '@tocus/ui';
import { addStatisticsValues } from '../../../../domains/statistics/utils/add-statistics-values';
import type { VisitOutcomesProps } from './types';

/**
 * Presents selected recorded outcome counts and proportions across all websites.
 * @param props - Recorded current and eligible previous breakdowns with exact dates.
 * @return Current and previous summary rows with one shared outcome key.
 * @since 1.1.0
 */
export function AllWebsites( props: VisitOutcomesProps ) {
	const headingId = useId();
	const { copy, currentRange, previousRange, breakdowns } = props;
	const periods = [ { key: 'current', label: copy.currentPeriodLabel, range: currentRange, breakdowns },
		...( previousRange === undefined ? [] : [ {
			key: 'previous', label: copy.previousPeriodLabel, range: previousRange, breakdowns: previousRange.breakdowns,
		} ] ),
	].map( ( period ) => ( {
		...period,
		reconsidered: period.breakdowns.siteOutcomes.reduce( ( count, site ) =>
			addStatisticsValues( count, site.reconsideredVisitCount ), 0 ),
		continued: period.breakdowns.siteOutcomes.reduce( ( count, site ) =>
			addStatisticsValues( count, site.visitedAfterPauseCount ), 0 ),
	} ) );
	const hasOutcomes = periods.some( ( period ) => period.reconsidered > 0 || period.continued > 0 );
	return <section className="settings-statistics-all-websites" aria-labelledby={ headingId }>
		<div className="settings-statistics-all-websites-heading"><h3 id={ headingId }>{ copy.allWebsitesTitle }</h3>
			{ hasOutcomes && <div className="settings-statistics-outcomes-legend" role="group" aria-label={ copy.visitOutcomesLegendLabel }>
				<span>{ copy.reconsideredOutcomeLabel }<span className="settings-statistics-outcome-key settings-statistics-reconsidered-fill" aria-hidden="true" /></span>
				<span>{ copy.visitedAfterPauseLabel }<span className="settings-statistics-outcome-key settings-statistics-continued-fill" aria-hidden="true" /></span>
			</div> }
		</div>
		<ul className="settings-statistics-all-websites-periods" aria-label={ copy.allWebsitesLabel }>
			{ periods.map( ( period ) => <li key={ period.key } data-period={ period.key }
				className="settings-statistics-all-websites-period settings-statistics-outcome-summary-row">
				<div className="settings-statistics-all-websites-period-heading">
					<VisuallyHidden>{ period.label }{ ' ' }</VisuallyHidden>
					<strong>{ period.range === undefined ? period.label :
						period.range.startDate === null ? copy.allTimeTitle :
							copy.formatDateRange( period.range.startDate, period.range.endDate ) }</strong>
				</div>
				<div className="settings-statistics-all-websites-counts">
					<span data-outcome="reconsidered"><strong>{ copy.formatCount( period.reconsidered ) }</strong>
						<VisuallyHidden>{ ' ' }{ copy.reconsideredVisitsLabel }</VisuallyHidden>
						<span className="settings-statistics-outcome-key settings-statistics-reconsidered-fill" aria-hidden="true" /></span>
					<span data-outcome="continued"><strong>{ copy.formatCount( period.continued ) }</strong>
						<VisuallyHidden>{ ' ' }{ copy.visitedAfterPauseLabel }</VisuallyHidden>
						<span className="settings-statistics-outcome-key settings-statistics-continued-fill" aria-hidden="true" /></span>
				</div>
				{ period.reconsidered === 0 && period.continued === 0 ? <p className="settings-statistics-all-websites-empty">{ copy.noRecordedOutcomes }</p> :
					<div className="settings-statistics-site-track" aria-hidden="true">
						{ period.reconsidered > 0 && <span className="settings-statistics-reconsidered-fill" style={ { flexGrow: period.reconsidered } } /> }
						{ period.continued > 0 && <span className="settings-statistics-continued-fill" style={ { flexGrow: period.continued } } /> }
					</div> }
			</li> ) }
		</ul>
	</section>;
}
