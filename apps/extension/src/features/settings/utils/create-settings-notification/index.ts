import { SnackbarTone, type SnackbarOptions } from '@tocus/ui/types';
import type { SettingsShellCopy } from '../../components/shell/types';
import { SettingsFeedbackAction } from '../../services/settings-feedback/types';

/**
 * Chooses localized feedback and distinguishes completed saves from staged edits.
 * @param action - Confirmed outcome from the owning settings controller.
 * @param copy - Messages in the active settings language.
 * @return Message and semantic tone for the shared notification provider.
 * @since 0.1.0
 */
export function createSettingsNotification(
	action: SettingsFeedbackAction, copy: Readonly<SettingsShellCopy>,
): Readonly<SnackbarOptions> {
	const messages = {
		[ SettingsFeedbackAction.SAVED ]: copy.changesSaved,
		[ SettingsFeedbackAction.DISCARDED ]: copy.changesDiscarded,
		[ SettingsFeedbackAction.SITE_ADDED ]: copy.siteAddedToDraft,
		[ SettingsFeedbackAction.SITE_UPDATED ]: copy.siteUpdatedInDraft,
		[ SettingsFeedbackAction.SITE_REMOVED ]: copy.siteRemovedFromDraft,
		[ SettingsFeedbackAction.SITES_REMOVED ]: copy.sitesRemovedFromDraft,
		[ SettingsFeedbackAction.DUPLICATE_SITE ]: copy.siteAlreadyExists,
	};
	return { message: messages[ action ],
		tone: action === SettingsFeedbackAction.SAVED ? SnackbarTone.SUCCESS : SnackbarTone.INFO };
}
