import { LoadState } from '../recovery/types';
import {
	Checkbox,
	Stack,
} from '@tocus/ui';
import {
	PauseMode,
} from '../../../../domains/preferences/types';
import {
	AppearanceControls,
} from '../../../preferences/components/appearance-controls';
import {
	LanguageControls,
} from '../../../preferences/components/language-controls';
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
	usePreferencesState,
} from '../../services/preferences-screen-state';
import type {
	AppearanceSettingsControlsProps,
	PreferencesScreenProps,
} from './types';
import { BehaviorChoices } from '../behavior-choices';
import './style.scss';


/**
 * Adds Settings-owned pause-style and accessibility controls to shared appearance choices.
 * @param props - Complete controlled appearance draft and canonical localized labels.
 * @return Theme, palette, pause-style and reduced-motion controls.
 * @since 0.1.0
 */
function AppearanceSettingsControls( props: AppearanceSettingsControlsProps ) {
	const { copy, value, disabled } = props;
	return (
		<>
			<AppearanceControls copy={ copy } theme={ value.theme } palette={ value.palette } disabled={ disabled }
				onChange={ ( update ) => {
					props.onChange( { ...value, ...update } );
				} } />
			<section className="settings-preferences-pause"><BehaviorChoices
				label={ copy.pauseModeLegend } name="pause-mode" value={ value.pauseMode }
				disabled={ disabled } stacked options={ Object.values( PauseMode ).map( ( mode ) => ( {
					value: mode, ...copy.pauseModeOptions[ mode ],
				} ) ) }
				onChange={ ( pauseMode ) => {
					props.onChange( { ...value, pauseMode } );
				} } /></section>
			<fieldset className="settings-preferences-accessibility">
				<legend>{ copy.accessibilityLegend }</legend>
				<Checkbox className="tocus-native-checkbox" label={ copy.reducedMotionLabel }
					description={ copy.reducedMotionDescription }
					name="reduced-motion" checked={ value.reducedMotion } disabled={ disabled }
					onChange={ ( event ) => {
						props.onChange( { ...value, reducedMotion: event.currentTarget.checked } );
					} } />
			</fieldset>
		</>
	);
}


/**
 * Presents either the Language draft or the Appearance draft with consistent recovery and actions.
 * @param props - Canonical destination content and preference editor dependencies.
 * @return Editable preference destination with live preview.
 * @since 0.1.0
 */
export function Preferences( props: PreferencesScreenProps ) {
	const { shell, language = false } = props;
	const copy = language ? shell.languageCopy : shell.appearanceCopy;
	const { draft, value, saving, error, saved, status, recovery, load, save, restore } = usePreferencesState( props );
	const success = saved ? copy.savedAnnouncement : recovery.restored ? copy.restoredAnnouncement : null;

	return (
		<Page title={ copy.title } eyebrow={ copy.eyebrow } introduction={ copy.introduction }>
			<Recovery status={ status } copy={ copy } disabled={ recovery.pending }
				retry={ () => {
					void load();
				} } restore={ () => {
					void restore();
				} } />
			<Feedback error={ recovery.failed ? copy.restoreDefaultsError : null } />
			{ status === LoadState.READY && <form aria-label={ copy.formLabel } aria-busy={ saving }
				onSubmit={ ( event ) => {
					event.preventDefault(); save();
				} }>
				<Stack gap={ 0 }>
					{ language
						? <LanguageControls copy={ shell.languageCopy } value={ value.language }
							browserLanguage={ shell.browserLanguage } disabled={ saving }
							onChange={ ( next ) => {
								draft.change( { ...value, language: next } );
							} } />
						: <AppearanceSettingsControls copy={ shell.appearanceCopy } value={ value }
							disabled={ saving } onChange={ draft.change } /> }
					<Feedback error={ error ? copy.saveError : null } success={ success } />
					<DraftActions draft={ draft } copy={ copy } onSave={ save } />
				</Stack>
			</form> }
		</Page>
	);
}
