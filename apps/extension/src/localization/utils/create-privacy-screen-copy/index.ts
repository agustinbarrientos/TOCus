import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { PrivacyScreenCopy } from '../../../features/settings/components/privacy-screen/types';

/**
 * Creates localized explanations and confirmation messages for local data controls.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Privacy screen copy.
 * @since 1.0.0 Initial implementation.
 */
export function createPrivacyScreenCopy( i18n: I18n ): Readonly<PrivacyScreenCopy> {
	return Object.freeze( {
		title: i18n._( msg`Privacy and local data` ),
		storedTitle: i18n._( msg`What stays on your device` ),
		storedSummary: i18n._( msg`Absolutely everything.` ),
		storedDescription: i18n._( msg`This includes your website list, pause times, schedules, preferences, and statistics.` ),
		statisticsPrivacy: i18n._( msg`The statistics only keep track of counts and durations. They don't save any page content or web addresses.` ),
		offlinePrivacy: i18n._( msg`TOCus works entirely offline and doesn't track your data on your device.` ),
		recoveryPrivacy: i18n._( msg`If you pause while on a website, the address might be saved for a short time so you can go back to it.` ),
		trustPrivacy: i18n._( msg`You don't have to just take my word for it.` ),
		sourcePrivacy: i18n._( msg`The source code is available on GitHub if you want to check for yourself.` ),
		permissionsTitle: i18n._( msg`Why TOCus needs browser access` ),
		websitePermission: i18n._( msg`TOCus needs access to the websites you choose so it can show the pause. You control which sites to allow.` ),
		toolbarPermission: i18n._( msg`When you click the toolbar icon, TOCus gets access to the website you are currently visiting, but only for a short time, and doesn't send that data anywhere.` ),
		navigationPermission: i18n._( msg`"Navigation access" lets TOCus see changes to websites as they happen, but it doesn't look at your saved browsing history.` ),
		localToolsPermission: i18n._( msg`TOCus saves your choices using local storage. It uses scripts and browser rules to show the pause, and alarms to keep the timing correct.` ),
		faviconPermission: i18n._( msg`Your browser tries to use website icons from its own cache whenever it can. Sometimes this doesn't work. I set it up this way to keep TOCus completely private and avoid connecting to any icon service.` ),
		deniedPermission: i18n._( msg`If TOCus doesn't have access to a website, it can't pause that site. You can update these permissions in your browser's extension settings.` ),
		statisticsTitle: i18n._( msg`Reset statistics` ),
		statisticsDescription: i18n._( msg`Clear your recorded counts and time totals. Your websites and settings stay the same.` ),
		statisticsConfirmationTitle: i18n._( msg`Reset your statistics?` ),
		statisticsConfirmation: i18n._( msg`All recorded counts and time totals will be deleted. This cannot be undone.` ),
		resetStatistics: i18n._( msg`Reset statistics` ),
		allTitle: i18n._( msg`Start fresh` ),
		allDescription: i18n._( msg`Remove all TOCus data and set it up again.` ),
		allConfirmationTitle: i18n._( msg`Reset all TOCus data?` ),
		allConfirmation: i18n._( msg`Your websites, schedules, pause times, preferences, active pauses, and statistics will be erased. The setup will begin again. This can't be reversed.` ),
		resetAll: i18n._( msg`Reset all TOCus data` ),
		cancel: i18n._( msg`Cancel` ),
		resetting: i18n._( msg`Resetting...` ),
		retry: i18n._( msg`Try again` ),
		resetError: i18n._( msg`TOCus could not finish the reset. Try again to complete it.` ),
		statisticsSuccess: i18n._( msg`Statistics reset. Your websites and settings are unchanged.` ),
		allSuccess: i18n._( msg`All TOCus data reset.` ),
		unavailable: i18n._( msg`Local data controls are unavailable right now.` ),
	} );
}
