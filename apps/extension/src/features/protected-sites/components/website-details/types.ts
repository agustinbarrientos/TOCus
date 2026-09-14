import type { WebsiteDetailsDraft } from '../../utils/website-draft/types';
import type { ProtectedSiteItemCopy } from '../site-item/types';
import type { ScheduleScreenCopy } from '../../../settings/components/schedule-screen/types';

/**
 * Supported website details disclosure sections.
 * @since 0.1.0
 */
export const WebsiteDetailsSection = { ADVANCED: 'advanced' } as const;

/**
 * Shared add/edit details with schedule-only override semantics.
 * @since 0.1.0
 */
export interface WebsiteDetailsProps {
	idPrefix: string;
	copy: Pick<ProtectedSiteItemCopy,
		'advancedLabel' | 'customScheduleLabel' | 'automaticNamePlaceholder' | 'displayNameLabel'>;
	scheduleCopy: ScheduleScreenCopy;
	value: WebsiteDetailsDraft;
	disabled: boolean;
	validate: boolean;
	initiallyExpanded?: boolean;
	onChange: ( details: WebsiteDetailsDraft ) => void;
}
