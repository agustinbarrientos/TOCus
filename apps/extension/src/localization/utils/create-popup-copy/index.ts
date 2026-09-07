import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { PopupShellCopy } from '../../../features/popup/components/shell/types';
import { MILLISECONDS_PER_SECOND } from '../format-localized-duration';

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

	return Object.freeze( {
		currentWebsite: i18n._( msg( {
			comment: 'Heading above the current browser website in the extension popup.',
			message: 'Current website',
		} ) ),
		siteNotOnList: i18n._( msg( {
			comment: 'Popup status when the current website is not on the user\'s TOCus list.',
			message: 'Site not on the list',
		} ) ),
		tocusActive: i18n._( msg( {
			comment: 'Popup status when TOCus is currently active for the selected website.',
			message: 'TOCus is active',
		} ) ),
		pauseInProgress: i18n._( msg( {
			comment: 'Popup status while the user is completing a timed pause before a website.',
			message: 'Pause in progress',
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
		timeLeft: i18n._( msg( {
			comment: 'Popup label above the remaining time for the current website.',
			message: 'Time left',
		} ) ),
		pauseSite: i18n._( msg`Pause site` ),
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
	} );
}
