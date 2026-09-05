/**
 * Runtime phases represented by the browser toolbar badge.
 * @since 0.1.0 Initial implementation.
 */
export const ToolbarBadgePhase = {
	INACTIVE: 'inactive',
	WAITING: 'waiting',
	ALLOWANCE: 'allowance',
	MULTIPLE_ACTIVE: 'multiple-active',
} as const;

/**
 * Runtime phase represented by the browser toolbar badge.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarBadgePhase = typeof ToolbarBadgePhase[ keyof typeof ToolbarBadgePhase ];

/**
 * Requests an empty global badge when no protection timer is active.
 * @since 0.1.0 Initial implementation.
 */
export interface InactiveToolbarBadgeProjectionInput {
	/** Inactive badge discriminator. */
	phase: typeof ToolbarBadgePhase.INACTIVE;
}

/**
 * Requests a badge for one active focused pause.
 * @since 0.1.0 Initial implementation.
 */
export interface WaitingToolbarBadgeProjectionInput {
	/** Waiting badge discriminator. */
	phase: typeof ToolbarBadgePhase.WAITING;
	/** Authoritative time remaining in the focused pause. */
	remainingMilliseconds: number;
}

/**
 * Requests a badge for one active visit window.
 * @since 0.1.0 Initial implementation.
 */
export interface AllowanceToolbarBadgeProjectionInput {
	/** Allowance badge discriminator. */
	phase: typeof ToolbarBadgePhase.ALLOWANCE;
	/** Authoritative time remaining in the visit window. */
	remainingMilliseconds: number;
}

/**
 * Requests a neutral global badge when several protection scopes are active without a focused match.
 * @since 0.1.0 Initial implementation.
 */
export interface MultipleActiveToolbarBadgeProjectionInput {
	/** Multiple-active badge discriminator. */
	phase: typeof ToolbarBadgePhase.MULTIPLE_ACTIVE;
	/** Number of active protection scopes represented by the badge. */
	activeScopeCount: number;
}

/**
 * Complete input variants accepted by the toolbar badge projector.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarBadgeProjectionInput =
	| InactiveToolbarBadgeProjectionInput
	| WaitingToolbarBadgeProjectionInput
	| AllowanceToolbarBadgeProjectionInput
	| MultipleActiveToolbarBadgeProjectionInput;

/**
 * Browser-neutral presentation values for one toolbar badge update.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarBadgeProjection {
	/** Semantic protection phase represented by this projection. */
	phase: ToolbarBadgePhase;
	/** Compact badge text, or an empty string when the badge must be cleared. */
	text: string;
	/** Accessible browser-action title that distinguishes the active phase. */
	title: string;
}

/**
 * Duration units already selected by toolbar projection logic before copy formatting.
 * @since 0.1.0 Initial implementation.
 */
export const ToolbarBadgeDurationUnit = {
	LESS_THAN_MINUTE: 'less-than-minute',
	SECOND: 'second',
	MINUTE: 'minute',
} as const;

/**
 * Duration unit provided to localized toolbar badge copy.
 * @since 0.1.0 Initial implementation.
 */
export type ToolbarBadgeDurationUnit = typeof ToolbarBadgeDurationUnit[ keyof typeof ToolbarBadgeDurationUnit ];

/**
 * Localized text produced for one semantic toolbar badge phase.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarBadgeCopyResult {
	/** Compact localized badge text, or an empty string when inactive. */
	text: string;
	/** Localized browser-action title content; active projections add the product-name prefix. */
	title: string;
}

/**
 * Injectable localized copy contract for toolbar badge projections.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarBadgeCopy {
	/** Localized inactive toolbar copy. */
	inactive: ToolbarBadgeCopyResult;

	/**
	 * Wraps one active browser-action title with local product punctuation.
	 * @param title - Localized active-state title content.
	 * @return Complete localized active browser-action title.
	 */
	formatActiveTitle( title: string ): string;

	/**
	 * Formats one focused-pause countdown.
	 * @param amount - Nonnegative rounded duration amount.
	 * @param unit - Duration unit selected for the compact badge.
	 * @return Localized waiting badge copy.
	 */
	formatWaiting( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult;

	/**
	 * Formats one visit-window countdown.
	 * @param amount - Nonnegative rounded duration amount.
	 * @param unit - Duration unit selected for the compact badge.
	 * @return Localized allowance badge copy.
	 */
	formatAllowance( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult;

	/**
	 * Formats one compact badge count for several active protection scopes.
	 * @param activeScopeCount - Complete active scope count.
	 * @return Localized compact count including overflow notation when needed.
	 */
	formatMultipleIndicator( activeScopeCount: number ): string;

	/**
	 * Formats a summary for several active protection scopes.
	 * @param activeScopeCount - Complete number of active scopes.
	 * @param visibleScopeCount - Localized compact count supplied by the copy contract.
	 * @return Localized multiple-active badge copy.
	 */
	formatMultipleActive( activeScopeCount: number, visibleScopeCount: string ): ToolbarBadgeCopyResult;
}
