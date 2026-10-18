import type { RecoveryCopy } from '../recovery/types';
import type { DraftActionCopy } from '../draft-actions/types';

/**
 * Localized controls and recovery messages for the optional pause-screen links.
 * @since 1.1.0
 */
export interface FocusLinksScreenCopy extends RecoveryCopy, DraftActionCopy {
	title: string;
	formLabel: string;
	description: string;
	emptyMessage: string;
	addLink: string;
	label: string;
	url: string;
	edit: string;
	remove: string;
	moveUp: string;
	moveDown: string;
	invalidLabel: string;
	invalidUrl: string;
	saveError: string;
	restoreDefaultsError: string;
	restoredAnnouncement: string;
}
