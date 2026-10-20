import type { TimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import type { TimingScreenCopy } from '../../../settings/components/timing-screen/types';
import type { WebsiteDetailsDraft } from '../../utils/website-draft/types';
import type { ProtectedSiteItemCopy } from '../site-item/types';
import type { ScheduleScreenCopy } from '../../../settings/components/schedule-screen/types';

/**
 * Shared add/edit details with explicit schedule, timing and pause behavior.
 * @since 1.0.0
 */
export interface WebsiteDetailsProps {
	idPrefix: string;
	copy: Pick<ProtectedSiteItemCopy,
		'customScheduleLabel' | 'automaticNamePlaceholder' | 'displayNameLabel'> & Partial<Pick<ProtectedSiteItemCopy,
		'customTimingLabel' | 'whenVisitedLabel' | 'pauseLabel' | 'noPauseLabel'>>;
	scheduleCopy: ScheduleScreenCopy;
	value: WebsiteDetailsDraft;
	disabled: boolean;
	validate: boolean;
	showName?: boolean;
	exception?: boolean | undefined;
	timingCopy?: TimingScreenCopy | undefined;
	inheritedTiming?: TimingConfiguration | undefined;
	namePlaceholder?: string;
	onChange: ( details: WebsiteDetailsDraft ) => void;
}
