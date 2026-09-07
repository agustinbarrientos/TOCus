import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { PrivacyScreenCopy } from '../../../features/settings/components/privacy-screen/types';

/**
 * Creates localized explanations and confirmation messages for local data controls.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized Privacy screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createPrivacyScreenCopy( i18n: I18n ): Readonly<PrivacyScreenCopy> {
	return Object.freeze( {
		title: i18n._( msg`Privacy and local data` ),
		introduction: i18n._( msg`Your data stays on this device. No account, servers, or tracking.` ),
		storedTitle: i18n._( msg`What stays on your device` ),
		storedDescription: i18n._( msg`Your website list, shared or separate timing, schedules, preferences, and statistics.` ),
		statisticsPrivacy: i18n._( msg`Statistics keep counts and durations, not page content or web addresses.` ),
		recoveryPrivacy: i18n._( msg`An active pause may temporarily keep its destination address so you can return to the website.` ),
		permissionsTitle: i18n._( msg`Why TOCus needs browser access` ),
		websitePermission: i18n._( msg`Access to your selected websites lets TOCus show the pause. You choose which websites to allow.` ),
		toolbarPermission: i18n._( msg`Clicking the toolbar icon gives TOCus temporary access to the current website.` ),
		navigationPermission: i18n._( msg`Navigation access notices website changes as they happen, not your saved browsing history.` ),
		localToolsPermission: i18n._( msg`Local storage saves your choices. Scripts and browser rules show the pause. Alarms keep the timing up to date.` ),
		faviconPermission: i18n._( msg`Chrome can supply cached website icons. TOCus does not contact an icon service.` ),
		deniedPermission: i18n._( msg`Without website access, TOCus cannot pause that website. You can change access in your browser's extension settings.` ),
		statisticsTitle: i18n._( msg`Reset statistics` ),
		statisticsDescription: i18n._( msg`Clear your recorded counts and time totals. Your websites and settings stay the same.` ),
		statisticsConfirmationTitle: i18n._( msg`Reset your statistics?` ),
		statisticsConfirmation: i18n._( msg`All recorded counts and time totals will be deleted. This cannot be undone.` ),
		resetStatistics: i18n._( msg`Reset statistics` ),
		allTitle: i18n._( msg`Start fresh` ),
		allDescription: i18n._( msg`Remove all TOCus data and set it up again.` ),
		allConfirmationTitle: i18n._( msg`Reset all TOCus data?` ),
		allConfirmation: i18n._( msg`Your websites, groups, schedules, timing, preferences, active pauses, and statistics will be deleted. Website access will be removed and setup will reopen. This cannot be undone.` ),
		resetAll: i18n._( msg`Reset all TOCus data` ),
		cancel: i18n._( msg`Cancel` ),
		resetting: i18n._( msg`Resetting...` ),
		retry: i18n._( msg`Try again` ),
		resetError: i18n._( msg`TOCus could not finish the reset. Try again to complete it.` ),
		statisticsSuccess: i18n._( msg`Statistics reset. Your websites and settings are unchanged.` ),
		allSuccess: i18n._( msg`All TOCus data reset. Opening setup...` ),
		unavailable: i18n._( msg`Local data controls are unavailable right now.` ),
	} );
}
