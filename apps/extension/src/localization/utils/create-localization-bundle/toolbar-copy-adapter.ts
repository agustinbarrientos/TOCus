import {
	ToolbarBadgeDurationUnit,
	type ToolbarBadgeCopyResult,
} from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import {
	formatMessage,
	formatPluralMessage,
} from './formatters';
import {
	type LocalizationBundle,
	type LocalizationFormatters,
	type ToolbarLocalizationCatalog,
} from './types';

/**
 * Largest complete active-scope count that fits the toolbar badge.
 * @since 0.1.0 Initial implementation.
 */
const MaximumVisibleScopeCount = 99;

/**
 * Creates the toolbar badge copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed toolbar badge copy.
 * @since 0.1.0 Initial implementation.
 */
export function createToolbarCopy(
	catalog: ToolbarLocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'toolbar' ] {
	/**
	 * Wraps one active-state title in the locale's complete product-title template.
	 * @param title - Localized active-state title content.
	 * @return Complete browser-action title.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatActiveTitle( title: string ): string {
		return formatMessage( catalog.toolbar.activeTitle, { title } );
	}

	/**
	 * Formats one focused-pause countdown.
	 * @param amount - Rounded duration amount.
	 * @param unit - Semantic compact-badge unit.
	 * @return Localized badge text and complete title content.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatWaiting( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
		const usesMinutes = unit === ToolbarBadgeDurationUnit.MINUTE;
		const textTemplate = usesMinutes
			? catalog.toolbar.waiting.minuteText
			: catalog.toolbar.waiting.secondText;
		const titleMessages = usesMinutes
			? catalog.toolbar.waiting.minuteTitle
			: catalog.toolbar.waiting.secondTitle;
		const count = formatters.number.format( amount );

		return Object.freeze( {
			text: formatMessage( textTemplate, { count } ),
			title: amount === 0
				? catalog.toolbar.waiting.completeTitle
				: formatPluralMessage( amount, titleMessages, formatters ),
		} );
	}

	/**
	 * Formats one visit-window countdown.
	 * @param amount - Rounded duration amount.
	 * @param unit - Semantic compact-badge unit.
	 * @return Localized badge text and complete title content.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAllowance( amount: number, unit: ToolbarBadgeDurationUnit ): ToolbarBadgeCopyResult {
		if ( amount === 0 ) {
			return Object.freeze( {
				text: catalog.toolbar.allowance.completeText,
				title: catalog.toolbar.allowance.completeTitle,
			} );
		}

		if ( unit === ToolbarBadgeDurationUnit.LESS_THAN_MINUTE ) {
			return Object.freeze( {
				text: catalog.toolbar.allowance.lessThanMinuteText,
				title: catalog.toolbar.allowance.lessThanMinuteTitle,
			} );
		}

		return Object.freeze( {
			text: formatMessage( catalog.toolbar.allowance.minuteText, {
				count: formatters.number.format( amount ),
			} ),
			title: formatPluralMessage( amount, catalog.toolbar.allowance.minuteTitle, formatters ),
		} );
	}

	/**
	 * Formats one active-scope count for the constrained toolbar badge.
	 * @param activeScopeCount - Complete active scope count.
	 * @return Localized compact count with overflow notation when needed.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatMultipleIndicator( activeScopeCount: number ): string {
		const visibleCount = Math.min( activeScopeCount, MaximumVisibleScopeCount );
		const template = activeScopeCount > MaximumVisibleScopeCount
			? catalog.toolbar.overflowIndicator
			: catalog.toolbar.multipleIndicator;

		return formatMessage( template, {
			count: formatters.number.format( visibleCount ),
		} );
	}

	/**
	 * Formats the neutral state for several active scopes.
	 * @param activeScopeCount - Complete active scope count.
	 * @param visibleScopeCount - Already capped compact badge count.
	 * @return Localized badge text and complete title content.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatMultipleActive( activeScopeCount: number, visibleScopeCount: string ): ToolbarBadgeCopyResult {
		return Object.freeze( {
			text: formatMessage( catalog.toolbar.multipleText, { visibleCount: visibleScopeCount } ),
			title: formatPluralMessage( activeScopeCount, catalog.toolbar.multipleTitle, formatters ),
		} );
	}

	return Object.freeze( {
		inactive: Object.freeze( {
			text: '',
			title: catalog.toolbar.inactiveTitle,
		} ),
		formatActiveTitle,
		formatWaiting,
		formatAllowance,
		formatMultipleIndicator,
		formatMultipleActive,
	} ) satisfies LocalizationBundle[ 'toolbar' ];
}
