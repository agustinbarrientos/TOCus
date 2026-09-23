import { useRef, useState } from 'react';
import { Button, Group, Stack, Table, VisuallyHidden } from '@tocus/ui';
import { blankWindow } from '../../utils/schedule-draft';
import { createSchedulePresetWindows } from '../../utils/schedule-presets';
import { SchedulePreset } from '../../utils/schedule-presets/types';
import { Confirmation } from '../confirmation';
import { ScheduleWindowControl } from '../schedule-window';
import type { WeeklyScheduleEditorProps } from './types';
import './style.scss';

/**
 * Presents weekly fields without owning persistence or nesting another form.
 * @param props - Controlled windows, unique ID prefix and localized labels.
 * @return Weekly fields with conditional removal and an explicit add action.
 * @since 1.0.0
 */
export function WeeklyScheduleEditor( props: WeeklyScheduleEditorProps ) {
	const [ confirmingClear, setConfirmingClear ] = useState( false );
	const addButton = useRef<HTMLButtonElement>( null );
	const presets = [
		{ value: SchedulePreset.WEEKDAYS_WORKING_HOURS, label: props.copy.presetWeekdaysWorkingHours },
		{ value: SchedulePreset.WEEKDAYS_ALL_DAY, label: props.copy.presetWeekdaysAllDay },
		{ value: SchedulePreset.WEEKENDS_ALL_DAY, label: props.copy.presetWeekendsAllDay },
	];
	return <Stack gap="var(--tocus-space-3)" className="settings-weekly-editor">
		<Group gap="var(--tocus-space-2)" className="settings-schedule-presets">
			{ presets.map( ( preset ) => <Button key={ preset.value } type="button" size="xs" variant="outline"
				disabled={ props.disabled } onClick={ () => {
					props.onChange( createSchedulePresetWindows( preset.value ) );
				} }>{ preset.label }</Button> ) }
		</Group>
		<div className="settings-weekly-table-scroll">
			<Table className="settings-weekly-table" aria-label={ props.copy.windowsLegend }
				horizontalSpacing="xs" verticalSpacing="xs" borderColor="var(--tocus-color-divider)" withRowBorders>
				<Table.Thead><Table.Tr>
					<Table.Th scope="col">{ props.copy.weekdayLabel }</Table.Th>
					<Table.Th scope="col">{ props.copy.startTimeLabel }</Table.Th>
					<Table.Th scope="col">{ props.copy.endTimeLabel }</Table.Th>
					<Table.Th scope="col" className="settings-schedule-action"><VisuallyHidden>{ props.copy.removeWindow }</VisuallyHidden></Table.Th>
				</Table.Tr></Table.Thead>
				<Table.Tbody>{ props.windows.length === 0 && <Table.Tr><Table.Td colSpan={ 4 }>
					<p className="settings-schedule-empty" role={ props.validate ? 'alert' : undefined }>
						{ props.copy.emptyWindowsMessage }
					</p>
				</Table.Td></Table.Tr> }
				{ props.windows.map( ( window, index ) => <ScheduleWindowControl key={ window.id }
					idPrefix={ props.idPrefix } copy={ props.copy } window={ window } index={ index }
					disabled={ props.disabled } removable={ props.windows.length > 1 } validate={ props.validate }
					onChange={ ( update ) => {
						props.onChange( props.windows.map( ( current ) =>
							current.id === window.id ? { ...current, ...update } : current ) );
					} }
					onRemove={ () => {
						if ( props.windows.length > 1 ) {
							props.onChange( props.windows.filter( ( current ) => current.id !== window.id ) );
						}
					} } /> ) }</Table.Tbody>
			</Table>
		</div>
		<Group gap="var(--tocus-space-2)">
			<Button ref={ addButton } className="settings-schedule-add" type="button" size="xs" variant="outline"
				disabled={ props.disabled } onClick={ () => {
					props.onChange( [ ...props.windows,
						blankWindow( Math.max( -1, ...props.windows.map( ( window ) => window.id ) ) + 1 ) ] );
				} }>{ props.copy.addWindow }</Button>
			<Button type="button" size="xs" variant="outline" color="red"
				disabled={ props.disabled || props.windows.length === 0 } onClick={ () => {
					setConfirmingClear( true );
				} }>{ props.copy.clearWindows }</Button>
		</Group>
		<Confirmation opened={ confirmingClear } title={ props.copy.clearWindowsTitle }
			{ ...( props.windows.length === 0 ? { returnFocusRef: addButton } : {} ) }
			description={ props.copy.clearWindowsDescription } cancel={ props.copy.cancelClearWindows }
			confirm={ props.copy.clearWindows } pending={ props.disabled } onCancel={ () => {
				setConfirmingClear( false );
			} } onConfirm={ () => {
				if ( props.disabled ) {
					return;
				}
				setConfirmingClear( false );
				props.onChange( [] );
			} } />
	</Stack>;
}
