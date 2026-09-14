import { Button, Stack } from '@tocus/ui';
import { blankWindow } from '../../utils/schedule-draft';
import { ScheduleWindowControl } from '../schedule-window';
import type { WeeklyScheduleEditorProps } from './types';

/**
 * Presents weekly fields without owning persistence or nesting another form.
 * @param props - Controlled windows, unique ID prefix and localized labels.
 * @return Weekly fields with conditional removal and an explicit add action.
 * @since 0.1.0
 */
export function WeeklyScheduleEditor( props: WeeklyScheduleEditorProps ) {
	return <Stack gap="var(--tocus-space-3)" className="settings-weekly-editor">
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
			} } /> ) }
		<Button className="settings-schedule-add" variant="outline" disabled={ props.disabled }
			onClick={ () => {
				props.onChange( [ ...props.windows,
					blankWindow( Math.max( -1, ...props.windows.map( ( window ) => window.id ) ) + 1 ) ] );
			} }>
			{ props.copy.addWindow }
		</Button>
	</Stack>;
}
