import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { AboutScreenCopy } from '../../../features/settings/components/about-screen/types';

/**
 * Creates localized About-screen copy and version formatting.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized About-screen copy.
 * @since 1.0.0 Initial implementation.
 */
export function createAboutScreenCopy( i18n: I18n ): Readonly<AboutScreenCopy> {
	/**
	 * Formats the installed version without altering its release identifier.
	 * @param version - Version supplied by the browser manifest.
	 * @return Localized version label.
	 * @since 1.0.0 Initial implementation.
	 */
	function formatVersion( version: string ): string {
		return i18n._( msg`Version ${ { version } }` );
	}

	return Object.freeze( {
		title: i18n._( msg`About` ),
		storyTitle: i18n._( msg`Made for a very interesting internet` ),
		creator: i18n._( msg`Developed by ${ { name: 'Agustin Barrientos' } }` ),
		summary: i18n._( msg`The internet has a lot of great things, but it can feel like everything is fighting for your attention. I created TOCus for anyone who feels stressed, giving you a moment to pause, breathe, and choose what to do next.` ),
		privacyTitle: i18n._( msg`Your data stays with you` ),
		privacyDescription: i18n._( msg`TOCus works directly in your browser and never connects to outside servers. There are no accounts, tracking, or cloud links. After you install it, it can even run on a private network without internet access.` ),
		linksTitle: i18n._( msg`Open source. Open to you.` ),
		linksDescription: i18n._( msg`TOCus is free and open source on GitHub. You're welcome to inspect the code, suggest improvements, or contribute changes.` ),
		forkDescription: i18n._( msg`Want more control over the code you use? Copy the project, check it, and make your own version. You shouldn't have to trust anyone else about how your data is managed.` ),
		sourceCode: i18n._( msg`Source code` ),
		suggestChanges: i18n._( msg`Suggest improvements` ),
		license: i18n._( msg`MIT license` ),
		contribute: i18n._( msg`Contribute` ),
		fork: i18n._( msg`Fork the project` ),
		externalLinksHint: i18n._( msg`External links connect to their websites only when you choose to open them.` ),
		formatVersion,
	} );
}
