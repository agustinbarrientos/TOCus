import {
	Button,
	NativeSelect as SettingsSelect,
	TextInput,
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


/**
 * Presents one weekly window with local validation and contextual removal.
 * @param props - Controlled window, canonical labels and mutation callbacks.
 * @return Accessible grouped weekday and time inputs.
 * @since 0.1.0
 */
export function ScheduleWindowControl( props: ScheduleWindowControlProps ) {
	const { copy, window, index, disabled, validate } = props;
	const windowId = String( window.id );
	const errors = windowErrors( window, copy );
	const weekdays = Object.values( Weekday ).map( ( weekday ) => ( {
		value: weekday, label: copy.formatWeekday( weekday ),
	} ) );
	return (
		<fieldset disabled={ disabled } className="settings-schedule-window" aria-label={ copy.formatWindowLabel( index + 1 ) }>
			<div className="settings-schedule-field">
				<label htmlFor={ `weekday-${ windowId }` }>{ copy.weekdayLabel }</label>
				<SettingsSelect id={ `weekday-${ windowId }` } data={ weekdays } value={ window.weekday }
					onChange={ ( event ) => {
						props.onChange( { weekday: WeekdaySchema.parse( event.currentTarget.value ) } );
					} } />
			</div>
			<div className="settings-schedule-field">
				<label htmlFor={ `start-${ windowId }` }>{ copy.startTimeLabel }</label>
				<TextInput className="tocus-native-field" id={ `start-${ windowId }` } type="time" value={ window.start }
					classNames={ { input: 'settings-native-input' } }
					aria-describedby={ `start-error-${ windowId }` }
					error={ validate && errors.start !== null } onChange={ ( event ) => {
						props.onChange( { start: event.currentTarget.value, fullDay: false } );
					} } />
				<small id={ `start-error-${ windowId }` } className="settings-schedule-error"
					role={ validate && errors.start ? 'alert' : undefined }>
					{ validate ? errors.start : null }
				</small>
			</div>
			<div className="settings-schedule-field">
				<label htmlFor={ `end-${ windowId }` }>{ copy.endTimeLabel }</label>
				<TextInput className="tocus-native-field" id={ `end-${ windowId }` } type="time" value={ window.end }
					classNames={ { input: 'settings-native-input' } }
					aria-describedby={ `end-error-${ windowId }` }
					error={ validate && errors.end !== null } onChange={ ( event ) => {
						props.onChange( { end: event.currentTarget.value, fullDay: false } );
					} } />
				<small id={ `end-error-${ windowId }` } className="settings-schedule-error"
					role={ validate && errors.end ? 'alert' : undefined }>
					{ validate ? errors.end : null }
				</small>
			</div>
			<Button className="settings-schedule-remove" variant="outline" aria-label={ copy.formatRemoveWindowLabel( index + 1 ) }
				disabled={ disabled || ! props.removable } onClick={ props.onRemove }>{ copy.removeWindow }</Button>
		</fieldset>
	);
}
