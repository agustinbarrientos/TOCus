import { useState } from 'react';
import { NativeSelect } from '@tocus/ui';
import { selectSampleDays, summarizeSampleDays } from './data';
import { SamplePeriod, type StatisticsPreviewProps } from './types';
import { DailyStatisticsPreview } from './components/daily-statistics';
import './style.scss';

/**
 * Renders website-owned sample statistics with two complete selectable months.
 * @param props - Website translations and server-formatted sample values.
 * @param props.catalog - Translated labels for the illustration.
 * @param props.formatting - Server-formatted dates and metrics.
 * @param props.languageTag - Active locale for dynamic chart ticks.
 * @return A reversible illustration with accessible chart data.
 * @since 0.1.0
 */
export function StatisticsPreview( { catalog, formatting, languageTag }: StatisticsPreviewProps ) {
	const [ period, setPeriod ] = useState<SamplePeriod>( SamplePeriod.ALL );
	const days = selectSampleDays( period );
	const totals = summarizeSampleDays( days );
	const estimate = catalog.statsApproximate.replace( '{time}',
		formatting.durations[ totals.estimatedReclaimedMilliseconds ] ?? '' );
	const labels = {
		[ SamplePeriod.CURRENT_WEEK ]: catalog.statsThisWeek,
		[ SamplePeriod.CURRENT_MONTH ]: catalog.statsThisMonth,
		[ SamplePeriod.ALL ]: catalog.statsAllTime,
	};
	const metrics = [
		[ catalog.statsFocused, formatting.durations[ totals.focusedPauseMilliseconds ] ],
		[ catalog.statsReconsidered, formatting.counts[ totals.reconsideredVisitCount ] ],
		[ catalog.statsCompleted, formatting.counts[ totals.completedWaitCount ] ],
		[ catalog.statsAllowances, formatting.counts[ totals.allowanceGrantedCount ] ],
	];
	return <div className="statistics-preview">
		<header className="statistics-preview-header"><h2>{ catalog.statsTitle }</h2></header>
		<section className="settings-statistics-summary">
			<div className="settings-statistics-period">
				<div><h3>{ labels[ period ] }</h3>
					<p className="statistics-preview-date-range">{ formatting.periodRanges[ period ] }</p></div>
				<NativeSelect label={ catalog.statsPeriod } value={ period }
					data={ Object.entries( labels ).map( ( [ value, label ] ) => ( { value, label } ) ) }
					onChange={ ( event ) => {
						const selected = Object.values( SamplePeriod ).find(
							( value ) => value === event.currentTarget.value );
						if ( selected ) {
							setPeriod( selected );
						}
					} } />
			</div>
			<dl className="settings-statistics-estimate"><div>
				<dt>{ catalog.statsEstimated }</dt>
				<dd>{ estimate }</dd>
			</div></dl>
			<p>{ catalog.statsEstimateDescription }</p>
			<DailyStatisticsPreview days={ days } catalog={ catalog }
				formatting={ formatting } languageTag={ languageTag } />
			<section className="settings-statistics-lifetime">
				<h3>{ labels[ period ] }</h3>
				<dl className="settings-metrics">{ metrics.map( ( [ label, value ] ) =>
					<div key={ label }><dt>{ label }</dt><dd>{ value }</dd></div> ) }</dl>
			</section>
		</section>
	</div>;
}
