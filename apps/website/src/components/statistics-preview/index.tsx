import { useMemo } from 'react';
import { setupI18n } from '@lingui/core';
import { Brand } from '@tocus/ui';
import { StatisticsSummary } from '../../../../extension/src/features/statistics/components/settings-screen';
import {
	StatisticsProjectionStatus, type AvailableStatisticsProjection,
} from '../../../../extension/src/domains/statistics/types/statistics-projection';
import { createStatisticsCopy } from '../../../../extension/src/localization/utils/create-statistics-copy';
import { createLocalizationFormatters } from '../../../../extension/src/localization/utils/create-localization-formatters';
import type { StatisticsPreviewProps } from './types';

/** Illustrative totals: 12 reconsidered visits at five minutes each, plus eight minutes pausing. */
const ExampleStatistics = Object.freeze( {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: ( 12 * 5 + 8 ) * 60_000,
	focusedPauseMilliseconds: 8 * 60_000,
	reconsideredVisitCount: 12,
	completedWaitCount: 24,
	allowanceGrantedCount: 18,
} ) satisfies AvailableStatisticsProjection;

/**
 * Renders the actual statistics presentation without persistence or analytics.
 * @param props - Packaged product translations and example label.
 * @return Read-only illustrative statistics.
 * @since 0.1.0
 */
export function StatisticsPreview( props: StatisticsPreviewProps ) {
	const { languageTag, messages, label } = props;
	const copy = useMemo( () => createStatisticsCopy(
		setupI18n( { locale: languageTag, messages: { [ languageTag ]: messages } } ),
		createLocalizationFormatters( languageTag ),
	), [ languageTag, messages ] );
	return <div className="statistics-preview">
		<div className="statistics-preview-header">
			<Brand />
			<span>{ label }</span>
		</div>
		<StatisticsSummary copy={ copy } projection={ ExampleStatistics } />
	</div>;
}
