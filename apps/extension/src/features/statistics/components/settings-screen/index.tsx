import { StatisticsLoadState } from '../../services/settings-screen-state/types';
import { useEffect, useRef } from 'react';
import { resolveStatisticsFeedback } from '../../utils/resolve-statistics-feedback';
import {
	Alert,
	Button,
	Icon, IconName,
	Paper,
	Group,
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


/**
 * Presents the five approved all-time metrics from a validated projection.
 * @param props - Canonical labels, formatters and authoritative totals.
 * @return Metric definition list with explicit estimation and insufficient-history guidance.
 * @since 0.1.0
 */
export function StatisticsSummary( props: StatisticsSummaryProps ) {
	const { copy, projection } = props;
	const estimated = projection.estimatedReclaimedMilliseconds === null ? copy.notEnoughHistory
		: copy.formatEstimatedDuration( projection.estimatedReclaimedMilliseconds );
	const metrics = [
		[ copy.estimatedReclaimedLabel, estimated ],
		[ copy.focusedPauseLabel, copy.formatDuration( projection.focusedPauseMilliseconds ) ],
		[ copy.reconsideredVisitsLabel, copy.formatCount( projection.reconsideredVisitCount ) ],
		[ copy.completedWaitsLabel, copy.formatCount( projection.completedWaitCount ) ],
		[ copy.allowancesGrantedLabel, copy.formatCount( projection.allowanceGrantedCount ) ],
	];
	const empty = ( projection.estimatedReclaimedMilliseconds ?? 0 ) === 0
		&& projection.focusedPauseMilliseconds === 0 && projection.reconsideredVisitCount === 0
		&& projection.completedWaitCount === 0 && projection.allowanceGrantedCount === 0;
	return (
		<section className="settings-statistics-summary">
			<h2>{ copy.allTimeTitle }</h2>
			{ empty && <p className="settings-statistics-empty">{ copy.emptyMessage }</p> }
			<dl className="settings-metrics">
				{ metrics.map( ( [ label, amount ] ) =>
					<div key={ label }><dt>{ label }</dt><dd>{ amount }</dd></div> ) }
			</dl>
			<p>{ copy.estimationDescription }</p>
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
	const resetButton = <Button color="red" onClick={ requestReset }
		{ ...( failure ? { h: 'auto', mih: '2.75rem', py: 'var(--tocus-space-2)' } : {} ) }
		classNames={ { label: 'settings-statistics-reset-label' } }>{ copy.resetAction }</Button>;
	const confirmation = <Confirmation inline focusConfirm opened={ confirming } title={ copy.resetConfirmationTitle }
		description={ copy.resetConfirmationDescription } cancel={ copy.cancelReset }
		confirm={ resetting ? copy.resetting : copy.confirmReset } pending={ resetting }
		onCancel={ cancelReset } onConfirm={ confirmReset } />;

	return (
		<Page title={ copy.title } eyebrow={ copy.eyebrow } introduction={ copy.introduction }>
			{ status === StatisticsLoadState.LOADING &&
				<Paper component="p" className="settings-statistics-loading" role="status">{ copy.loading }</Paper> }
			{ projection && <StatisticsSummary copy={ copy } projection={ projection } /> }
			{ failure && <Alert color="red" role="alert"
				className="settings-statistics-recovery tocus-notice-recovery"
				classNames={ { wrapper: 'settings-statistics-recovery-layout', body: 'settings-statistics-recovery-body',
					message: 'settings-statistics-recovery-message' } }
				icon={ <Icon name={ IconName.EXCLAMATION } /> }>
				<div className="settings-statistics-recovery-copy"><h2>{ failure.title }</h2><p>{ failure.description }</p></div>
				<Group className="settings-statistics-recovery-actions">
					<Button ref={ retryButton } variant="outline" onClick={ retryRead }>{ copy.retry }</Button>
					{ source && resetButton }
				</Group>
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
