import type { RecoveryCopy } from '../recovery/types';
import type { DraftActionCopy } from '../draft-actions/types';
import type { FocusLink } from '../../../../domains/preferences/types';

/**
 * Original shortcut identity and values used to detect changes during a dialog edit.
 * @since 1.1.0
 */
export interface FocusLinkEditSession {
	value: FocusLink;
	original: FocusLink | null;
}

/**
 * Localized controls and recovery messages for the optional pause-screen links.
 * @since 1.1.0
 */
export interface FocusLinksScreenCopy extends RecoveryCopy, DraftActionCopy {
	title: string;
	formLabel: string;
	description: string;
	descriptionDetail: string;
	emptyMessage: string;
	addLink: string;
	cancel: string;
	done: string;
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
