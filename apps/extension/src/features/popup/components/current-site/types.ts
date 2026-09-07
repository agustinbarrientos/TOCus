import type { PopupActions, PopupShellCopy, PopupState } from '../shell/types';
import type { PopupActiveScope } from '../../types/popup-projection';
import type { PopupIdentifiedCurrentSite } from '../../utils/popup-presentation/types';

/**
 * Current-site presentation with validated identity and related active timers.
 * @since 0.1.0
 */
export interface PopupCurrentSiteProperties extends Pick<PopupActions, 'onAddSite'> {
	/** Current controller state, including the cached local favicon. */
	state: Readonly<PopupState>;
	/** Complete active-language messages. */
	copy: Readonly<PopupShellCopy>;
	/** Current site with a usable canonical identity. */
	current: PopupIdentifiedCurrentSite;
	/** Background-owned timers, used only for current-scope presentation. */
	scopes: readonly PopupActiveScope[];
}
