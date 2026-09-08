import type {
	ProtectedSiteItemCopy,
} from '../site-item/types';

/**
 * Timing behavior selected by the shared website editor.
 * @since 0.1.0
 */
export const SiteBehaviorMode = {
	SHARED: 'shared',
	INDEPENDENT: 'independent',
} as const;

/**
 * Serialized value consumed by the website behavior choice control.
 * @since 0.1.0
 */
export type SiteBehaviorMode = typeof SiteBehaviorMode[ keyof typeof SiteBehaviorMode ];


/**
 * Reusable site behavior controls for adding and editing a website.
 * @since 0.1.0
 */
export interface SiteBehaviorProps {
	stacked?: boolean;
	copy: Pick<ProtectedSiteItemCopy, 'behaviorLegend' | 'sharedBehavior' | 'sharedBehaviorDescription'
		| 'independentBehavior' | 'independentBehaviorDescription'>;
	name: string;
	independent: boolean;
	disabled: boolean;
	onChange: ( independent: boolean ) => void;
}
