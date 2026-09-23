import type { WebsiteDetailsDraft } from '../../utils/website-draft/types';
import type { ProtectedSiteItemCopy } from '../site-item/types';
import type { ScheduleScreenCopy } from '../../../settings/components/schedule-screen/types';

/**
 * An isolated website draft submitted to its existing page or persistence owner.
 * @since 1.0.0
 */
export interface WebsiteEditorProps {
	opened: boolean;
	idPrefix: string;
	name: string;
	automaticName: string;
	value: WebsiteDetailsDraft;
	copy: ProtectedSiteItemCopy;
	scheduleCopy: ScheduleScreenCopy;
	disabled: boolean;
	error: string | null;
	submitLabel: string;
	onSubmit: ( value: WebsiteDetailsDraft ) => void;
	onCancel: () => void;
}
