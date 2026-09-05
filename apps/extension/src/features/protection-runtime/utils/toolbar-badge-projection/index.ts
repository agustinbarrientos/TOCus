import {
	ToolbarBadgeDurationUnit,
	ToolbarBadgePhase,
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
	type ToolbarBadgeProjectionInput,
} from './types';

const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_MINUTE = 60_000;
const SECONDS_PER_MINUTE = 60;

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
		title: copy.formatActiveTitle( formattedCopy.title ),
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
		title: copy.formatActiveTitle( formattedCopy.title ),
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
	copy: ToolbarBadgeCopy,
): ToolbarBadgeProjection {
	if ( input.phase === ToolbarBadgePhase.WAITING ) {
		return createWaitingProjection( input.remainingMilliseconds, copy );
	}

	if ( input.phase === ToolbarBadgePhase.ALLOWANCE ) {
		return createAllowanceProjection( input.remainingMilliseconds, copy );
	}

	if ( input.phase === ToolbarBadgePhase.MULTIPLE_ACTIVE ) {
		assertMultipleActiveScopeCount( input.activeScopeCount );

		const visibleCount = copy.formatMultipleIndicator( input.activeScopeCount );

		const formattedCopy = copy.formatMultipleActive( input.activeScopeCount, visibleCount );

		return {
			phase: ToolbarBadgePhase.MULTIPLE_ACTIVE,
			...formattedCopy,
			title: copy.formatActiveTitle( formattedCopy.title ),
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
