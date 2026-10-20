import { getGroupFaviconHosts, resolveGroupFavicon } from '../../../protected-sites/utils/resolve-group-favicon';
import { StatisticsLoadState } from '../../services/settings-screen-state/types';
import { useEffect, useRef, useState } from 'react';
import { resolveStatisticsFeedback } from '../../utils/resolve-statistics-feedback';
import {
	Alert,
	Button,
	Icon, IconName,
	Paper,
	Group,
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
import { getWebsitePresentationGroupHost, resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { useId } from 'react';
import { selectStatisticsRange } from '../../utils/select-statistics-range';
import { StatisticsRange } from '../../utils/select-statistics-range/types';
import { selectStatisticsComparison } from '../../utils/select-statistics-comparison';
import { StatisticsPeriodControl } from '../period-control';
import { StatisticsTrendTag } from '../trend-tag';


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
	const [ compare, setCompare ] = useState( false );
	const selected = selectStatisticsRange( projection, range );
	const comparison = selectStatisticsComparison( projection, range );
	const activeComparison = compare ? comparison : null;
	const rangeLabels = {
		[ StatisticsRange.CURRENT_WEEK ]: copy.currentWeekTitle,
		[ StatisticsRange.CURRENT_MONTH ]: copy.currentMonthTitle,
		[ StatisticsRange.CURRENT_YEAR ]: copy.currentYearTitle,
		[ StatisticsRange.ALL_TIME ]: copy.allTimeTitle,
	};
	const metrics = [
		{ label: copy.reconsideredVisitsLabel, key: 'reconsideredVisitCount' },
		{ label: copy.completedWaitsLabel, key: 'completedWaitCount' },
	] as const;
	return <section className="settings-statistics-summary">
		<div className="settings-statistics-period">
			<div><h2>{ rangeLabels[ range ] }</h2>
				{ selected.startDate !== null && <p className="settings-statistics-dates">{ copy.formatDateRange( selected.startDate, selected.endDate ) }</p> }
			</div>
			<StatisticsPeriodControl copy={ copy } range={ range }
				comparison={ compare } canCompare={ comparison !== null }
				onRangeChange={ setRange } onComparisonChange={ setCompare } />
		</div>
		<dl className="settings-metrics">{ metrics.map( ( { label, key } ) =>
			<div key={ key }><dt>{ label }</dt><dd><span>{ copy.formatCount( selected.totals[ key ] ) }</span>
				{ activeComparison !== null && <StatisticsTrendTag copy={ copy } metric={ label }
					current={ selected.totals[ key ] } previous={ activeComparison.previous.totals[ key ] }
					currentRange={ selected } previousRange={ activeComparison.previous } /> }
			</dd></div> ) }</dl>
		<div className="settings-statistics-estimate">
			<dl><dt>{ copy.estimatedReclaimedLabel }</dt>
				<dd>{ copy.formatEstimatedDuration( selected.totals.estimatedReclaimedMilliseconds ) }</dd></dl>
			<FieldHelp label={ copy.estimationHelpLabel } descriptionId={ methodId }
				description={ copy.estimationDescription } />
		</div>
		<DailyStatistics copy={ copy } totals={ selected.chartBuckets }
			{ ...( activeComparison !== null ? { comparison: activeComparison } : {} ) } />
		{ selected.incompleteHistory && <p className="settings-statistics-coverage">{ copy.incompleteHistory }</p> }
		<VisitOutcomes copy={ copy } breakdowns={ selected.breakdowns } currentRange={ selected }
			{ ...( activeComparison !== null ? { previousRange: activeComparison.previous } : {} ) }
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
				const groupHost = getWebsitePresentationGroupHost( siteHost );
				const members = configuration?.sites.filter( ( site ) =>
					getWebsitePresentationGroupHost( site.rule.host ) === groupHost ) ?? [];
				const configured = members.find( ( site ) => site.rule.host === siteHost &&
					getWebsitePresentationGroupHost( site.identityHost ) === groupHost );
				const identity = resolveSiteDisplayIdentity( configured ?? { identityHost: siteHost,
					rule: { host: siteHost, includeSubdomains: false, scopeId: DefaultProtectionScopeId } } );
				const favicon = await resolveGroupFavicon( props.shell.faviconProvider,
					getGroupFaviconHosts( groupHost,
						[ siteHost, ...members.map( ( member ) => member.identityHost ) ] ) );
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
