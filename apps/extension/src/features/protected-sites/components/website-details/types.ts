import type { WebsiteDetailsDraft } from '../../utils/website-draft/types';
import type { ProtectedSiteItemCopy } from '../site-item/types';
import type { ScheduleScreenCopy } from '../../../settings/components/schedule-screen/types';

/**
 * Shared add/edit details with schedule-only override semantics.
 * @since 1.0.0
 */
export interface WebsiteDetailsProps {
	idPrefix: string;
	copy: Pick<ProtectedSiteItemCopy,
		'customScheduleLabel' | 'automaticNamePlaceholder' | 'displayNameLabel'>;
	scheduleCopy: ScheduleScreenCopy;
	value: WebsiteDetailsDraft;
	disabled: boolean;
	validate: boolean;
	showName?: boolean;
	namePlaceholder?: string;
	onChange: ( details: WebsiteDetailsDraft ) => void;
}
