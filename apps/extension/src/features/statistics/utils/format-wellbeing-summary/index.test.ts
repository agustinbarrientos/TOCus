import { describe, expect, it } from 'vitest';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import { formatWellbeingSummary } from './index';
import { type WellbeingSummaryValues } from './types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';

/**
 * Formats one wellbeing summary with centralized test localization.
 * @param projection - Projection rendered by the formatter.
 * @return Localized wellbeing summary.
 * @since 0.1.0 Initial implementation.
 */
function formatTestWellbeingSummary( projection: StatisticsProjection ): string {
	return formatWellbeingSummary( projection, TestEnglishLocalizationBundle.wellbeing );
}

/**
 * Exposes duration input for localized-copy delegation tests.
 * @param milliseconds - Duration supplied by the formatter.
 * @return Stable test representation.
 * @since 0.1.0 Initial implementation.
 */
function formatTestDuration( milliseconds: number ): string {
	return `duration:${ String( milliseconds ) }`;
}

/**
 * Exposes complete summary values for localized-copy delegation tests.
 * @param values - Values supplied to localized grammar.
 * @return Serialized test representation.
 * @since 0.1.0 Initial implementation.
 */
function formatTestSummary( values: WellbeingSummaryValues ): string {
	return JSON.stringify( { values } );
}

/**
 * Creates one available all-time projection for footer-formatting tests.
 * @param overrides - Metric values that replace the zero projection.
 * @return Complete available statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function createProjection(
	overrides: Partial<Extract<StatisticsProjection, { status: 'available' }>> = {},
): StatisticsProjection {
	return {
		status: StatisticsProjectionStatus.AVAILABLE,
		estimatedReclaimedMilliseconds: 0,
		focusedPauseMilliseconds: 0,
		reconsideredVisitCount: 0,
		completedWaitCount: 0,
		allowanceGrantedCount: 0,
		...overrides,
	};
}

describe( 'format wellbeing summary', () => {
	it( 'uses the neutral message when statistics are unavailable or both values are zero', () => {
		expect( formatTestWellbeingSummary(
			{ status: StatisticsProjectionStatus.UNAVAILABLE },
		) ).toBe( 'This is a moment just for you.' );
		expect( formatTestWellbeingSummary(
			createProjection(),
		) ).toBe( 'This is a moment just for you.' );
	} );

	it( 'uses neutral all-time pause language before a reclaimed-time baseline exists', () => {
		expect( formatTestWellbeingSummary(
			createProjection( {
				estimatedReclaimedMilliseconds: null,
				focusedPauseMilliseconds: 18 * 60_000,
			} ),
		) ).toBe( "Since you started, you've taken 18 minutes for yourself." );
	} );

	it( 'describes reclaimed time honestly without a pause total', () => {
		expect( formatTestWellbeingSummary(
			createProjection( {
				estimatedReclaimedMilliseconds: ( 3 * 60 + 24 ) * 60_000,
			} ),
		) ).toBe( "Since you started, you've given yourself about 3 hours, 24 minutes back." );
	} );

	it( 'combines reclaimed and neutral all-time pause time in one human sentence', () => {
		expect( formatTestWellbeingSummary(
			createProjection( {
				estimatedReclaimedMilliseconds: ( 3 * 60 + 24 ) * 60_000,
				focusedPauseMilliseconds: 18 * 60_000,
			} ),
		) ).toBe(
			"Since you started, you've given yourself about 3 hours, 24 minutes back and taken 18 minutes for yourself.",
		);
	} );

	it( 'formats nonzero seconds, minutes, and rounded hours with natural units', () => {
		expect( formatTestWellbeingSummary(
			createProjection( { focusedPauseMilliseconds: 400 } ),
		) ).toContain( '1 second' );
		expect( formatTestWellbeingSummary(
			createProjection( { focusedPauseMilliseconds: 89_000 } ),
		) ).toContain( '1 minute' );
		expect( formatTestWellbeingSummary(
			createProjection( { focusedPauseMilliseconds: 119_000 } ),
		) ).toContain( '2 minutes' );
		expect( formatTestWellbeingSummary(
			createProjection( { focusedPauseMilliseconds: 60 * 60_000 } ),
		) ).toContain( '1 hour' );
	} );

	it( 'delegates duration order and complete grammar to localized copy', () => {
		expect( formatWellbeingSummary(
			createProjection( {
				estimatedReclaimedMilliseconds: 120_000,
				focusedPauseMilliseconds: 30_000,
			} ),
			{
				neutral: 'neutral',
				formatDuration: formatTestDuration,
				formatSummary: formatTestSummary,
			},
		) ).toBe( JSON.stringify( {
			values: {
				estimatedReclaimedTime: 'duration:120000',
				focusedPauseTime: 'duration:30000',
			},
		} ) );
	} );
} );
