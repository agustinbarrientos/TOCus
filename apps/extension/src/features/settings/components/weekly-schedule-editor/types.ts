import type { ScheduleScreenCopy } from '../schedule-screen/types';
import type { ScheduleWindowDraft } from '../../utils/schedule-draft/types';

/**
 * Controlled weekly fields reusable inside an owning form.
 * @since 0.1.0
 */
export interface WeeklyScheduleEditorProps {
	idPrefix: string;
	copy: ScheduleScreenCopy;
	windows: ScheduleWindowDraft[];
	disabled: boolean;
	validate: boolean;
	onChange: ( windows: ScheduleWindowDraft[] ) => void;
}
