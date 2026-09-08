import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';
import { ScheduleSaveErrorReason } from './types';
import { LoadState } from '../recovery/types';
import {
	Button,
	NativeSelect as SettingsSelect,
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
	ScheduleWindowControl,
} from '../schedule-window';
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
	const { draft, value, saving, saved, dirty, error, status, scope, scopes, validate } = state;
	const errorMessage = error === ScheduleSaveErrorReason.INVALID_SCHEDULE ? copy.invalidScheduleError
		: error === ScheduleSaveErrorReason.SCOPE_NOT_FOUND ? copy.scopeNotFoundError
			: error === ScheduleSaveErrorReason.INVALID_CONFIGURATION
				? copy.invalidConfigurationError : error ? copy.saveError : null;
	return (
		<Page title={ copy.title } introduction={ copy.introduction }>
			<Recovery status={ status } copy={ copy } retry={ () => {
				void state.load();
			} } />
			{ status === LoadState.READY && <form aria-label={ copy.title }
				onSubmit={ ( event ) => {
					event.preventDefault(); state.save();
				} }>
				<Stack gap={ 0 } className="settings-schedule-form">
					{ scopes.length > 1 && <div className="settings-schedule-scope">
						<label htmlFor="schedule-scope">{ copy.appliesToLabel }</label>
						<SettingsSelect id="schedule-scope"
							data={ scopes } value={ scope } disabled={ dirty || saving }
							aria-describedby={ dirty ? 'schedule-scope-notice' : undefined } onChange={ ( event ) => {
								state.selectScope( event.currentTarget.value );
							} } />
					</div> }
					<BehaviorChoices label={ copy.scheduleLegend } name="schedule-mode"
						value={ value.mode } onChange={ state.changeMode } disabled={ saving } options={ [
							{ value: ScheduleMode.ALWAYS, label: copy.alwaysLabel,
								description: copy.alwaysDescription },
							{ value: ScheduleMode.CUSTOM, label: copy.customLabel,
								description: copy.customDescription },
						] } />
					{ value.mode === ScheduleMode.CUSTOM && <section className="settings-schedule-windows">
						<h2>{ copy.windowsLegend }</h2>
						<p>{ copy.windowsHelp }</p>
						<Stack gap="var(--tocus-space-3)">
							{ value.windows.map( ( window, index ) => <ScheduleWindowControl key={ window.id }
								copy={ copy } window={ window } index={ index } disabled={ saving }
								removable={ value.windows.length > 1 } validate={ validate }
								onChange={ ( update ) => {
									state.updateWindow( window.id, update );
								} }
								onRemove={ () => {
									state.removeWindow( window.id );
								} } /> ) }
							<Button className="settings-schedule-add" variant="outline"
								disabled={ saving } onClick={ state.addWindow }>{ copy.addWindow }</Button>
						</Stack>
					</section> }
					{ dirty && scopes.length > 1 && <p id="schedule-scope-notice" className="settings-schedule-dirty">
						{ copy.dirtyScopeNotice }
					</p> }
					<Feedback error={ errorMessage } success={ saved ? copy.savedAnnouncement : null } />
					<DraftActions draft={ draft } copy={ copy } onSave={ state.save } />
				</Stack>
			</form> }
		</Page>
	);
}
