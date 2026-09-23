import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { ProtectedSiteListCopy } from '../../../features/protected-sites/components/site-list/types';
import type { LocalizationFormatters } from '../create-localization-formatters';

/**
 * Creates localized protected-site list copy.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Complete localized protected-site list copy.
 * @since 1.0.0 Initial implementation.
 */
export function createProtectedSiteListCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<ProtectedSiteListCopy> {
	/**
	 * Compares two protected-site names using the selected language.
	 * @param firstName - First protected-site name.
	 * @param secondName - Second protected-site name.
	 * @return Locale-sensitive collation result.
	 * @since 1.0.0 Initial implementation.
	 */
	function compareNames( firstName: string, secondName: string ): number {
		return formatters.collator.compare( firstName, secondName );
	}

	return Object.freeze( {
		emptyTitle: i18n._( msg`No websites yet` ),
		emptyDescription: i18n._( msg`Add the first site you want TOCus to gently interrupt.` ),
		compareNames,
	} );
}
