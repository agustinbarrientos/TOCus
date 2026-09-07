import type {
	PreferencesDocument,
} from '../../../../domains/preferences/types';
import type {
	AppearanceScreenCopy,
} from '../appearance-screen/types';
import type {
	EditableSettingsScreenProps,
} from '../page/types';


/**
 * Selects the subset of preferences owned by one editable destination.
 * @since 0.1.0
 */
export interface PreferencesScreenProps extends EditableSettingsScreenProps {
	language?: boolean;
}


/**
 * Controlled appearance controls specific to the Settings destination.
 * @since 0.1.0
 */
export interface AppearanceSettingsControlsProps {
	copy: AppearanceScreenCopy;
	value: PreferencesDocument;
	disabled: boolean;
	onChange: ( value: PreferencesDocument ) => void;
}
