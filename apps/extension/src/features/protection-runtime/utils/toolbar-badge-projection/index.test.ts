import { describe, expect, it } from 'vitest';
import {
	createToolbarBadgeProjection,
	ToolbarBadgePhase,
} from './index';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';

describe( 'createToolbarBadgeProjection', () => {
	it( 'delegates active-title wrapping and multiple-scope notation to localized copy', () => {
		const copy = {
			inactive: { text: '', title: 'product' },
			/**
			 * Wraps a toolbar title for the projection fixture.
			 * @param title - Active title content.
			 * @return Wrapped fixture title.
			 * @since 0.1.0 Initial implementation.
			 */
			formatActiveTitle: ( title: string ) => `[${ title }]`,
			/**
			 * Returns the allowance fixture projection.
			 * @return Allowance fixture copy.
			 * @since 0.1.0 Initial implementation.
			 */
			formatAllowance: () => ( { text: 'allowance', title: 'allowance-title' } ),
			/**
			 * Returns the multiple-scope fixture projection.
			 * @param _activeScopeCount - Complete active-scope count.
			 * @param visibleScopeCount - Visible localized scope count.
			 * @return Multiple-scope fixture copy.
			 * @since 0.1.0 Initial implementation.
			 */
			formatMultipleActive: ( _activeScopeCount: number, visibleScopeCount: string ) => ( {
				text: visibleScopeCount,
				title: 'multiple-title',
			} ),
			/**
			 * Formats the multiple-scope fixture indicator.
			 * @param activeScopeCount - Complete active-scope count.
			 * @return Visible fixture indicator.
			 * @since 0.1.0 Initial implementation.
			 */
			formatMultipleIndicator: ( activeScopeCount: number ) => `(${ String( activeScopeCount ) })`,
			/**
			 * Returns the waiting fixture projection.
			 * @return Waiting fixture copy.
			 * @since 0.1.0 Initial implementation.
			 */
			formatWaiting: () => ( { text: 'waiting', title: 'waiting-title' } ),
		};

		expect( createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.WAITING,
			remainingMilliseconds: 8_000,
		}, copy ) ).toMatchObject( {
			text: 'waiting',
			title: '[waiting-title]',
		} );
		expect( createToolbarBadgeProjection( {
			activeScopeCount: 2,
			phase: ToolbarBadgePhase.MULTIPLE_ACTIVE,
		}, copy ) ).toMatchObject( {
			text: '(2)',
			title: '[multiple-title]',
		} );
	} );

	it( 'uses injected localized copy without changing timer projection', () => {
		/**
		 * Formats one localized toolbar badge fixture.
		 * @return Localized toolbar badge copy.
		 */
		function formatLocalizedCopy(): { text: string; title: string } {
			return {
				text: 'E8s',
				title: 'Espera: quedan 8 segundos',
			};
		}

		expect( createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.WAITING,
			remainingMilliseconds: 8_000,
		}, {
			...TestEnglishLocalizationBundle.toolbar,
			formatWaiting: formatLocalizedCopy,
		} ) ).toEqual( {
			phase: 'waiting',
			text: 'E8s',
			title: 'TOCus: Espera: quedan 8 segundos',
		} );
	} );

	it( 'clears the badge and restores its neutral title when protection is inactive', () => {
		expect( createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.INACTIVE,
		}, TestEnglishLocalizationBundle.toolbar ) ).toEqual( {
			phase: 'inactive',
			text: '',
			title: 'TOCus',
		} );
	} );

	it.each( [
		{ remainingMilliseconds: 8_000, text: 'P8s', title: 'TOCus: Pause: 8 seconds remaining' },
		{ remainingMilliseconds: 8_001, text: 'P9s', title: 'TOCus: Pause: 9 seconds remaining' },
		{ remainingMilliseconds: 1, text: 'P1s', title: 'TOCus: Pause: 1 second remaining' },
		{ remainingMilliseconds: 59_000, text: 'P59s', title: 'TOCus: Pause: 59 seconds remaining' },
		{ remainingMilliseconds: 60_000, text: 'P1m', title: 'TOCus: Pause: 1 minute remaining' },
		{ remainingMilliseconds: 60_001, text: 'P2m', title: 'TOCus: Pause: 2 minutes remaining' },
		{ remainingMilliseconds: 100_000, text: 'P2m', title: 'TOCus: Pause: 2 minutes remaining' },
		{ remainingMilliseconds: -500, text: 'P0s', title: 'TOCus: Pause: complete' },
	] )( 'projects a safe Waiting countdown for $remainingMilliseconds milliseconds', ( expectation ) => {
		expect( createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.WAITING,
			remainingMilliseconds: expectation.remainingMilliseconds,
		}, TestEnglishLocalizationBundle.toolbar ) ).toEqual( {
			phase: 'waiting',
			text: expectation.text,
			title: expectation.title,
		} );
	} );

	it.each( [
		{ remainingMilliseconds: 300_000, text: 'V5m', title: 'TOCus: Visit window: 5 minutes remaining' },
		{ remainingMilliseconds: 60_001, text: 'V2m', title: 'TOCus: Visit window: 2 minutes remaining' },
		{ remainingMilliseconds: 60_000, text: 'V<1m', title: 'TOCus: Visit window: less than 1 minute remaining' },
		{ remainingMilliseconds: 59_001, text: 'V<1m', title: 'TOCus: Visit window: less than 1 minute remaining' },
		{ remainingMilliseconds: 1, text: 'V<1m', title: 'TOCus: Visit window: less than 1 minute remaining' },
		{ remainingMilliseconds: -500, text: 'V0m', title: 'TOCus: Visit window: complete' },
	] )( 'projects a safe Allowance countdown for $remainingMilliseconds milliseconds', ( expectation ) => {
		expect( createToolbarBadgeProjection( {
			phase: ToolbarBadgePhase.ALLOWANCE,
			remainingMilliseconds: expectation.remainingMilliseconds,
		}, TestEnglishLocalizationBundle.toolbar ) ).toEqual( {
			phase: 'allowance',
			text: expectation.text,
			title: expectation.title,
		} );
	} );

	it.each( [
		{ activeScopeCount: 2, text: '2×', title: 'TOCus: 2 protected-site timers active' },
		{ activeScopeCount: 42, text: '42×', title: 'TOCus: 42 protected-site timers active' },
		{ activeScopeCount: 100, text: '99+', title: 'TOCus: 100 protected-site timers active' },
	] )( 'projects a neutral summary for $activeScopeCount active scopes', ( expectation ) => {
		expect( createToolbarBadgeProjection( {
			activeScopeCount: expectation.activeScopeCount,
			phase: ToolbarBadgePhase.MULTIPLE_ACTIVE,
		}, TestEnglishLocalizationBundle.toolbar ) ).toEqual( {
			phase: 'multiple-active',
			text: expectation.text,
			title: expectation.title,
		} );
	} );

	it.each( [ Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY ] )(
		'rejects the non-finite remaining duration %s',
		( remainingMilliseconds ) => {
			expect( () => createToolbarBadgeProjection( {
				phase: ToolbarBadgePhase.WAITING,
				remainingMilliseconds,
			}, TestEnglishLocalizationBundle.toolbar ) ).toThrow( RangeError );
		},
	);

	it.each( [ 1, 2.5, Number.NaN, Number.POSITIVE_INFINITY ] )(
		'rejects the invalid multiple-active scope count %s',
		( activeScopeCount ) => {
			expect( () => createToolbarBadgeProjection( {
				activeScopeCount,
				phase: ToolbarBadgePhase.MULTIPLE_ACTIVE,
			}, TestEnglishLocalizationBundle.toolbar ) ).toThrow( RangeError );
		},
	);
} );
