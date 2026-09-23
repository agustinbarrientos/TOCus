import type { StatisticsCalendarObserverOptions } from './types';

/**
 * Re-reads a mounted Statistics screen at local midnight or after calendar changes during sleep.
 * @param options - Screen lifecycle and authoritative refresh callback.
 * @return Cleanup that removes listeners and the single pending midnight timeout.
 * @since 1.0.0
 */
export function observeStatisticsCalendar( options: StatisticsCalendarObserverOptions ): () => void {
	let observedDate = new Date().toDateString();
	let timeout: ReturnType<typeof setTimeout>;
	/** Schedules the next local midnight, allowing calendar arithmetic to account for DST. */
	function scheduleMidnight(): void {
		const now = new Date();
		const midnight = new Date( now.getFullYear(), now.getMonth(), now.getDate() + 1 );
		timeout = setTimeout( receiveCalendarChange, midnight.getTime() - now.getTime() );
	}
	/** Invalidates a visible screen only when its local calendar date has changed. */
	function receiveCalendarChange(): void {
		clearTimeout( timeout );
		const currentDate = new Date().toDateString();
		if ( options.document.visibilityState === 'visible' && currentDate !== observedDate ) {
			observedDate = currentDate;
			options.onChange();
		}
		scheduleMidnight();
	}
	scheduleMidnight();
	options.document.addEventListener( 'visibilitychange', receiveCalendarChange );
	options.window.addEventListener( 'focus', receiveCalendarChange );
	return () => {
		clearTimeout( timeout );
		options.document.removeEventListener( 'visibilitychange', receiveCalendarChange );
		options.window.removeEventListener( 'focus', receiveCalendarChange );
	};
}
