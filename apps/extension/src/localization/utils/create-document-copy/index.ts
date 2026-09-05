import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type DocumentCopy } from '../create-localization-bundle/types';

/**
 * Creates localized browser-document titles owned by extension pages.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized document-title copy.
 * @since 0.1.0 Initial implementation.
 */
export function createDocumentCopy( i18n: I18n ): Readonly<DocumentCopy> {
	return Object.freeze( {
		interruptionTitle: i18n._( msg`TOCus` ),
		onboardingTitle: i18n._( msg`Welcome to TOCus` ),
		popupTitle: i18n._( msg`TOCus` ),
		settingsTitle: i18n._( msg`TOCus settings` ),
	} );
}
