import {
	NextWeekday,
	NormalizedScheduleSchema,
	ScheduleMode,
	ScheduleSchema,
	WeekdayOrder,
	type NormalizedSchedule,
	type NormalizedScheduleWindow,
	type ScheduleWindow,
} from '../../types/protection-schedule';

/**
 * Splits one validated schedule window into nonempty same-day fragments.
 * @param window - Validated weekly schedule window.
 * @return One same-day fragment or two fragments across a weekday boundary.
 * @since 0.1.0 Initial implementation.
 */
function splitScheduleWindow( window: ScheduleWindow ): NormalizedScheduleWindow[] {
	if ( window.startMinute < window.endMinute ) {
		return [ { ...window } ];
	}

	const windows: NormalizedScheduleWindow[] = [
		{
			weekday: window.weekday,
			startMinute: window.startMinute,
			endMinute: 1_440,
		},
	];

	if ( window.endMinute > 0 ) {
		windows.push( {
			weekday: NextWeekday[ window.weekday ],
			startMinute: 0,
			endMinute: window.endMinute,
		} );
	}

	return windows;
}

/**
 * Compares normalized windows in deterministic weekday and minute order.
 * @param left - First normalized schedule window.
 * @param right - Second normalized schedule window.
 * @return A negative, zero, or positive sort value.
 * @since 0.1.0 Initial implementation.
 */
function compareScheduleWindows( left: NormalizedScheduleWindow, right: NormalizedScheduleWindow ): number {
	return (
		WeekdayOrder[ left.weekday ] - WeekdayOrder[ right.weekday ] ||
		left.startMinute - right.startMinute ||
		left.endMinute - right.endMinute
	);
}

/**
 * Merges overlapping and adjacent normalized windows without mutating them.
 * @param windows - Normalized windows in deterministic order.
 * @return Canonical windows with overlap and adjacency removed.
 * @since 0.1.0 Initial implementation.
 */
function mergeScheduleWindows( windows: NormalizedScheduleWindow[] ): NormalizedScheduleWindow[] {
	const mergedWindows: NormalizedScheduleWindow[] = [];

	for ( const window of windows ) {
		const previousWindow = mergedWindows.at( -1 );

		if (
			previousWindow !== undefined &&
			previousWindow.weekday === window.weekday &&
			window.startMinute <= previousWindow.endMinute
		) {
			mergedWindows[ mergedWindows.length - 1 ] = {
				...previousWindow,
				endMinute: Math.max( previousWindow.endMinute, window.endMinute ),
			};
			continue;
		}

		mergedWindows.push( { ...window } );
	}

	return mergedWindows;
}

/**
 * Normalizes an Always or custom weekly schedule without mutating its input.
 * @param schedule - Unknown schedule input.
 * @return A validated schedule with split, sorted, and merged custom windows.
 * @throws {import('zod').ZodError} When the schedule does not match the weekly schedule contract.
 * @since 0.1.0 Initial implementation.
 */
export function normalizeSchedule( schedule: unknown ): NormalizedSchedule {
	const parsedSchedule = ScheduleSchema.parse( schedule );

	if ( parsedSchedule.mode === ScheduleMode.ALWAYS ) {
		return NormalizedScheduleSchema.parse( { mode: ScheduleMode.ALWAYS } );
	}

	const splitWindows = parsedSchedule.windows.flatMap( splitScheduleWindow );
	const sortedWindows = [ ...splitWindows ].sort( compareScheduleWindows );

	return NormalizedScheduleSchema.parse( {
		mode: ScheduleMode.CUSTOM,
		windows: mergeScheduleWindows( sortedWindows ),
	} );
}

