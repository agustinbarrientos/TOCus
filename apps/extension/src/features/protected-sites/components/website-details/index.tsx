import { Accordion, Stack, Switch, TextInput } from '@tocus/ui';
import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';
import { blankWindow } from '../../../settings/utils/schedule-draft';
import { WeeklyScheduleEditor } from '../../../settings/components/weekly-schedule-editor';
import { WebsiteDetailsSection, type WebsiteDetailsProps } from './types';

/**
 * Reveals optional naming and immediately editable custom active hours under Advanced.
 * @param props - Complete controlled website details owned by the surrounding form.
 * @return Shared accessible disclosure without persistence side effects.
 * @since 0.1.0
 */
export function WebsiteDetails( props: WebsiteDetailsProps ) {
	const { copy, value } = props;
	return <Accordion className="settings-website-details" defaultValue={ props.initiallyExpanded ? WebsiteDetailsSection.ADVANCED : null }>
		<Accordion.Item value={ WebsiteDetailsSection.ADVANCED }>
			<Accordion.Control disabled={ props.disabled }>{ copy.advancedLabel }</Accordion.Control>
			<Accordion.Panel>
				<Stack gap="var(--tocus-space-4)">
					<TextInput id={ `${ props.idPrefix }-name` } label={ copy.displayNameLabel }
						autoFocus={ props.initiallyExpanded }
						placeholder={ copy.automaticNamePlaceholder } value={ value.displayName } maxLength={ 80 }
						disabled={ props.disabled } onChange={ ( event ) => {
							props.onChange( { ...value, displayName: event.currentTarget.value } );
						} } />
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
				</Stack>
			</Accordion.Panel>
		</Accordion.Item>
	</Accordion>;
}
