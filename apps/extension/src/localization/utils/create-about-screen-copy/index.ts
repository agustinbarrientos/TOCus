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
		summary: i18n._( msg`Free and open source. Your settings and statistics stay on this device.` ),
		linksTitle: i18n._( msg`Built in the open` ),
		linksDescription: i18n._( msg`Read the code, explore the license, or help improve TOCus.` ),
		sourceCode: i18n._( msg`Source code` ),
		license: i18n._( msg`MIT license` ),
		contribute: i18n._( msg`Contribute` ),
		externalLinksHint: i18n._( msg`These links open GitHub in a new tab.` ),
		formatVersion,
	} );
}
