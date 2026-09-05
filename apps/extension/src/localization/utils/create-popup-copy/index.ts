import { type I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import { type PopupShellCopy } from '../../../features/popup/components/shell/types';
import {
	DurationUnit,
	MILLISECONDS_PER_SECOND,
	formatDurationUnit,
} from '../format-localized-duration';

const SECONDS_PER_MINUTE = 60;

/**
 * Creates localized popup copy and compact duration formatters.
 * @param i18n - Locale-specific Lingui instance.
 * @return Complete localized popup copy.
 * @since 0.1.0 Initial implementation.
 */
export function createPopupCopy( i18n: I18n ): Readonly<PopupShellCopy> {
	const minutesFormatter = new Intl.NumberFormat( i18n.locale, {
		maximumFractionDigits: 0,
		useGrouping: false,
	} );
	const secondsFormatter = new Intl.NumberFormat( i18n.locale, {
		maximumFractionDigits: 0,
		minimumIntegerDigits: 2,
		useGrouping: false,
	} );

	/**
	 * Formats one nonnegative timer duration without extending partial seconds.
	 * @param milliseconds - Remaining duration in milliseconds.
	 * @return Localized minutes-and-seconds countdown.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatCountdown( milliseconds: number ): string {
		const safeMilliseconds = Number.isFinite( milliseconds ) ? Math.max( 0, milliseconds ) : 0;
		const totalSeconds = Math.ceil( safeMilliseconds / MILLISECONDS_PER_SECOND );
		const minutes = Math.floor( totalSeconds / SECONDS_PER_MINUTE );
		const seconds = totalSeconds % SECONDS_PER_MINUTE;

		return `${ minutesFormatter.format( minutes ) }:${ secondsFormatter.format( seconds ) }`;
	}

	/**
	 * Formats one next-pause duration as whole seconds.
	 * @param milliseconds - Next pause duration in milliseconds.
	 * @return Localized whole-second duration.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatNextPause( milliseconds: number ): string {
		return formatDurationUnit(
			i18n,
			Math.ceil( Math.max( 0, milliseconds ) / MILLISECONDS_PER_SECOND ),
			DurationUnit.SECOND,
		);
	}

	/**
	 * Formats one shared timing-scope website count.
	 * @param count - Positive website count.
	 * @return Localized website count.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatWebsiteCount( count: number ): string {
		return i18n._( msg( {
			comment: 'Number of websites using one shared active timing scope.',
			message: plural( { count }, {
				one: '# website',
				other: '# websites',
			} ),
		} ) );
	}

	return Object.freeze( {
		currentWebsite: i18n._( msg( {
			comment: 'Heading above the current browser website in the extension popup.',
			message: 'Current website',
		} ) ),
		noPauseHere: i18n._( msg( {
			comment: 'Popup status when the current website is not on the user\'s TOCus list.',
			message: 'No pause here',
		} ) ),
		tocusActive: i18n._( msg( {
			comment: 'Popup status when TOCus is currently active for the selected website.',
			message: 'TOCus is active',
		} ) ),
		pauseInProgress: i18n._( msg( {
			comment: 'Popup status while the user is completing a timed pause before a website.',
			message: 'Pause in progress',
		} ) ),
		visitWindowOpen: i18n._( msg( {
			comment: 'Popup status while a timed website allowance is currently open.',
			message: 'Visit window open',
		} ) ),
		offRightNow: i18n._( msg( {
			comment: 'Popup status when the current website schedule is inactive at this moment.',
			message: 'Off right now',
		} ) ),
		browserAccessNeeded: i18n._( msg( {
			comment: 'Popup status when TOCus needs browser permission for the current website.',
			message: 'Browser access needed',
		} ) ),
		statusUnavailable: i18n._( msg`Status unavailable` ),
		unsupportedPage: i18n._( msg( {
			comment: 'Popup explanation shown for browser-owned pages that extensions cannot manage.',
			message: 'TOCus cannot add a pause to this browser page.',
		} ) ),
		currentWebsiteUnavailable: i18n._( msg( {
			comment: 'Popup explanation shown when the current website cannot be identified.',
			message: 'TOCus cannot read the current website.',
		} ) ),
		nextPause: i18n._( msg( {
			comment: 'Popup label for the duration of the next required pause.',
			message: 'Next pause',
		} ) ),
		activeTiming: i18n._( msg( {
			comment: 'Popup heading above all timing scopes with a currently running timer.',
			message: 'Active timing',
		} ) ),
		sharedTiming: i18n._( msg`Shared timing` ),
		currentScope: i18n._( msg( {
			comment: 'Popup timing-scope label when the scope belongs to the current website.',
			message: 'Current website',
		} ) ),
		pause: i18n._( msg( {
			comment: 'Short popup label beside a countdown for an active timed pause.',
			message: 'Pause',
		} ) ),
		visitWindow: i18n._( msg( {
			comment: 'Short popup label beside a countdown for an active website allowance.',
			message: 'Visit window',
		} ) ),
		addPauseHere: i18n._( msg`Add a pause here` ),
		addingPause: i18n._( msg`Adding...` ),
		manageWebsite: i18n._( msg`Manage this website` ),
		settings: i18n._( msg`Settings` ),
		statistics: i18n._( msg`Statistics` ),
		retry: i18n._( msg`Try again` ),
		retrying: i18n._( msg`Trying again...` ),
		unavailableTitle: i18n._( msg( {
			comment: 'Gentle popup error heading when the current status cannot load.',
			message: 'TOCus is taking a moment',
		} ) ),
		unavailableDescription: i18n._( msg`Your websites and settings are unchanged. Try again.` ),
		permissionDeniedError: i18n._( msg`Browser access is needed to add a pause here.` ),
		permissionError: i18n._( msg`Browser access could not be confirmed. Try again.` ),
		permissionRetainedError: i18n._(
			msg`This website could not be saved. Its browser access may still be active.`,
		),
		saveError: i18n._( msg`This website could not be added. Nothing was changed.` ),
		formatCountdown,
		formatNextPause,
		formatWebsiteCount,
	} );
}
