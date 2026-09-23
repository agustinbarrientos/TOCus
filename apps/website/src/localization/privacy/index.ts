import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { PrivacyCatalog } from './types';

/**
 * Resolves the complete privacy document through the selected website catalog.
 * @param i18n - Page-local translation instance.
 * @return Translated privacy prose and metadata.
 * @since 1.0.0
 */
export function createPrivacyCatalog( i18n: I18n ): Readonly<PrivacyCatalog> {
	return Object.freeze( {
		title: i18n._( msg( { message: 'Privacy Policy' } ) ),
		description: i18n._( msg( { message: 'How TOCus handles extension-local data, permissions, deletion, and ordinary website requests.' } ) ),
		reviewed: i18n._( msg( { message: 'Last reviewed September 23, 2026.' } ) ),
		extensionTitle: i18n._( msg( { message: 'The extension' } ) ),
		siteTitle: i18n._( msg( { message: 'This site' } ) ),
		dataTitle: i18n._( msg( { message: 'What stays on your device' } ) ),
		everything: i18n._( msg( { message: 'Absolutely everything.' } ) ),
		dataIncludes: i18n._( msg( { message: 'This includes your website list, pause times, schedules, preferences, and statistics.' } ) ),
		statistics: i18n._( msg( { message: "The statistics only keep track of counts and durations. They don't save any page content or web addresses." } ) ),
		offline: i18n._( msg( { message: "TOCus works entirely offline and doesn't track your data on your device." } ) ),
		temporaryAddress: i18n._( msg( { message: 'If you pause while on a website, the address might be saved for a short time so you can go back to it.' } ) ),
		verify: i18n._( msg( { message: "You don't have to just take my word for it." } ) ),
		source: i18n._( msg( { message: 'The source code is available on GitHub if you want to check for yourself.' } ) ),
		permissionsTitle: i18n._( msg( { message: 'Why TOCus needs browser access' } ) ),
		siteAccess: i18n._( msg( { message: 'TOCus needs access to the websites you choose so it can show the pause. You control which sites to allow.' } ) ),
		toolbarAccess: i18n._( msg( { message: "When you click the toolbar icon, TOCus gets access to the website you're currently visiting, but only for a short time, and doesn't send that data anywhere." } ) ),
		navigationAccess: i18n._( msg( { message: "\"Navigation access\" lets TOCus see changes to websites as they happen, but it doesn't look at your saved browsing history." } ) ),
		localStorage: i18n._( msg( { message: 'TOCus saves your choices using local storage. It uses scripts and browser rules to show the pause, and alarms to keep the timing correct.' } ) ),
		icons: i18n._( msg( { message: "Your browser tries to use website icons from its own cache whenever it can. Sometimes this doesn't work. I set it up this way to keep TOCus completely private and avoid connecting to any icon service." } ) ),
		missingAccess: i18n._( msg( { message: "If TOCus doesn't have access to a website, it can't pause that site. You can update these permissions in your browser's extension settings." } ) ),
		deletionTitle: i18n._( msg( { message: 'Reset and deletion controls' } ) ),
		deletion: i18n._( msg( { message: '\u201cReset statistics\u201d deletes recorded counts and total time while keeping your sites and settings. \u201cReset all TOCus data\u201d deletes sites, schedules, timing, preferences, active pauses, and statistics, removes allowed website access, and restarts setup.' } ) ),
		resetMarker: i18n._( msg( { message: 'After a reset, TOCus may keep a random value in local storage so an old settings page can\u2019t bring back deleted data. The value shows that a reset happened. It doesn\u2019t identify a person, device, account, or browsing activity.' } ) ),
		limitedUseTitle: i18n._( msg( { message: 'Chrome Limited Use disclosure' } ) ),
		limitedUseBefore: i18n._( msg( { message: "The extension uses Chrome's browser features on your device to show pauses on the sites you choose. Its use of this information follows the" } ) ),
		limitedUseLink: i18n._( msg( { message: 'Chrome Web Store User Data Policy, including the Limited Use requirements' } ) ),
		limitedUseAfter: i18n._( msg( { message: ". Your site list, settings, and statistics stay in your browser. The extension doesn't send them to the developer or Google and has no analytics or tracking." } ) ),
		websiteTitle: i18n._( msg( { message: 'This website and external links' } ) ),
		websiteRequests: i18n._( msg( { message: 'When you visit this website, your browser sends messages to the server that runs it. These messages can include your IP address, browser type, the page you want, and the time of the request. The hosting service may keep a record of these messages in server logs.' } ) ),
		externalLinks: i18n._( msg( { message: "Links to GitHub, browser rules, extension stores, and the author's website open other sites that have their own privacy rules. Installing or updating TOCus can also connect with your browser or store provider. These connections are separate from the extension sending data to the developer." } ) ),
	} );
}
