import { type I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type PopupShellCopy } from '../../../features/popup/components/shell/types';

/**
 * Creates localized popup copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized popup copy.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupCopy( i18n: I18n ): Readonly<PopupShellCopy> {
	return Object.freeze( {
		status: i18n._( msg`Private by design` ),
		summary: i18n._( msg( {
			context: 'Popup summary',
			message: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
		} ) ),
		foundationNote: i18n._( msg`Your settings and statistics stay on this device.` ),
	} );
}
