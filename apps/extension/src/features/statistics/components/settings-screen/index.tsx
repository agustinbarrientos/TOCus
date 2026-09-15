import { StatisticsLoadState } from '../../services/settings-screen-state/types';
import { useEffect, useRef, useState } from 'react';
import { resolveStatisticsFeedback } from '../../utils/resolve-statistics-feedback';
import {
	Alert,
	Button,
	Icon, IconName,
	Paper,
	Group,
	NativeSelect,
} from '@tocus/ui';
import {
	Confirmation,
} from '../../../settings/components/confirmation';
import {
	Feedback,
} from '../../../settings/components/feedback';
import {
	Page,
} from '../../../settings/components/page';
import {
	useStatisticsState,
} from '../../services/settings-screen-state';
import type {
	SettingsScreenProps,
} from '../../../settings/components/page/types';
import type {
	StatisticsSummaryProps,
} from './types';
import './style.scss';
import { DailyStatistics } from '../daily-statistics';
import { selectStatisticsRange } from '../../utils/select-statistics-range';
import { StatisticsRange, StatisticsRangeSchema } from '../../utils/select-statistics-range/types';


/**
 * Presents all five metrics and the chart for one selected local calendar period.
 * @param props - Canonical labels, formatters and authoritative totals.
 * @return Metric definition list with an explicit estimate and empty-state guidance.
 * @since 0.1.0
 */
export function StatisticsSummary( props: StatisticsSummaryProps ) {
	const { copy, projection } = props;
	const [ range, setRange ] = useState<StatisticsRange>( StatisticsRange.ALL_TIME );
	const selected = selectStatisticsRange( projection, range );
	const rangeLabels = {
		[ StatisticsRange.CURRENT_WEEK ]: copy.currentWeekTitle,
		[ StatisticsRange.CURRENT_MONTH ]: copy.currentMonthTitle,
		[ StatisticsRange.ALL_TIME ]: copy.allTimeTitle,
	};
	const estimated = copy.formatEstimatedDuration( selected.totals.estimatedReclaimedMilliseconds );
	const metrics = [
		[ copy.focusedPauseLabel, copy.formatDuration( selected.totals.focusedPauseMilliseconds ) ],
		[ copy.reconsideredVisitsLabel, copy.formatCount( selected.totals.reconsideredVisitCount ) ],
		[ copy.completedWaitsLabel, copy.formatCount( selected.totals.completedWaitCount ) ],
		[ copy.allowancesGrantedLabel, copy.formatCount( selected.totals.allowanceGrantedCount ) ],
	];
	return (
		<section className="settings-statistics-summary">
			<div className="settings-statistics-period">
				<h2>{ rangeLabels[ range ] }</h2>
				<NativeSelect label={ copy.periodLabel } value={ range }
					data={ Object.entries( rangeLabels ).map( ( [ value, label ] ) => ( { value, label } ) ) }
					onChange={ ( event ) => {
						setRange( StatisticsRangeSchema.parse( event.currentTarget.value ) );
					} } />
			</div>
			<dl className="settings-statistics-estimate"><div>
				<dt>{ copy.estimatedReclaimedLabel }</dt><dd>{ estimated }</dd>
			</div></dl>
			<p>{ copy.estimationDescription }</p>
			<DailyStatistics copy={ copy } totals={ selected.chartBuckets } />
			{ selected.incompleteHistory && <p>{ copy.incompleteHistory }</p> }
			<section className="settings-statistics-lifetime">
				<h3>{ rangeLabels[ range ] }</h3>
				<dl className="settings-metrics">
					{ metrics.map( ( [ label, amount ] ) =>
						<div key={ label }><dt>{ label }</dt><dd>{ amount }</dd></div> ) }
				</dl>
			</section>
		</section>
	);
}


/**
 * Displays authoritative local statistics and separately confirmed reset actions.
 * @param props - Current statistics source and complete localized destination content.
 * @return Read-only statistics destination with actionable recovery.
 * @since 0.1.0
 */
export function Statistics( props: SettingsScreenProps ) {
	const { statisticsCopy: copy, statisticsSource: source } = props.shell;
	const { projection, status, confirming, resetting, success, read, setConfirming } = useStatisticsState( source );
	const failure = resolveStatisticsFeedback( status, copy );
	const retryButton = useRef<HTMLButtonElement>( null );
	useEffect( () => {
		if ( status === StatisticsLoadState.RESET_FAILED ) {
			retryButton.current?.focus();
		}
	}, [ status ] );
	/** Reveals the existing explicit reset decision without changing statistics. */
	function requestReset(): void {
		setConfirming( true );
	}
	/** Dismisses the reset decision without changing statistics. */
	function cancelReset(): void {
		setConfirming( false );
	}
	/** Requests the background-owned reset after explicit confirmation. */
	function confirmReset(): void {
		void read( true );
	}
	/** Retries the authoritative read without substituting fabricated values. */
	function retryRead(): void {
		void read();
	}
	const resetButton = <Button color="red" onClick={ requestReset }>{ copy.resetAction }</Button>;
	const confirmation = <Confirmation inline focusConfirm opened={ confirming } title={ copy.resetConfirmationTitle }
		description={ copy.resetConfirmationDescription } cancel={ copy.cancelReset }
		confirm={ resetting ? copy.resetting : copy.confirmReset } pending={ resetting }
		onCancel={ cancelReset } onConfirm={ confirmReset } />;

	return (
		<Page title={ copy.title }>
			{ status === StatisticsLoadState.LOADING &&
				<Paper component="p" className="settings-statistics-loading" role="status">{ copy.loading }</Paper> }
			{ projection && <StatisticsSummary copy={ copy } projection={ projection } /> }
			{ failure && <Alert color="red" role="alert"
				className="settings-statistics-recovery tocus-alert-actionable"
				icon={ <Icon name={ IconName.CIRCLE_EXCLAMATION } /> }>
				<div className="tocus-alert-layout">
					<div className="tocus-alert-copy"><h2>{ failure.title }</h2><p>{ failure.description }</p></div>
					<Group className="tocus-alert-actions">
						<Button ref={ retryButton } variant="outline" onClick={ retryRead }>{ copy.retry }</Button>
						{ source && resetButton }
					</Group>
				</div>
				{ confirmation }
			</Alert> }
			{ status === StatisticsLoadState.READY && source && <section className="settings-statistics-data">
				<div><h2>{ copy.localDataTitle }</h2>
					<p>{ copy.localDataDescription }</p></div>
				{ resetButton }
				{ confirmation }
			</section> }
			<Feedback success={ success ? copy.resetSuccess : null } />
		</Page>
	);
}
