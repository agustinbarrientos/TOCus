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
	FieldHelp,
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
	StatisticsSummaryProps, StatisticsSiteIdentity,
} from './types';
import './style.scss';
import { DailyStatistics } from '../daily-statistics';
import { VisitOutcomes } from '../visit-outcomes';
import { ResetSection } from '../../../settings/components/reset-section';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { useId } from 'react';
import { selectStatisticsRange } from '../../utils/select-statistics-range';
import { StatisticsRange, StatisticsRangeSchema } from '../../utils/select-statistics-range/types';


/**
 * Presents the selected calendar period's counts, estimate and recorded breakdowns.
 * @param props - Canonical labels, identities and authoritative aggregates.
 * @return Read-only period summary with independently selectable daily metric.
 * @since 1.0.0
 */
export function StatisticsSummary( props: StatisticsSummaryProps ) {
	const { copy, projection } = props;
	const methodId = useId();
	const [ range, setRange ] = useState<StatisticsRange>( StatisticsRange.CURRENT_WEEK );
	const selected = selectStatisticsRange( projection, range );
	const rangeLabels = {
		[ StatisticsRange.CURRENT_WEEK ]: copy.currentWeekTitle,
		[ StatisticsRange.CURRENT_MONTH ]: copy.currentMonthTitle,
		[ StatisticsRange.ALL_TIME ]: copy.allTimeTitle,
	};
	const metrics = [
		[ copy.reconsideredVisitsLabel, copy.formatCount( selected.totals.reconsideredVisitCount ) ],
		[ copy.completedWaitsLabel, copy.formatCount( selected.totals.completedWaitCount ) ],
	];
	return <section className="settings-statistics-summary">
		<div className="settings-statistics-period">
			<div><h2>{ rangeLabels[ range ] }</h2>
				{ selected.startDate !== null && <p className="settings-statistics-dates">{ copy.formatDateRange( selected.startDate, selected.endDate ) }</p> }
			</div>
			<NativeSelect className="settings-statistics-period-select" label={ copy.periodLabel } value={ range }
				classNames={ { label: 'settings-statistics-period-label', wrapper: 'settings-statistics-period-input' } }
				data={ Object.entries( rangeLabels ).map( ( [ value, label ] ) => ( { value, label } ) ) }
				onChange={ ( event ) => {
					setRange( StatisticsRangeSchema.parse( event.currentTarget.value ) );
				} } />
		</div>
		<dl className="settings-metrics">{ metrics.map( ( [ label, amount ] ) =>
			<div key={ label }><dt>{ label }</dt><dd>{ amount }</dd></div> ) }</dl>
		<div className="settings-statistics-estimate">
			<dl><dt>{ copy.estimatedReclaimedLabel }</dt>
				<dd>{ copy.formatEstimatedDuration( selected.totals.estimatedReclaimedMilliseconds ) }</dd></dl>
			<FieldHelp label={ copy.estimationHelpLabel } descriptionId={ methodId }
				description={ copy.estimationDescription } />
		</div>
		<DailyStatistics copy={ copy } totals={ selected.chartBuckets } />
		{ selected.incompleteHistory && <p className="settings-statistics-coverage">{ copy.incompleteHistory }</p> }
		<VisitOutcomes copy={ copy } breakdowns={ selected.breakdowns }
			{ ...( props.siteIdentities ? { siteIdentities: props.siteIdentities } : {} ) } />
	</section>;
}


/**
 * Displays authoritative local statistics and separately confirmed reset actions.
 * @param props - Current statistics source and complete localized destination content.
 * @return Read-only statistics destination with actionable recovery.
 * @since 1.0.0
 */
export function Statistics( props: SettingsScreenProps ) {
	const { statisticsCopy: copy, statisticsSource: source } = props.shell;
	const { projection, status, confirming, resetting, success, read, setConfirming } = useStatisticsState( source );
	const failure = resolveStatisticsFeedback( status, copy );
	const retryButton = useRef<HTMLButtonElement>( null );
	const [ siteIdentities, setSiteIdentities ] = useState<ReadonlyMap<string, StatisticsSiteIdentity>>( new Map() );
	useEffect( () => {
		let active = true;
		/** Resolves current editable names without loading pages or requesting website access. */
		async function prepareIdentities(): Promise<void> {
			const configuration = await props.shell.editor?.load().catch( () => null );
			const hosts = new Set( projection?.visitOutcomes?.dailySites.map( ( site ) => site.siteHost ) ?? [] );
			const entries = await Promise.all( [ ...hosts ].map( async ( siteHost ) => {
				const configured = configuration?.sites.find( ( site ) => site.rule.host === siteHost );
				const identity = resolveSiteDisplayIdentity( configured ?? { identityHost: siteHost,
					rule: { host: siteHost, includeSubdomains: false, scopeId: DefaultProtectionScopeId } } );
				const host = configured?.identityHost ?? siteHost;
				const provider = props.shell.faviconProvider;
				const favicon = await Promise.resolve().then( () => provider?.resolveSource === undefined
					? provider?.getSource( host ) ?? null : provider.resolveSource( host ) ).catch( () => null );
				return [ siteHost, { name: identity.name, monogram: identity.monogram, favicon } ] as const;
			} ) );
			const identities = new Map<string, StatisticsSiteIdentity>( entries );
			if ( active ) {
				setSiteIdentities( identities );
			}
		}
		void prepareIdentities();
		return () => {
			active = false;
		};
	}, [ projection, props.shell.editor, props.shell.faviconProvider ] );
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
			{ projection && <StatisticsSummary copy={ copy } projection={ projection }
				siteIdentities={ siteIdentities } /> }
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
			{ status === StatisticsLoadState.READY && source && <ResetSection title={ copy.localDataTitle }
				description={ copy.localDataDescription } label={ copy.resetAction } disabled={ resetting }
				onRequest={ requestReset }>{ confirmation }</ResetSection> }
			<Feedback success={ success ? copy.resetSuccess : null } />
		</Page>
	);
}
