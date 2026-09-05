import { type I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import { type ProtectedPageLayerCopy } from '../../../features/interruption/components/protected-page-layer/types';

/**
 * Creates localized protected-page layer copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized protected-page layer copy.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedPageLayerCopy( i18n: I18n ): Readonly<ProtectedPageLayerCopy> {
	/**
	 * Formats one final allowance warning.
	 * @param remainingSeconds - Whole allowance seconds remaining.
	 * @return Complete localized warning sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAllowanceWarning( remainingSeconds: number ): string {
		return i18n._( msg( {
			comment: 'Warning shown shortly before an active protected-site visit window ends.',
			message: plural( { count: remainingSeconds }, {
				one: 'Your visit window ends in # second.',
				other: 'Your visit window ends in # seconds.',
			} ),
		} ) );
	}

	return Object.freeze( {
		allowanceWarningAnnouncement: i18n._( msg`Your visit window is ending soon.` ),
		dialogLabel: i18n._( msg`TOCus pause` ),
		formatAllowanceWarning,
	} );
}
