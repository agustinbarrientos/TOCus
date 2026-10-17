import { Fragment } from 'react';
import { ScheduleMode, type NormalizedSchedule } from '../../../../domains/protection/types/protection-schedule';
import type { BackupPreviewProps } from './types';

/**
 * Presents every replacement setting using existing localized labels and formatters.
 * @param props - Validated file and current settings copy.
 * @return Text-only metadata, rules, schedules, preferences and historical totals.
 * @since 1.1.0
 */
export function BackupPreviewContent( props: BackupPreviewProps ) {
	const { shell, backup } = props;
	const copy = shell.privacyCopy;
	const timing = backup.settings.timingConfiguration;
	const appearance = shell.appearanceCopy;
	const statistics = shell.statisticsCopy;
	const preferences = backup.preferences;
	const lastDate = backup.statistics.dailyTotals.at( -1 )?.date;

	/**
	 * Formats a normalized schedule without exposing internal enum values.
	 * @param schedule - Validated global or website schedule.
	 * @return Readable weekday and 24-hour window list.
	 */
	function scheduleText( schedule: NormalizedSchedule ): string {
		return schedule.mode === ScheduleMode.ALWAYS ? shell.scheduleCopy.alwaysLabel
			: schedule.windows.map( ( window ) => `${ shell.scheduleCopy.formatWeekday( window.weekday ) } ` +
				`${ time( window.startMinute ) } - ${ time( window.endMinute ) }` ).join( ', ' );
	}

	/**
	 * Formats minutes from local midnight including the end-of-day boundary.
	 * @param minute - Normalized minute in one day.
	 * @return Readable 24-hour local time.
	 */
	function time( minute: number ): string {
		return `${ String( Math.floor( minute / 60 ) ).padStart( 2, '0' ) }:${ String( minute % 60 ).padStart( 2, '0' ) }`;
	}
	const totals = Object.values( backup.statistics.scopes );
	const values = [
		[ statistics.completedWaitsLabel,
			statistics.formatCount( totals.reduce( ( sum, item ) => sum + item.completedWaitCount, 0 ) ) ],
		[ statistics.reconsideredVisitsLabel,
			statistics.formatCount( totals.reduce( ( sum, item ) => sum + item.reconsideredVisitCount, 0 ) ) ],
		[ statistics.allowancesGrantedLabel,
			statistics.formatCount( totals.reduce( ( sum, item ) => sum + item.allowanceGrantedCount, 0 ) ) ],
		[ statistics.focusedPauseLabel,
			statistics.formatDuration( totals.reduce( ( sum, item ) => sum + item.focusedPauseMilliseconds, 0 ) ) ],
		[ statistics.estimatedReclaimedLabel,
			statistics.formatEstimatedDuration(
				totals.reduce( ( sum, item ) => sum + item.estimatedReclaimedMilliseconds, 0 ),
			) ],
	];
	return <div className="settings-backup-preview">
		<h4>{ copy.backupPreviewTitle }</h4>
		<dl>
			<dt>{ copy.exportedAtLabel }</dt>
			<dd>{ new Date( backup.exportedAt ).toLocaleString( document.documentElement.lang ) }</dd>
			<dt>{ copy.extensionVersionLabel }</dt><dd>{ backup.extensionVersion }</dd>
			<dt>{ copy.dataFormatVersionLabel }</dt><dd>{ backup.dataFormatVersion }</dd>
			<dt>{ copy.websiteCountLabel }</dt><dd>{ statistics.formatCount( backup.settings.sites.length ) }</dd>
		</dl>
		<h4>{ shell.copy.protectedSites }</h4>
		<ul>{ backup.settings.sites.map( ( site ) => <li key={ site.identityHost }>
			<strong>{ site.displayNameOverride ?? site.identityHost }</strong>{ ' ' }({ site.identityHost })
			<p>{ site.rule.host } - { site.rule.includeSubdomains
				? copy.includesSubdomainsLabel : copy.excludesSubdomainsLabel }</p>
			<p>{ site.schedule ? scheduleText( site.schedule ) : copy.inheritedScheduleLabel }</p>
		</li> ) }</ul>
		<h4>{ shell.copy.timing }</h4>
		<p>{ shell.timingCopy.formatSummary( timing.initialWaitMilliseconds / 1_000,
			timing.ladderIncreaseMilliseconds / 1_000,
			timing.maximumWaitMilliseconds / 1_000,
			timing.allowanceMilliseconds / 60_000,
			timing.completionAction ) }</p>
		<h4>{ copy.globalScheduleLabel }</h4><p>{ scheduleText( backup.settings.schedule ) }</p>
		<h4>{ shell.copy.appearance }</h4>
		<dl>
			<dt>{ appearance.themeLegend }</dt><dd>{ appearance.themeOptions[ preferences.theme ].label }</dd>
			<dt>{ appearance.paletteLegend }</dt><dd>{ appearance.paletteLabels[ preferences.palette ] }</dd>
			<dt>{ appearance.pauseModeLegend }</dt>
			<dd>{ appearance.pauseModeOptions[ preferences.pauseMode ].label }</dd>
			<dt>{ shell.languageCopy.languageLabel }</dt>
			<dd>{ preferences.language
				? shell.languageCopy.languageLabels[ preferences.language ]
				: shell.languageCopy.browserLanguageOption }</dd>
		</dl>
		<h4>{ statistics.allTimeTitle }</h4>
		<dl>{ values.map( ( [ label, value ] ) =>
			<Fragment key={ label }><dt>{ label }</dt><dd>{ value }</dd></Fragment> ) }</dl>
		<p>{ copy.historyRangeLabel }: { backup.statistics.firstRecordedDate && lastDate
			? statistics.formatDateRange( backup.statistics.firstRecordedDate, lastDate ) : statistics.dailyEmpty }</p>
	</div>;
}
