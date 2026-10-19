import { Button, Icon, IconName, NativeSelect, Popover, Switch } from '@tocus/ui';
import { StatisticsRange, StatisticsRangeSchema } from '../../utils/select-statistics-range/types';
import type { StatisticsPeriodControlProps } from './types';
import './style.scss';

/**
 * Keeps period selection and its optional comparison in one keyboard-accessible menu.
 * @param props - Selected calendar period and current comparison eligibility.
 * @return Compact period trigger with a labeled selector and comparison switch.
 * @since 1.1.0
 */
export function StatisticsPeriodControl( props: StatisticsPeriodControlProps ) {
	const { copy, range } = props;
	const labels = {
		[ StatisticsRange.CURRENT_WEEK ]: copy.currentWeekTitle,
		[ StatisticsRange.CURRENT_MONTH ]: copy.currentMonthTitle,
		[ StatisticsRange.CURRENT_YEAR ]: copy.currentYearTitle,
		[ StatisticsRange.ALL_TIME ]: copy.allTimeTitle,
	};
	const active = props.canCompare && props.comparison;
	return <Popover position="bottom-end" width="20rem" withinPortal={ false } trapFocus returnFocus
		transitionProps={ { duration: 0 } }>
		<Popover.Target>
			<Button variant="default" radius="var(--tocus-radius-small)"
				className="settings-statistics-period-trigger tocus-button-summary"
				aria-label={ `${ copy.periodLabel }: ${ labels[ range ] }` }
				classNames={ { label: 'tocus-button-summary-label', inner: 'tocus-button-summary-inner' } }
				rightSection={ <Icon name={ IconName.ANGLE_DOWN } /> }>
				<span>{ labels[ range ] }</span>
				{ active && <span className="tocus-button-summary-detail">{ copy.comparisonDetail }</span> }
			</Button>
		</Popover.Target>
		<Popover.Dropdown className="settings-statistics-period-menu" aria-label={ copy.periodLabel }>
			<NativeSelect label={ copy.periodLabel } value={ range }
				data={ Object.entries( labels ).map( ( [ value, label ] ) => ( { value, label } ) ) }
				onChange={ ( event ) => {
					props.onRangeChange( StatisticsRangeSchema.parse( event.currentTarget.value ) );
				} } />
			{ props.canCompare && <Switch size="sm" label={ copy.comparePreviousLabel } checked={ active }
				classNames={ { label: 'settings-statistics-comparison-switch-label' } }
				onChange={ ( event ) => {
					props.onComparisonChange( event.currentTarget.checked );
				} } /> }
		</Popover.Dropdown>
	</Popover>;
}
