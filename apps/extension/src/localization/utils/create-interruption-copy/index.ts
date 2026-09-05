import { type I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import { type InterruptionScreenCopy } from '../../../features/interruption/components/screen/types';

/**
 * Creates localized interruption-screen copy.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized interruption-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createInterruptionCopy( i18n: I18n ): Readonly<InterruptionScreenCopy> {
	/**
	 * Formats one visible remaining-time label.
	 * @param remainingSeconds - Nonnegative whole seconds remaining.
	 * @return Complete localized remaining-time label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemainingTime( remainingSeconds: number ): string {
		return i18n._( msg( {
			comment: 'Compact countdown shown during a focused pause. The letter s means seconds.',
			message: plural( { count: remainingSeconds }, {
				one: '#s remaining',
				other: '#s remaining',
			} ),
		} ) );
	}

	const key = '{key}';

	return Object.freeze( {
		breatheIn: i18n._( msg`Breathe in` ),
		breatheOut: i18n._( msg`Breathe out` ),
		continueLabel: i18n._( msg`Continue` ),
		continueShortcut: i18n._( msg`Or press ${ key }` ),
		formatRemainingTime,
		pausedAnnouncement: i18n._( msg`Your pause is paused.` ),
		readyAnnouncement: i18n._( msg`You can continue when you are ready.` ),
		readyExpiredMessage: i18n._( msg`This visit window has ended. Start another pause when you are ready.` ),
		recoveryFailedAnnouncement: i18n._( msg`TOCus still could not restore this pause.` ),
		recoveryStartedAnnouncement: i18n._( msg`Trying to restore your pause.` ),
		retryLabel: i18n._( msg`Try again` ),
		retryingLabel: i18n._( msg`Trying again...` ),
		resumedAnnouncement: i18n._( msg`Your pause has resumed.` ),
		spaceKeyLabel: i18n._( msg( {
			comment: 'Label printed inside the keyboard-key visual for the space bar.',
			message: 'Space',
		} ) ),
		sphereAlternative: i18n._( msg`A soft clay sphere expands as you breathe in and settles as you breathe out.` ),
		stillSphereAlternative: i18n._( msg`A soft clay sphere rests at the center of the screen.` ),
		takeAMoment: i18n._( msg`Take a moment` ),
		unavailableMessage: i18n._( msg`TOCus could not restore this pause.` ),
		unavailableTitle: i18n._( msg`Let's try that again` ),
		waitingStartedAnnouncement: i18n._( msg`Your pause has started.` ),
	} );
}
