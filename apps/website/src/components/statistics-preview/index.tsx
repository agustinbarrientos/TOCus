import { useMemo } from 'react';
import { Brand } from '@tocus/ui';
import { StatisticsSummary } from '../../../../extension/src/features/statistics/components/settings-screen';
import { ExampleStatistics } from './data';
import { createStatisticsPreviewCopy } from './formatting';
import type { StatisticsPreviewProps } from './types';

/**
 * Renders the actual statistics presentation without persistence or analytics.
 * @param props - Packaged product translations and example label.
 * @return Read-only illustrative statistics.
 * @since 0.1.0
 */
export function StatisticsPreview( props: StatisticsPreviewProps ) {
	const { languageTag, messages, label, formatting } = props;
	const copy = useMemo( () => createStatisticsPreviewCopy( { languageTag, messages, label, formatting } ),
		[ languageTag, messages, label, formatting ] );
	return <div className="statistics-preview">
		<div className="statistics-preview-header">
			<Brand />
			<span>{ label }</span>
		</div>
		<StatisticsSummary copy={ copy } projection={ ExampleStatistics } />
	</div>;
}
