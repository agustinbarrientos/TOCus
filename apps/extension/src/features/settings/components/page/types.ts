import type {
	ReactNode,
} from 'react';
import type {
	SettingsPageShell,
} from '../../services/settings-page/types';
import type {
	RegisterDraft,
} from '../../utils/draft-controller/types';


/**
 * Services and localized copy for one Settings destination.
 * @since 1.0.0
 */
export interface SettingsScreenProps {
	shell: SettingsPageShell;
}


/**
 * Shared dependencies for editable destinations.
 * @since 1.0.0
 */
export interface EditableSettingsScreenProps extends SettingsScreenProps {
	register: RegisterDraft;
}


/**
 * Consistent document hierarchy around destination content.
 * @since 1.0.0
 */
export interface SettingsPageProps {
	title: string;
	headerContent?: ReactNode;
	children: ReactNode;
}
