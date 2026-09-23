import { Stack, Switch, TextInput } from '@tocus/ui';
import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';
import { blankWindow } from '../../../settings/utils/schedule-draft';
import { WeeklyScheduleEditor } from '../../../settings/components/weekly-schedule-editor';
import type { WebsiteDetailsProps } from './types';

/**
 * Presents optional naming and immediately editable custom active hours.
 * @param props - Complete controlled website details owned by the surrounding form.
 * @return Shared inline fields without persistence side effects.
 * @since 1.0.0
 */
export function WebsiteDetails( props: WebsiteDetailsProps ) {
	const { copy, value } = props;
	return <Stack className="settings-website-details" gap="var(--tocus-space-4)">
		{ props.showName && <TextInput id={ `${ props.idPrefix }-name` } label={ copy.displayNameLabel }
			data-autofocus placeholder={ props.namePlaceholder } value={ value.displayName } maxLength={ 80 }
			disabled={ props.disabled } onChange={ ( event ) => {
				props.onChange( { ...value, displayName: event.currentTarget.value } );
			} } /> }
		<Switch label={ copy.customScheduleLabel } checked={ value.schedule !== null }
			disabled={ props.disabled }
			onChange={ ( event ) => {
				props.onChange( { ...value, schedule: event.currentTarget.checked
					? { mode: ScheduleMode.CUSTOM, windows: [ blankWindow( 0 ) ] } : null } );
			} } />
		{ value.schedule !== null && <WeeklyScheduleEditor idPrefix={ props.idPrefix }
			copy={ props.scheduleCopy }
			windows={ value.schedule.windows } disabled={ props.disabled } validate={ props.validate }
			onChange={ ( windows ) => {
				props.onChange( { ...value, schedule: { mode: ScheduleMode.CUSTOM, windows } } );
			} } /> }
	</Stack>;
}
