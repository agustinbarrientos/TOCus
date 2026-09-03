import {
	ToolbarBadgeDurationUnit,
	ToolbarBadgePhase,
	type ToolbarBadgeCopy,
	type ToolbarBadgeCopyResult,
	type ToolbarBadgeProjection,
	type ToolbarBadgeProjectionInput,
} from './types';

const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_MINUTE = 60_000;
const SECONDS_PER_MINUTE = 60;
const MAXIMUM_VISIBLE_SCOPE_COUNT = 99;
const ACTIVE_TITLE_PREFIX = 'TOCus: ';

/**
 * Adds the stable product identity to one localized active-state title.
 * @param title - Localized active-state title content.
 * @return Complete accessible browser-action title.
 */
function createActiveTitle( title: string ): string {
	return `${ ACTIVE_TITLE_PREFIX }${ title }`;
}

/**
 * Converts a potentially elapsed duration into a nonnegative whole-second countdown.
 * @param remainingMilliseconds - Remaining duration reported by the runtime.
 * @return Whole seconds rounded up so the badge never understates remaining time.
 */
function getRemainingSeconds( remainingMilliseconds: number ): number {
	if ( ! Number.isFinite( remainingMilliseconds ) ) {
		throw new RangeError( 'Toolbar badge countdown duration must be finite.' );
	}

	return Math.max( 0, Math.ceil( remainingMilliseconds / MILLISECONDS_PER_SECOND ) );
}

/**
 * Verifies that a multiple-active projection represents at least two complete scopes.
 * @param activeScopeCount - Number of active protection scopes.
 * @throws {RangeError} When the count is not a safe integer greater than one.
 */
function assertMultipleActiveScopeCount( activeScopeCount: number ): void {
	if ( ! Number.isSafeInteger( activeScopeCount ) || activeScopeCount < 2 ) {
		throw new RangeError( 'Multiple-active toolbar badges require at least two complete scopes.' );
	}
}

/**
 * Formats an accessible title for one timer phase.
 * @param phaseLabel - Human-readable timer phase.
 * @param amount - Nonnegative rounded duration amount.
 * @param unit - Singular duration unit represented by the amount.
 * @return Complete timer title with correct singular or plural grammar.
 */
function createTimerTitle( phaseLabel: string, amount: number, unit: string ): string {
	if ( amount === 0 ) {
		return `${ phaseLabel }: complete`;
	}

	const unitLabel = amount === 1 ? unit : `${ unit }s`;

	return `${ phaseLabel }: ${ String( amount ) } ${ unitLabel } remaining`;
}

/**
 * Formats the default English copy for one focused-pause countdown.
 * @param amount - Nonnegative rounded duration amount.
 * @param unit - Duration unit selected for the compact badge.
 * @return Default waiting badge copy.
 */
function formatEnglishWaiting( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
	const unitSuffix = unit === ToolbarBadgeDurationUnit.MINUTE ? 'm' : 's';
	const titleUnit = unit === ToolbarBadgeDurationUnit.MINUTE ? 'minute' : 'second';

	return {
		text: `P${ String( amount ) }${ unitSuffix }`,
		title: createTimerTitle( 'Pause', amount, titleUnit ),
	};
}

/**
 * Formats the default English copy for one visit-window countdown.
 * @param amount - Nonnegative rounded duration amount.
 * @param unit - Duration unit selected for the compact badge.
 * @return Default allowance badge copy.
 */
function formatEnglishAllowance( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
	if ( unit === ToolbarBadgeDurationUnit.LESS_THAN_MINUTE && amount > 0 ) {
		return {
			text: 'V<1m',
			title: 'Visit window: less than 1 minute remaining',
		};
	}

	return {
		text: `V${ String( amount ) }m`,
		title: createTimerTitle( 'Visit window', amount, 'minute' ),
	};
}

/**
 * Formats the default English summary for several active protection scopes.
 * @param activeScopeCount - Complete number of active scopes.
 * @param visibleScopeCount - Compact count capped for the browser badge.
 * @return Default multiple-active badge copy.
 */
function formatEnglishMultipleActive(
	activeScopeCount: number,
	visibleScopeCount: string,
): ToolbarBadgeCopyResult {
	return {
		text: visibleScopeCount,
		title: `${ String( activeScopeCount ) } protected-site timers active`,
	};
}

/**
 * Default English toolbar badge copy used until the selected locale is injected.
 * @since 0.1.0 Initial implementation.
 */
