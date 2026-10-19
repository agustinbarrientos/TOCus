import { TestEmptyProtectionConfiguration } from '../../../../protection/types/__fixtures__/protection-configuration';
import { ProtectionConfigurationDocumentSchema } from '../../../../protection/types/protected-site-configuration';
import { DefaultPreferencesDocument, Language, Palette, ThemeMode } from '../../../../preferences/types';
import { createMockActiveStatisticsDocument } from '../../../../statistics/types/__fixtures__/statistics-document';
import type { BackupSource } from '..';
import { LocalDateSchema } from '../../../../protection/types/protection-value';

/**
 * Builds nondefault settings and aggregate history containing a live source allowance.
 * @return Independent source values for portable backup tests.
 * @since 1.1.0
 */
export function createBackupSource(): BackupSource {
	const statistics = createMockActiveStatisticsDocument();
	statistics.firstRecordedDate = LocalDateSchema.parse( '2026-10-15' );
	statistics.dailyTotals = [ {
		date: LocalDateSchema.parse( '2026-10-15' ),
		estimatedReclaimedMilliseconds: 120_000, focusedPauseMilliseconds: 20_000,
		reconsideredVisitCount: 3, completedWaitCount: 5, allowanceGrantedCount: 4,
	}, {
		date: LocalDateSchema.parse( '2026-10-16' ),
		estimatedReclaimedMilliseconds: 180_000, focusedPauseMilliseconds: 30_000,
		reconsideredVisitCount: 4, completedWaitCount: 7, allowanceGrantedCount: 6,
	} ];
	const scope = statistics.scopes.scope_default;
	if ( ! scope ) {
		throw new Error( 'Missing fixture scope.' );
	}
	scope.totals = {
		estimatedReclaimedMilliseconds: 300_000, focusedPauseMilliseconds: 50_000,
		reconsideredVisitCount: 7, completedWaitCount: 12, allowanceGrantedCount: 10,
	};
	return {
		configuration: ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			timingConfiguration: { ...TestEmptyProtectionConfiguration.timingConfiguration,
				initialWaitMilliseconds: 20_000 },
			sites: [ {
				identityHost: 'youtube.com',
				rule: { host: 'youtube.com', includeSubdomains: true, scopeId: 'scope_default' },
				displayNameOverride: 'Video feed',
				schedule: { mode: 'custom', windows: [ { weekday: 'Monday', startMinute: 540, endMinute: 1_020 } ] },
			} ],
		} ),
		preferences: { ...DefaultPreferencesDocument, theme: ThemeMode.DARK, palette: Palette.GREEN,
			language: Language.SPANISH_VOS },
		statistics,
		extensionVersion: '1.1.0', exportedAt: '2026-10-17T12:00:00.000Z',
	};
}

/**
 * Builds coarse historical outcomes, including a website no longer configured.
 * @return Independent aggregate-only values without an event log or destination URL.
 * @since 1.1.0
 */
export function createBackupVisitOutcomes() {
	return {
		recordedFromDate: LocalDateSchema.parse( '2026-10-15' ),
		dailySites: [ {
			date: LocalDateSchema.parse( '2026-10-15' ), siteHost: 'archived.example',
			reconsideredVisitCount: 1, visitedAfterPauseCount: 1,
		}, {
			date: LocalDateSchema.parse( '2026-10-16' ), siteHost: 'youtube.com',
			reconsideredVisitCount: 2, visitedAfterPauseCount: 3,
		} ],
		dailyHours: [
			{ date: LocalDateSchema.parse( '2026-10-15' ), hour: 0, reconsideredVisitCount: 1 },
			{ date: LocalDateSchema.parse( '2026-10-16' ), hour: 23, reconsideredVisitCount: 2 },
		],
	};
}
