import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { SupportCatalog } from './types';

/**
 * Resolves the support page through the selected website catalog.
 * @param i18n - Page-local translation instance.
 * @return Translated support heading and contact introduction.
 * @since 1.0.0
 */
export function createSupportCatalog( i18n: I18n ): Readonly<SupportCatalog> {
	return Object.freeze( {
		title: i18n._( msg( { message: 'Support' } ) ),
		description: i18n._( msg( { message: 'Questions or problems with TOCus? Get in touch by email.' } ) ),
	} );
}