export const EnglishToolbarBadgeCopy: ToolbarBadgeCopy = Object.freeze( {
	inactive: Object.freeze( {
		text: '',
		title: 'TOCus',
	} ),
	formatWaiting: formatEnglishWaiting,
	formatAllowance: formatEnglishAllowance,
	formatMultipleActive: formatEnglishMultipleActive,
} );

/**
 * Creates a compact projection for one active focused pause.
 * @param remainingMilliseconds - Authoritative remaining focused-pause duration.
 * @param copy - Localized toolbar copy.
 * @return Waiting badge projection with a phase-specific text prefix and title.
 */
function createWaitingProjection(
	remainingMilliseconds: number,
	copy: ToolbarBadgeCopy,
): ToolbarBadgeProjection {
	const remainingSeconds = getRemainingSeconds( remainingMilliseconds );
	const usesMinutes = remainingMilliseconds >= MILLISECONDS_PER_MINUTE;
	const amount = usesMinutes
		? Math.ceil( remainingSeconds / SECONDS_PER_MINUTE )
		: remainingSeconds;
	const unit = usesMinutes
		? ToolbarBadgeDurationUnit.MINUTE
		: ToolbarBadgeDurationUnit.SECOND;

	const formattedCopy = copy.formatWaiting( amount, unit );

	return {
		phase: ToolbarBadgePhase.WAITING,
		...formattedCopy,
		title: createActiveTitle( formattedCopy.title ),
	};
}

/**
 * Creates a compact projection for one active visit window.
 * @param remainingMilliseconds - Authoritative remaining visit-window duration.
 * @param copy - Localized toolbar copy.
 * @return Allowance badge projection using minutes when the interval is at least one minute.
 */
function createAllowanceProjection(
	remainingMilliseconds: number,
	copy: ToolbarBadgeCopy,
): ToolbarBadgeProjection {
	const remainingSeconds = getRemainingSeconds( remainingMilliseconds );
	const usesMinutes = remainingMilliseconds > MILLISECONDS_PER_MINUTE;
	const amount = usesMinutes
		? Math.ceil( remainingSeconds / SECONDS_PER_MINUTE )
		: Math.min( remainingSeconds, 1 );
	const unit = usesMinutes
		? ToolbarBadgeDurationUnit.MINUTE
		: ToolbarBadgeDurationUnit.LESS_THAN_MINUTE;

	const formattedCopy = copy.formatAllowance( amount, unit );

	return {
		phase: ToolbarBadgePhase.ALLOWANCE,
		...formattedCopy,
		title: createActiveTitle( formattedCopy.title ),
	};
}

/**
 * Creates browser-neutral presentation values for the global toolbar badge.
 * @param input - Current timer phase and the phase-specific countdown data.
 * @param copy - Localized toolbar copy.
 * @return Compact badge text, accessible title, and semantic color phase.
 * @throws {RangeError} When countdown or multiple-active values are not finite valid measurements.
 * @since 0.1.0 Initial implementation.
 */
export function createToolbarBadgeProjection(
	input: ToolbarBadgeProjectionInput,
	copy: ToolbarBadgeCopy = EnglishToolbarBadgeCopy,
): ToolbarBadgeProjection {
	if ( input.phase === ToolbarBadgePhase.WAITING ) {
		return createWaitingProjection( input.remainingMilliseconds, copy );
	}

	if ( input.phase === ToolbarBadgePhase.ALLOWANCE ) {
		return createAllowanceProjection( input.remainingMilliseconds, copy );
	}

	if ( input.phase === ToolbarBadgePhase.MULTIPLE_ACTIVE ) {
		assertMultipleActiveScopeCount( input.activeScopeCount );

		const visibleCount = input.activeScopeCount > MAXIMUM_VISIBLE_SCOPE_COUNT
			? `${ String( MAXIMUM_VISIBLE_SCOPE_COUNT ) }+`
			: `${ String( input.activeScopeCount ) }x`;

		const formattedCopy = copy.formatMultipleActive( input.activeScopeCount, visibleCount );

		return {
			phase: ToolbarBadgePhase.MULTIPLE_ACTIVE,
			...formattedCopy,
			title: createActiveTitle( formattedCopy.title ),
		};
	}

	return {
		phase: ToolbarBadgePhase.INACTIVE,
		...copy.inactive,
	};
}

export {
	ToolbarBadgeDurationUnit,
	ToolbarBadgePhase,
	type ToolbarBadgeCopy,
	type ToolbarBadgeCopyResult,
	type ToolbarBadgeProjection,
	type ToolbarBadgeProjectionInput,
} from './types';
