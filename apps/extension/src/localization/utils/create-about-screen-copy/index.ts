import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type AboutScreenCopy } from '../../../features/settings/components/about-screen/types';

/**
 * Creates localized About-screen copy and version formatting.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized About-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createAboutScreenCopy( i18n: I18n ): Readonly<AboutScreenCopy> {
	/**
	 * Formats the installed version without altering its release identifier.
	 * @param version - Version supplied by the browser manifest.
	 * @return Localized version label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatVersion( version: string ): string {
		return i18n._( msg`Version ${ { version } }` );
	}

	return Object.freeze( {
		eyebrow: i18n._( msg`About` ),
		storyTitle: i18n._( msg`Made for a very interesting internet` ),
		creator: i18n._( msg`Developed by ${ { name: 'Agustin Barrientos' } }` ),
		summary: i18n._( msg`The internet is full of wonderful things. Sometimes, they all want your attention at once. I built TOCus to help anyone who feels overwhelmed by it all: a gentle pause to breathe, step back, and choose what comes next.` ),
		privacyTitle: i18n._( msg`Your data stays with you` ),
		privacyDescription: i18n._( msg`TOCus runs locally in your browser and never contacts external servers. No accounts, tracking, or cloud connections. Once installed, it can even work on an intranet with external internet access disabled.` ),
		linksTitle: i18n._( msg`Open source. Open to you.` ),
		linksDescription: i18n._( msg`TOCus is free and open source on GitHub. You're welcome to inspect the code, suggest improvements, or contribute changes.` ),
		forkDescription: i18n._( msg`Want more control over the code you run? Fork the project, inspect it, and build your own copy. You don't have to take anyone's word for how your data is handled.` ),
		sourceCode: i18n._( msg`Source code` ),
		suggestChanges: i18n._( msg`Suggest improvements` ),
		license: i18n._( msg`MIT license` ),
		contribute: i18n._( msg`Contribute` ),
		fork: i18n._( msg`Fork the project` ),
		externalLinksHint: i18n._( msg`External links connect to their websites only when you choose to open them.` ),
		formatVersion,
	} );
}
