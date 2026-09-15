import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';
import { ScheduleSaveErrorReason } from './types';
import { LoadState } from '../recovery/types';
import {
	Stack,
} from '@tocus/ui';
import {
	DraftActions,
} from '../draft-actions';
import {
	Feedback,
} from '../feedback';
import {
	Page,
} from '../page';
import {
	Recovery,
} from '../recovery';
import {
	useScheduleState,
} from '../../services/schedule-screen-state';
import {
	WeeklyScheduleEditor,
} from '../weekly-schedule-editor';
import type {
	EditableSettingsScreenProps,
} from '../page/types';
import { BehaviorChoices } from '../behavior-choices';
import './style.scss';


/**
 * Edits a weekly schedule with explicit save/discard and contextual field guidance.
 * @param props - Canonical localized copy, configuration editor and draft registration.
 * @return Schedule destination with consistent page composition.
 * @since 0.1.0
 */
export function ScheduleScreen( props: EditableSettingsScreenProps ) {
	const copy = props.shell.scheduleCopy;
	const state = useScheduleState( props );
	const { draft, value, saving, error, status, validate } = state;
	const errorMessage = error === ScheduleSaveErrorReason.INVALID_SCHEDULE ? copy.invalidScheduleError
		: error === ScheduleSaveErrorReason.SCOPE_NOT_FOUND ? copy.scopeNotFoundError
			: error === ScheduleSaveErrorReason.INVALID_CONFIGURATION
				? copy.invalidConfigurationError : error ? copy.saveError : null;
	return (
		<Page title={ copy.title }>
			<Recovery status={ status } copy={ copy } retry={ () => {
				void state.load();
			} } />
			{ status === LoadState.READY && <form aria-label={ copy.title }
				onSubmit={ ( event ) => {
					event.preventDefault(); void state.save();
				} }>
				<Stack gap={ 0 } className="settings-schedule-form">
					<BehaviorChoices label={ copy.scheduleLegend } name="schedule-mode"
						value={ value.mode } onChange={ state.changeMode } disabled={ saving } options={ [
							{ value: ScheduleMode.ALWAYS, label: copy.alwaysLabel,
								description: copy.alwaysDescription },
							{ value: ScheduleMode.CUSTOM, label: copy.customLabel,
								description: copy.customDescription },
						] } />
					{ value.mode === ScheduleMode.CUSTOM && <section className="settings-schedule-windows">
						<h2>{ copy.windowsLegend }</h2>
						<WeeklyScheduleEditor idPrefix="global" copy={ copy } windows={ value.windows }
							disabled={ saving } validate={ validate } onChange={ ( windows ) => {
								draft.change( { ...value, windows } );
							} } />
					</section> }
					<Feedback error={ errorMessage } />
					<DraftActions draft={ draft } copy={ copy } onSave={ state.save } onDiscard={ state.discard } />
				</Stack>
			</form> }
		</Page>
	);
}
