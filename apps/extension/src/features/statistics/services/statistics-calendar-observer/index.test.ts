import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeStatisticsCalendar } from './index';

/** Controllable document visibility for calendar lifecycle tests. */
class CalendarDocument extends EventTarget {
	visibilityState: DocumentVisibilityState = 'visible';
}

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'observeStatisticsCalendar', () => {
	it( 'invalidates at local Monday midnight once and releases timers when the screen closes', () => {
		vi.useFakeTimers();
		vi.setSystemTime( new Date( 2026, 8, 13, 23, 59, 59 ) );
		const onChange = vi.fn();
		const document = new CalendarDocument();
		const window = new EventTarget();
		const dispose = observeStatisticsCalendar( { document, window, onChange } );
		expect( onChange ).not.toHaveBeenCalled();
		vi.advanceTimersByTime( 1_000 );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
		vi.advanceTimersByTime( 1_000 );
		window.dispatchEvent( new Event( 'focus' ) );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
		dispose();
		expect( vi.getTimerCount() ).toBe( 0 );
		vi.setSystemTime( new Date( 2026, 8, 15 ) );
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		window.dispatchEvent( new Event( 'focus' ) );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'refreshes the authoritative source after a hidden tab sleeps across a month boundary', () => {
		vi.useFakeTimers();
		vi.setSystemTime( new Date( 2026, 8, 30, 23, 59, 59 ) );
		const onChange = vi.fn();
		const document = new CalendarDocument();
		const window = new EventTarget();
		const dispose = observeStatisticsCalendar( { document, window, onChange } );
		document.visibilityState = 'hidden';
		vi.advanceTimersByTime( 1_000 );
		expect( onChange ).not.toHaveBeenCalled();
		document.visibilityState = 'visible';
		document.dispatchEvent( new Event( 'visibilitychange' ) );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
		vi.setSystemTime( new Date( 2026, 10, 1 ) );
		window.dispatchEvent( new Event( 'focus' ) );
		expect( onChange ).toHaveBeenCalledTimes( 2 );
		dispose();
	} );
} );
