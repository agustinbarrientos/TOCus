import { type I18n } from '@lingui/core';
import { msg, plural } from '@lingui/core/macro';
import {
	ToolbarBadgeDurationUnit,
	type ToolbarBadgeCopy,
	type ToolbarBadgeCopyResult,
} from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import { type LocalizationFormatters } from '../create-localization-formatters';

/**
 * Largest complete active-scope count that fits the toolbar badge.
 * @since 0.1.0 Initial implementation.
 */
const MaximumVisibleScopeCount = 99;

/**
 * Creates the toolbar badge copy adapter.
 * @param i18n - Locale-specific Lingui instance.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed toolbar badge copy.
 * @since 0.1.0 Initial implementation.
 */
export function createToolbarCopy(
	i18n: I18n,
	formatters: LocalizationFormatters,
): Readonly<ToolbarBadgeCopy> {
	/**
	 * Wraps one active-state title in the locale's complete product-title template.
	 * @param title - Localized active-state title content.
	 * @return Complete browser-action title.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatActiveTitle( title: string ): string {
		return i18n._( msg`TOCus: ${ title }` );
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
		const count = formatters.number.format( amount );
		const text = usesMinutes
			? i18n._( msg( {
				comment: 'Compact toolbar badge. P means pause and m means minutes; keep it very short.',
				message: `P${ count }m`,
			} ) )
			: i18n._( msg( {
				comment: 'Compact toolbar badge. P means pause and s means seconds; keep it very short.',
				message: `P${ count }s`,
			} ) );

		if ( amount === 0 ) {
			return Object.freeze( {
				text,
				title: i18n._( msg`Pause: complete` ),
			} );
		}
		const title = usesMinutes
			? i18n._( msg( {
				comment: 'Browser toolbar tooltip while a focused pause has whole minutes remaining.',
				message: plural( { count: amount }, {
					one: 'Pause: # minute remaining',
					other: 'Pause: # minutes remaining',
				} ),
			} ) )
			: i18n._( msg( {
				comment: 'Browser toolbar tooltip while a focused pause has seconds remaining.',
				message: plural( { count: amount }, {
					one: 'Pause: # second remaining',
					other: 'Pause: # seconds remaining',
				} ),
			} ) );

		return Object.freeze( {
			text,
			title,
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
				text: i18n._( msg( {
					comment: 'Compact toolbar badge. V means visit window and m means minutes; keep it very short.',
					message: 'V0m',
				} ) ),
				title: i18n._( msg`Visit window: complete` ),
			} );
		}

		if ( unit === ToolbarBadgeDurationUnit.LESS_THAN_MINUTE ) {
			return Object.freeze( {
				text: i18n._( msg( {
					comment: 'Compact toolbar badge. V means visit window and m means minutes; keep it very short.',
					message: 'V<1m',
				} ) ),
				title: i18n._( msg`Visit window: less than 1 minute remaining` ),
			} );
		}
		const count = formatters.number.format( amount );

		return Object.freeze( {
			text: i18n._( msg( {
				comment: 'Compact toolbar badge. V means visit window and m means minutes; keep it very short.',
				message: `V${ count }m`,
			} ) ),
			title: i18n._( msg( {
				comment: 'Browser toolbar tooltip while a protected-site visit window has whole minutes remaining.',
				message: plural( { count: amount }, {
					one: 'Visit window: # minute remaining',
					other: 'Visit window: # minutes remaining',
				} ),
			} ) ),
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
		const count = formatters.number.format( visibleCount );

		return activeScopeCount > MaximumVisibleScopeCount
			? i18n._( msg( {
				comment: 'Compact toolbar count above the visible limit; keep the plus sign and keep it very short.',
				message: `${ count }+`,
			} ) )
			: i18n._( msg( {
				comment: 'Compact toolbar count for multiple active protection scopes; keep it very short.',
				message: `${ count }\u00d7`,
			} ) );
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
			text: visibleScopeCount,
			title: i18n._( msg( {
				comment: 'Browser toolbar tooltip when several protection scopes have active timers.',
				message: plural( { count: activeScopeCount }, {
					one: '# timer active',
					other: '# timers active',
				} ),
			} ) ),
		} );
	}

	return Object.freeze( {
		inactive: Object.freeze( {
			text: '',
			title: i18n._( msg`TOCus` ),
		} ),
		formatActiveTitle,
		formatWaiting,
		formatAllowance,
		formatMultipleIndicator,
		formatMultipleActive,
	} );
}
