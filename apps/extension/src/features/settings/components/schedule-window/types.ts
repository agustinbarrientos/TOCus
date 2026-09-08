import type {
	ScheduleScreenCopy,
} from '../schedule-screen/types';
import type {
	ScheduleWindowDraft,
} from '../../utils/schedule-draft/types';


/**
 * Controlled schedule window and semantic validation state.
 * @since 0.1.0
 */
export interface ScheduleWindowControlProps {
	copy: ScheduleScreenCopy;
	window: ScheduleWindowDraft;
	index: number;
	disabled: boolean;
	removable: boolean;
	validate: boolean;
	onChange: ( update: Partial<ScheduleWindowDraft> ) => void;
	onRemove: () => void;
}
