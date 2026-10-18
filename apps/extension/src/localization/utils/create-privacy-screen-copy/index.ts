import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { PrivacyScreenCopy } from '../../../features/settings/components/privacy-screen/types';

/**
 * Creates localized explanations for local storage and browser access.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete read-only Privacy screen copy.
 * @since 1.0.0 Initial implementation.
 */
export function createPrivacyScreenCopy( i18n: I18n ): Readonly<PrivacyScreenCopy> {
	return Object.freeze( {
		title: i18n._( msg`Privacy` ),
		storedTitle: i18n._( msg`What stays on your device` ),
		storedSummary: i18n._( msg`Absolutely everything.` ),
		storedDescription: i18n._( msg`This includes your website list, pause times, schedules, preferences, and statistics.` ),
		statisticsPrivacy: i18n._( msg`Statistics keep counts and durations, plus daily counts for each configured website and hourly counts of reconsidered visits. They do not save full web addresses, page content, or individual visit records.` ),
		offlinePrivacy: i18n._( msg`TOCus works entirely offline. Your data stays on your device and is not sent to the developer.` ),
		recoveryPrivacy: i18n._( msg`If you pause while on a website, the address might be saved for a short time so you can go back to it.` ),
		trustPrivacy: i18n._( msg`You don't have to just take my word for it.` ),
		sourcePrivacy: i18n._( msg`The source code is available on GitHub if you want to check for yourself.` ),
		permissionsTitle: i18n._( msg`Why TOCus needs browser access` ),
		websitePermission: i18n._( msg`TOCus needs access to the websites you choose so it can show the pause. You control which sites to allow.` ),
		toolbarPermission: i18n._( msg`When you click the toolbar icon, TOCus gets access to the website you're currently visiting, but only for a short time, and doesn't send that data anywhere.` ),
		navigationPermission: i18n._( msg`"Navigation access" lets TOCus see changes to websites as they happen, but it doesn't look at your saved browsing history.` ),
		localToolsPermission: i18n._( msg`TOCus saves your choices using local storage. It uses scripts and browser rules to show the pause, and alarms to keep the timing correct.` ),
		faviconPermission: i18n._( msg`Your browser tries to use website icons from its own cache whenever it can. Sometimes this doesn't work. I set it up this way to keep TOCus completely private and avoid connecting to any icon service.` ),
		deniedPermission: i18n._( msg`If TOCus doesn't have access to a website, it can't pause that site. You can update these permissions in your browser's extension settings.` ),
	} );
}
