import { useId } from 'react';
import { Icon, IconName, Tooltip, VisuallyHidden } from '@tocus/ui';
import { calculateStatisticsChange } from '../../utils/calculate-statistics-change';
import { StatisticsChangeDirection } from '../../utils/calculate-statistics-change/types';
import type { StatisticsTrendTagProps } from './types';
import './style.scss';

/**
 * Describes a metric's direction without judging it as an improvement or decline.
 * @param props - Localized metric and known comparable aggregate periods.
 * @return Neutral trend tag with exact, separately described period values.
 * @since 1.1.0
 */
export function StatisticsTrendTag( props: StatisticsTrendTagProps ) {
	const descriptionId = useId();
	const { copy, currentRange, previousRange } = props;
	const change = calculateStatisticsChange( props.current, props.previous );
	if ( change === null || currentRange.startDate === null || previousRange.startDate === null ) {
		return null;
	}
	const label = copy.formatTrend( change, currentRange.range );
	const icon = change.direction === StatisticsChangeDirection.UP
		? IconName.ARROW_TREND_UP : IconName.ARROW_TREND_DOWN;
	const currentDates = copy.formatDateRange( currentRange.startDate, currentRange.endDate );
	const previousDates = copy.formatDateRange( previousRange.startDate, previousRange.endDate );
	const description = `${ currentDates }: ${ copy.formatCount( props.current ) }\n${ previousDates }: ${ copy.formatCount( props.previous ) }`;
	return <>
		<VisuallyHidden id={ descriptionId }>{ description }</VisuallyHidden>
		<Tooltip label={ description } events={ { hover: true, focus: true, touch: true } }
			multiline maw="24rem" withArrow styles={ { tooltip: { whiteSpace: 'pre-line' } } }>
			<span className="settings-statistics-trend-tag" tabIndex={ 0 } data-direction={ change.direction }
				aria-label={ `${ props.metric }: ${ label }` } aria-describedby={ descriptionId }>
				{ change.direction !== StatisticsChangeDirection.SAME &&
					<Icon name={ icon } /> }
				{ label }
			</span>
		</Tooltip>
	</>;
}
