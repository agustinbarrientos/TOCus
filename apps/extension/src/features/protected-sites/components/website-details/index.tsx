import { useRef } from 'react';
import { TimingControls } from '../../../settings/components/timing-controls';
import { Stack, Switch, TextInput, NativeSelect } from '@tocus/ui';
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
	const { copy, value, inheritedTiming } = props;
	const retainedSchedule = useRef( value.schedule );
	const retainedTiming = useRef( value.timingConfiguration );
	if ( value.schedule !== null ) {
		retainedSchedule.current = value.schedule;
	}
	if ( value.timingConfiguration !== null ) {
		retainedTiming.current = value.timingConfiguration;
	}
	return <Stack className="settings-website-details" gap="var(--tocus-space-4)">
		{ props.showName && <TextInput id={ `${ props.idPrefix }-name` } label={ copy.displayNameLabel }
			data-autofocus placeholder={ props.namePlaceholder } value={ value.displayName } maxLength={ 80 }
			disabled={ props.disabled } onChange={ ( event ) => {
				props.onChange( { ...value, displayName: event.currentTarget.value } );
			} } /> }
		{ props.exception && <NativeSelect id={ `${ props.idPrefix }-behavior` } label={ copy.whenVisitedLabel }
			value={ value.behavior } disabled={ props.disabled } data={ [
				{ value: 'pause', label: copy.pauseLabel ?? '' }, { value: 'allow', label: copy.noPauseLabel ?? '' },
			] } onChange={ ( event ) => {
				props.onChange( { ...value, behavior: event.currentTarget.value === 'allow' ? 'allow' : 'pause' } );
			} } /> }
		<Switch label={ copy.customScheduleLabel } checked={ value.schedule !== null }
			disabled={ props.disabled }
			onChange={ ( event ) => {
				props.onChange( { ...value, schedule: event.currentTarget.checked
					? retainedSchedule.current ?? { mode: ScheduleMode.CUSTOM, windows: [ blankWindow( 0 ) ] }
					: null } );
			} } />
		{ value.schedule !== null && <WeeklyScheduleEditor idPrefix={ props.idPrefix }
			copy={ props.scheduleCopy }
			windows={ value.schedule.windows } disabled={ props.disabled } validate={ props.validate }
			onChange={ ( windows ) => {
				props.onChange( { ...value, schedule: { mode: ScheduleMode.CUSTOM, windows } } );
			} } /> }
		{ props.timingCopy && inheritedTiming && value.behavior !== 'allow' && <>
			<Switch label={ copy.customTimingLabel } checked={ value.timingConfiguration !== null }
				disabled={ props.disabled }
				onChange={ ( event ) => {
					props.onChange( { ...value, timingConfiguration: event.currentTarget.checked
						? retainedTiming.current ?? inheritedTiming : null } );
				} } />
			{ value.timingConfiguration !== null && <Stack className="settings-page" gap={ 0 }>
				<TimingControls copy={ props.timingCopy } value={ value.timingConfiguration }
					disabled={ props.disabled }
					onChange={ ( timingConfiguration ) => {
						props.onChange( { ...value, timingConfiguration } );
					} } />
			</Stack> }
		</> }
	</Stack>;
}
