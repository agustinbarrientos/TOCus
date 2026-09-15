import {
	ActionIcon,
	Icon,
	IconName,
	NativeSelect as SettingsSelect,
	Table,
	TextInput,
	VisuallyHidden,
} from '@tocus/ui';
import {
	Weekday,
	WeekdaySchema,
} from '../../../../domains/protection/types/protection-schedule';
import {
	windowErrors,
} from '../../utils/schedule-draft';
import type {
	ScheduleWindowControlProps,
} from './types';
import './style.scss';


/**
 * Presents one weekly window with local validation and contextual removal.
 * @param props - Controlled window, canonical labels and mutation callbacks.
 * @return Accessible weekday and time inputs in one semantic table row.
 * @since 0.1.0
 */
export function ScheduleWindowControl( props: ScheduleWindowControlProps ) {
	const { copy, window, index, disabled, validate } = props;
	const windowId = `${ props.idPrefix }-${ String( window.id ) }`;
	const errors = windowErrors( window, copy );
	const weekdays = Object.values( Weekday ).map( ( weekday ) => ( {
		value: weekday, label: copy.formatWeekday( weekday ),
	} ) );
	return (
		<Table.Tr className="settings-schedule-window" aria-label={ copy.formatWindowLabel( index + 1 ) }>
			<Table.Td>
				<VisuallyHidden><label htmlFor={ `weekday-${ windowId }` }>{ copy.weekdayLabel }</label></VisuallyHidden>
				<SettingsSelect id={ `weekday-${ windowId }` } data={ weekdays } value={ window.weekday } disabled={ disabled }
					onChange={ ( event ) => {
						props.onChange( { weekday: WeekdaySchema.parse( event.currentTarget.value ) } );
					} } />
			</Table.Td>
			<Table.Td>
				<VisuallyHidden><label htmlFor={ `start-${ windowId }` }>{ copy.startTimeLabel }</label></VisuallyHidden>
				<TextInput id={ `start-${ windowId }` } type="time" value={ window.start }
					disabled={ disabled }
					aria-describedby={ `start-error-${ windowId }` }
					error={ validate && errors.start !== null } onChange={ ( event ) => {
						props.onChange( { start: event.currentTarget.value, fullDay: false } );
					} } />
				<small id={ `start-error-${ windowId }` } className="settings-schedule-error"
					role={ validate && errors.start ? 'alert' : undefined }>
					{ validate ? errors.start : null }
				</small>
			</Table.Td>
			<Table.Td>
				<VisuallyHidden><label htmlFor={ `end-${ windowId }` }>{ copy.endTimeLabel }</label></VisuallyHidden>
				<TextInput id={ `end-${ windowId }` } type="time" value={ window.end }
					disabled={ disabled }
					aria-describedby={ `end-error-${ windowId }` }
					error={ validate && errors.end !== null } onChange={ ( event ) => {
						props.onChange( { end: event.currentTarget.value, fullDay: false } );
					} } />
				<small id={ `end-error-${ windowId }` } className="settings-schedule-error"
					role={ validate && errors.end ? 'alert' : undefined }>
					{ validate ? errors.end : null }
				</small>
			</Table.Td>
			<Table.Td className="settings-schedule-action">{ props.removable && <ActionIcon className="settings-schedule-remove" variant="subtle"
				aria-label={ copy.formatRemoveWindowLabel( index + 1 ) } disabled={ disabled }
				onClick={ props.onRemove }>
				<Icon name={ IconName.TRASH } />
			</ActionIcon> }</Table.Td>
		</Table.Tr>
	);
}
